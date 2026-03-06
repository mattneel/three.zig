const std = @import("std");
const builtin = @import("builtin");
const posix = std.posix;
const poll = @import("poll.zig");
const Completion = poll.Completion;
const OpType = poll.OpType;

/// Whether we are on a Linux OS (epoll is Linux-specific).
const is_linux = builtin.os.tag == .linux;

/// Platform types — resolved at comptime so the file parses on any OS.
const linux = std.os.linux;
const c = std.c;

/// Linux epoll-backed async I/O poller.
///
/// Socket I/O uses EPOLLIN / EPOLLOUT for true async notification.
/// Regular file I/O is performed synchronously with pread/pwrite (epoll
/// cannot watch regular files for readiness) and returned as an immediate
/// completion.
pub const EpollPoll = struct {
    epoll_fd: posix.fd_t,
    /// Pending immediate completions (from synchronous file I/O).
    immediate_completions: [max_completions]Completion = undefined,
    immediate_count: u32 = 0,
    /// Scratch buffer for epoll_wait results.
    events_buf: [max_completions]if (is_linux) linux.epoll_event else u8 = undefined,
    /// Translated completions returned to the caller of `poll`.
    completions_buf: [max_completions]Completion = undefined,

    const max_completions = 256;

    /// Initialise the epoll poller.
    pub fn init() !EpollPoll {
        if (!is_linux) {
            return error.SystemOutdated;
        }

        const rc = linux.epoll_create1(0);
        const signed_rc: isize = @bitCast(rc);
        if (signed_rc < 0) {
            return error.SystemOutdated;
        }

        var self: EpollPoll = .{
            .epoll_fd = @intCast(signed_rc),
        };
        // Zero-init the scratch buffers.
        @memset(std.mem.asBytes(&self.events_buf), 0);
        @memset(std.mem.asBytes(&self.completions_buf), 0);
        @memset(std.mem.asBytes(&self.immediate_completions), 0);
        return self;
    }

    /// Tear down the epoll poller.
    pub fn deinit(self: *EpollPoll) void {
        posix.close(self.epoll_fd);
    }

    // ------------------------------------------------------------------
    // Submission helpers
    // ------------------------------------------------------------------

    /// Submit an async file read.
    ///
    /// epoll cannot do async I/O on regular files, so we perform a
    /// synchronous pread and queue an immediate completion.
    pub fn submitRead(
        self: *EpollPoll,
        fd: posix.fd_t,
        buffer: []u8,
        offset: u64,
        userdata: u64,
    ) !void {
        if (!is_linux) return error.SystemOutdated;

        // Perform synchronous pread for regular file I/O.
        const signed_offset: i64 = @intCast(offset);
        const rc = c.pread(fd, buffer.ptr, buffer.len, signed_offset);
        const result: i32 = if (rc >= 0)
            @intCast(rc)
        else
            -@as(i32, @intCast(@intFromEnum(posix.errno(rc))));

        if (self.immediate_count < max_completions) {
            self.immediate_completions[self.immediate_count] = .{
                .userdata = userdata,
                .result = result,
                .op_type = opTypeFromUserdata(userdata),
            };
            self.immediate_count += 1;
        }
    }

    /// Submit an async file write.
    ///
    /// Like submitRead, regular file writes are performed synchronously.
    pub fn submitWrite(
        self: *EpollPoll,
        fd: posix.fd_t,
        buffer: []const u8,
        offset: u64,
        userdata: u64,
    ) !void {
        if (!is_linux) return error.SystemOutdated;

        const signed_offset: i64 = @intCast(offset);
        const rc = c.pwrite(fd, buffer.ptr, buffer.len, signed_offset);
        const result: i32 = if (rc >= 0)
            @intCast(rc)
        else
            -@as(i32, @intCast(@intFromEnum(posix.errno(rc))));

        if (self.immediate_count < max_completions) {
            self.immediate_completions[self.immediate_count] = .{
                .userdata = userdata,
                .result = result,
                .op_type = opTypeFromUserdata(userdata),
            };
            self.immediate_count += 1;
        }
    }

    /// Submit an async socket connect.
    ///
    /// Initiates a non-blocking connect and registers EPOLLOUT to
    /// detect when the connection completes (or fails).
    pub fn submitConnect(
        self: *EpollPoll,
        socket: posix.socket_t,
        addr: *const posix.sockaddr,
        addrlen: posix.socklen_t,
        userdata: u64,
    ) !void {
        if (!is_linux) return error.SystemOutdated;

        // Attempt non-blocking connect.
        const rc = linux.connect(socket, addr, addrlen);
        const signed_rc: isize = @bitCast(rc);

        if (signed_rc == 0) {
            // Connected immediately — queue immediate completion.
            if (self.immediate_count < max_completions) {
                self.immediate_completions[self.immediate_count] = .{
                    .userdata = userdata,
                    .result = 0,
                    .op_type = .connect,
                };
                self.immediate_count += 1;
            }
            return;
        }

        const err = posix.errno(rc);

        if (err != .INPROGRESS) {
            // Real error — queue as immediate negative errno.
            if (self.immediate_count < max_completions) {
                self.immediate_completions[self.immediate_count] = .{
                    .userdata = userdata,
                    .result = -@as(i32, @intCast(@intFromEnum(err))),
                    .op_type = .connect,
                };
                self.immediate_count += 1;
            }
            return;
        }

        // EINPROGRESS — register EPOLLOUT to detect completion.
        try self.registerEpoll(socket, linux.EPOLL.OUT, userdata);
    }

    /// Submit an async socket recv.
    ///
    /// Registers EPOLLIN so we get notified when data is available,
    /// then performs the recv inline during poll().
    pub fn submitRecv(
        self: *EpollPoll,
        socket: posix.socket_t,
        buffer: []u8,
        userdata: u64,
    ) !void {
        if (!is_linux) return error.SystemOutdated;

        try self.addPendingOp(.{
            .fd = socket,
            .userdata = userdata,
            .op = .recv,
            .buffer = buffer.ptr,
            .buffer_len = buffer.len,
        });

        try self.registerEpoll(socket, linux.EPOLL.IN, userdata);
    }

    /// Submit an async socket send.
    ///
    /// Registers EPOLLOUT so we get notified when the socket is
    /// writable, then performs the send inline during poll().
    pub fn submitSend(
        self: *EpollPoll,
        socket: posix.socket_t,
        buffer: []const u8,
        userdata: u64,
    ) !void {
        if (!is_linux) return error.SystemOutdated;

        try self.addPendingOp(.{
            .fd = socket,
            .userdata = userdata,
            .op = .send,
            .buffer = @constCast(buffer.ptr),
            .buffer_len = buffer.len,
        });

        try self.registerEpoll(socket, linux.EPOLL.OUT, userdata);
    }

    // ------------------------------------------------------------------
    // Completion polling
    // ------------------------------------------------------------------

    /// Poll for completions.
    ///
    /// `timeout_ms`:
    ///   - `0` — non-blocking: return immediately with whatever is ready.
    ///   - `> 0` — wait up to `timeout_ms` milliseconds for at least one
    ///     completion, then return all that are ready.
    ///
    /// Returns a slice of `Completion` values. The slice is backed by
    /// internal storage and is valid until the next call to `poll`.
    pub fn poll(self: *EpollPoll, timeout_ms: u32) ![]const Completion {
        if (!is_linux) return error.SystemOutdated;

        var count: u32 = 0;

        // First, drain any immediate completions (from sync file I/O).
        const imm = self.immediate_count;
        for (0..imm) |i| {
            if (count < max_completions) {
                self.completions_buf[count] = self.immediate_completions[i];
                count += 1;
            }
        }
        self.immediate_count = 0;

        // If we already have immediate completions, do a non-blocking check
        // for any additional socket events.
        if (count > 0) {
            const n = self.epollWait(0);
            count = self.translateEvents(n, count);
            return self.completions_buf[0..count];
        }

        // No immediate completions — call epoll_wait with the requested timeout.
        const timeout: i32 = if (timeout_ms == 0)
            0
        else
            @intCast(@min(timeout_ms, @as(u32, std.math.maxInt(i32))));
        const n = self.epollWait(timeout);
        count = self.translateEvents(n, count);

        return self.completions_buf[0..count];
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /// Pending operation tracking — needed for recv/send where we must
    /// remember the buffer to use when the socket becomes ready.
    const PendingOp = struct {
        fd: posix.fd_t,
        userdata: u64,
        op: OpType,
        buffer: [*]u8,
        buffer_len: usize,
        active: bool = true,
    };

    /// Simple fixed-size pending operations array.
    var pending_ops: [max_completions]PendingOp = undefined;
    var pending_ops_count: u32 = 0;
    var pending_ops_initialized: bool = false;

    fn ensurePendingOpsInit() void {
        if (!pending_ops_initialized) {
            for (0..max_completions) |i| {
                pending_ops[i].active = false;
            }
            pending_ops_initialized = true;
        }
    }

    fn addPendingOp(self: *EpollPoll, op: PendingOp) !void {
        _ = self;
        ensurePendingOpsInit();

        // Find a free slot.
        for (0..max_completions) |i| {
            if (!pending_ops[i].active) {
                pending_ops[i] = op;
                pending_ops_count += 1;
                return;
            }
        }
        return error.SystemResources;
    }

    fn findPendingOp(userdata: u64) ?*PendingOp {
        ensurePendingOpsInit();
        for (0..max_completions) |i| {
            if (pending_ops[i].active and pending_ops[i].userdata == userdata) {
                return &pending_ops[i];
            }
        }
        return null;
    }

    /// Register an epoll event on a file descriptor.
    fn registerEpoll(self: *EpollPoll, fd: posix.fd_t, events: u32, userdata: u64) !void {
        var ev = linux.epoll_event{
            .events = events | linux.EPOLL.ONESHOT | linux.EPOLL.ERR | linux.EPOLL.HUP,
            .data = .{ .u64 = userdata },
        };

        const rc = linux.epoll_ctl(self.epoll_fd, linux.EPOLL.CTL_ADD, fd, &ev);
        const signed_rc: isize = @bitCast(rc);
        if (signed_rc < 0) {
            return error.SystemResources;
        }
    }

    /// Call epoll_wait() to wait for events. Retries on EINTR.
    fn epollWait(self: *EpollPoll, timeout_ms: i32) u32 {
        while (true) {
            const rc = linux.epoll_wait(self.epoll_fd, &self.events_buf, max_completions, timeout_ms);
            const signed_rc: isize = @bitCast(rc);
            if (signed_rc < 0) {
                if (posix.errno(rc) == .INTR) continue;
                return 0;
            }
            return @intCast(signed_rc);
        }
    }

    /// Translate raw epoll events into Completion values.
    /// Also performs the actual recv/send for socket operations.
    fn translateEvents(self: *EpollPoll, event_count: u32, start_idx: u32) u32 {
        var count = start_idx;
        for (0..event_count) |i| {
            if (count >= max_completions) break;

            const ev = self.events_buf[i];
            const userdata: u64 = ev.data.u64;
            const op_type = opTypeFromUserdata(userdata);

            // Check for errors reported by epoll (ERR or HUP without IN/OUT).
            if (ev.events & (linux.EPOLL.ERR | linux.EPOLL.HUP) != 0 and
                ev.events & (linux.EPOLL.IN | linux.EPOLL.OUT) == 0)
            {
                // Remove pending op if any.
                if (findPendingOp(userdata)) |pending| {
                    pending.active = false;
                    pending_ops_count -= 1;
                }
                self.completions_buf[count] = .{
                    .userdata = userdata,
                    .result = -@as(i32, @intCast(@intFromEnum(std.posix.E.CONNRESET))),
                    .op_type = op_type,
                };
                count += 1;
                continue;
            }

            // For recv/send operations, we need to actually perform the I/O.
            if (findPendingOp(userdata)) |pending| {
                const result: i32 = switch (pending.op) {
                    .recv => blk: {
                        const res = linux.recvfrom(pending.fd, pending.buffer, pending.buffer_len, 0, null, null);
                        pending.active = false;
                        pending_ops_count -= 1;
                        const signed: isize = @bitCast(res);
                        break :blk if (signed >= 0)
                            @intCast(signed)
                        else
                            -@as(i32, @intCast(@intFromEnum(posix.errno(res))));
                    },
                    .send => blk: {
                        const res = linux.sendto(pending.fd, pending.buffer, pending.buffer_len, 0, null, 0);
                        pending.active = false;
                        pending_ops_count -= 1;
                        const signed: isize = @bitCast(res);
                        break :blk if (signed >= 0)
                            @intCast(signed)
                        else
                            -@as(i32, @intCast(@intFromEnum(posix.errno(res))));
                    },
                    else => 0,
                };

                self.completions_buf[count] = .{
                    .userdata = userdata,
                    .result = result,
                    .op_type = pending.op,
                };
                count += 1;
            } else {
                // Connect completion or other event without a pending op.
                self.completions_buf[count] = .{
                    .userdata = userdata,
                    .result = 0,
                    .op_type = op_type,
                };
                count += 1;
            }
        }
        return count;
    }

    /// Derive the `OpType` from a userdata convention.
    ///
    /// We encode the op type in the upper 8 bits of the userdata so that
    /// the completion path can reconstruct which operation finished.
    /// The remaining 56 bits are available to the caller for context.
    fn opTypeFromUserdata(userdata: u64) OpType {
        const tag: u8 = @truncate(userdata >> 56);
        return switch (tag) {
            @intFromEnum(OpType.read) => .read,
            @intFromEnum(OpType.write) => .write,
            @intFromEnum(OpType.connect) => .connect,
            @intFromEnum(OpType.recv) => .recv,
            @intFromEnum(OpType.send) => .send,
            @intFromEnum(OpType.accept) => .accept,
            else => .read, // fallback for raw userdata without tag
        };
    }

    // ------------------------------------------------------------------
    // Userdata encoding helpers
    // ------------------------------------------------------------------

    /// Encode an `OpType` tag and a caller-supplied context into a single
    /// 64-bit userdata value. The op type occupies the top 8 bits.
    pub fn encodeUserdata(op: OpType, context: u56) u64 {
        return (@as(u64, @intFromEnum(op)) << 56) | @as(u64, context);
    }

    /// Decode a userdata value back into its op type tag and context.
    pub fn decodeUserdata(userdata: u64) struct { op: OpType, context: u56 } {
        const tag: u8 = @truncate(userdata >> 56);
        const ctx: u56 = @truncate(userdata);
        const op: OpType = switch (tag) {
            @intFromEnum(OpType.read) => .read,
            @intFromEnum(OpType.write) => .write,
            @intFromEnum(OpType.connect) => .connect,
            @intFromEnum(OpType.recv) => .recv,
            @intFromEnum(OpType.send) => .send,
            @intFromEnum(OpType.accept) => .accept,
            else => .read,
        };
        return .{ .op = op, .context = ctx };
    }
};

// ======================================================================
// Tests
// ======================================================================

const testing = std.testing;

/// Helper: create an EpollPoll, skipping the test on non-Linux platforms.
fn initTestEpoll() !EpollPoll {
    if (!is_linux) return error.SkipZigTest;
    return EpollPoll.init() catch |err| switch (err) {
        error.SystemOutdated => return error.SkipZigTest,
        else => return err,
    };
}

// 1. Init / deinit — create epoll, destroy it, no leaks.
test "EpollPoll: init and deinit" {
    var p = try initTestEpoll();
    defer p.deinit();
}

// 2. File read — write known content with std, then submitRead + poll.
test "EpollPoll: file read" {
    var p = try initTestEpoll();
    defer p.deinit();

    var tmp = testing.tmpDir(.{});
    defer tmp.cleanup();

    const content = "hello epoll";
    const file = try tmp.dir.createFile("read_test", .{ .read = true, .truncate = true });
    defer file.close();
    try file.writeAll(content);

    var buf: [64]u8 = undefined;
    const userdata = EpollPoll.encodeUserdata(.read, 0xAB);
    try p.submitRead(file.handle, &buf, 0, userdata);

    const completions = try p.poll(1000);
    try testing.expect(completions.len >= 1);

    const comp = completions[0];
    try testing.expectEqual(@as(i32, @intCast(content.len)), comp.result);
    try testing.expectEqual(OpType.read, comp.op_type);
    try testing.expectEqual(userdata, comp.userdata);
    try testing.expectEqualSlices(u8, content, buf[0..@intCast(comp.result)]);
}

// 3. File write + read round-trip.
test "EpollPoll: file write then read" {
    var p = try initTestEpoll();
    defer p.deinit();

    var tmp = testing.tmpDir(.{});
    defer tmp.cleanup();

    const file = try tmp.dir.createFile("write_read_test", .{ .read = true, .truncate = true });
    defer file.close();

    const payload = "round-trip test data!";
    const write_ud = EpollPoll.encodeUserdata(.write, 1);
    try p.submitWrite(file.handle, payload, 0, write_ud);

    const wc = try p.poll(1000);
    try testing.expect(wc.len >= 1);
    try testing.expectEqual(@as(i32, @intCast(payload.len)), wc[0].result);
    try testing.expectEqual(OpType.write, wc[0].op_type);

    // Now read back.
    var buf: [64]u8 = undefined;
    const read_ud = EpollPoll.encodeUserdata(.read, 2);
    try p.submitRead(file.handle, &buf, 0, read_ud);

    const rc = try p.poll(1000);
    try testing.expect(rc.len >= 1);
    try testing.expectEqual(@as(i32, @intCast(payload.len)), rc[0].result);
    try testing.expectEqualSlices(u8, payload, buf[0..@intCast(rc[0].result)]);
}

// 4. Multiple concurrent reads.
test "EpollPoll: multiple concurrent reads" {
    var p = try initTestEpoll();
    defer p.deinit();

    var tmp = testing.tmpDir(.{});
    defer tmp.cleanup();

    const names = [_][]const u8{ "file_a", "file_b", "file_c" };
    const contents = [_][]const u8{ "aaaa", "bbbbbb", "cccccccc" };
    var files: [3]std.fs.File = undefined;

    for (0..3) |i| {
        files[i] = try tmp.dir.createFile(names[i], .{ .read = true, .truncate = true });
        try files[i].writeAll(contents[i]);
    }
    defer for (&files) |*f| f.close();

    var bufs: [3][32]u8 = undefined;
    for (0..3) |i| {
        const ud = EpollPoll.encodeUserdata(.read, @intCast(i));
        try p.submitRead(files[i].handle, &bufs[i], 0, ud);
    }

    const cs = try p.poll(1000);
    try testing.expect(cs.len >= 3);

    var seen: [3]bool = .{ false, false, false };
    for (cs[0..3]) |comp| {
        const decoded = EpollPoll.decodeUserdata(comp.userdata);
        const idx: usize = @intCast(decoded.context);
        try testing.expect(idx < 3);
        try testing.expect(!seen[idx]);
        seen[idx] = true;
        try testing.expectEqual(@as(i32, @intCast(contents[idx].len)), comp.result);
        try testing.expectEqualSlices(u8, contents[idx], bufs[idx][0..@intCast(comp.result)]);
    }

    for (seen) |s| try testing.expect(s);
}

// 5. Non-blocking poll when no ops are pending returns empty slice.
test "EpollPoll: non-blocking poll returns empty" {
    var p = try initTestEpoll();
    defer p.deinit();

    const completions = try p.poll(0);
    try testing.expectEqual(@as(usize, 0), completions.len);
}

// 6. Userdata round-trip: submit with specific userdata, verify on completion.
test "EpollPoll: userdata round-trip" {
    var p = try initTestEpoll();
    defer p.deinit();

    var tmp = testing.tmpDir(.{});
    defer tmp.cleanup();

    const file = try tmp.dir.createFile("ud_test", .{ .read = true, .truncate = true });
    defer file.close();
    try file.writeAll("x");

    const magic: u64 = 0xDEAD_BEEF_CAFE_0042;
    var buf: [8]u8 = undefined;
    try p.submitRead(file.handle, &buf, 0, magic);

    const completions = try p.poll(1000);
    try testing.expect(completions.len >= 1);
    try testing.expectEqual(magic, completions[0].userdata);
    try testing.expectEqual(@as(i32, 1), completions[0].result);
}

// 7. Encode / decode userdata helpers.
test "EpollPoll: encode and decode userdata" {
    const ctx: u56 = 0x00_1234_5678_9ABC;
    const encoded = EpollPoll.encodeUserdata(.send, ctx);
    const decoded = EpollPoll.decodeUserdata(encoded);
    try testing.expectEqual(OpType.send, decoded.op);
    try testing.expectEqual(ctx, decoded.context);
}
