const std = @import("std");
const quickjs = @import("quickjs");
const Value = quickjs.Value;
const Context = quickjs.Context;
const c = quickjs.c;

const miniaudio = @import("miniaudio.zig");

const log = std.log.scoped(.audio_bridge);

/// The audio bridge connects JavaScript Web Audio API calls to miniaudio.
pub const AudioBridge = struct {
    initialized: bool = false,

    pub fn init() !AudioBridge {
        return AudioBridge{};
    }

    pub fn deinit(self: *AudioBridge) void {
        if (self.initialized) {
            miniaudio.deinitAudio();
            self.initialized = false;
        }
    }

    /// Register audio functions with the QuickJS context.
    pub fn register(self: *AudioBridge, ctx: *Context) !void {
        log.info("AudioBridge.register called", .{});
        _ = self;
        const global = ctx.getGlobalObject();
        defer global.deinit(ctx);

        // Get or create the __native object on globalThis.
        var native_obj = global.getPropertyStr(ctx, "__native");
        if (native_obj.isUndefined()) {
            log.info("Creating __native object", .{});
            native_obj.deinit(ctx);
            native_obj = Value.initObject(ctx);
            global.setPropertyStr(ctx, "__native", native_obj) catch return error.JSError;
            native_obj = global.getPropertyStr(ctx, "__native");
        }
        defer native_obj.deinit(ctx);

        log.info("Registering audio functions", .{});
        // audioInit() — initialize the audio engine
        const audio_init_fn = Value.initCFunctionData(ctx, &audioInitWrapper, 0, 0, &.{});
        native_obj.setPropertyStr(ctx, "audioInit", audio_init_fn) catch return error.JSError;

        // audioShutdown() — shutdown the audio engine
        const audio_shutdown_fn = Value.initCFunctionData(ctx, &audioShutdownWrapper, 0, 0, &.{});
        native_obj.setPropertyStr(ctx, "audioShutdown", audio_shutdown_fn) catch return error.JSError;

        // audioPlaySound(path) — play a sound file
        const audio_play_sound_fn = Value.initCFunctionData(ctx, &audioPlaySoundWrapper, 1, 0, &.{});
        native_obj.setPropertyStr(ctx, "audioPlaySound", audio_play_sound_fn) catch return error.JSError;

        // audioSetVolume(volume) — set volume (0.0 to 1.0)
        const audio_set_volume_fn = Value.initCFunctionData(ctx, &audioSetVolumeWrapper, 1, 0, &.{});
        native_obj.setPropertyStr(ctx, "audioSetVolume", audio_set_volume_fn) catch return error.JSError;

        // audioPlayBuffer(buffer, sampleRate, channels) — play audio buffer data
        const audio_play_buffer_fn = Value.initCFunctionData(ctx, &audioPlayBufferWrapper, 3, 0, &.{});
        native_obj.setPropertyStr(ctx, "audioPlayBuffer", audio_play_buffer_fn) catch return error.JSError;
        
        log.info("Audio functions registered successfully", .{});
    }
};

// Wrapper functions for QuickJS C function callbacks

fn audioInitWrapper(
    _: ?*Context,
    _: Value,
    _: []const c.JSValue,
    _: c_int,
    _: [*c]c.JSValue,
) Value {
    log.info("audioInitWrapper called", .{});
    miniaudio.initAudio() catch |err| {
        log.err("Failed to initialize audio: {}", .{err});
        return Value.initBool(false);
    };

    log.info("audioInitWrapper succeeded", .{});
    return Value.initBool(true);
}

fn audioShutdownWrapper(
    _: ?*Context,
    _: Value,
    _: []const c.JSValue,
    _: c_int,
    _: [*c]c.JSValue,
) Value {
    miniaudio.deinitAudio();
    return Value.undefined;
}

fn audioPlaySoundWrapper(
    ctx: ?*Context,
    _: Value,
    argv: []const c.JSValue,
    _: c_int,
    _: [*c]c.JSValue,
) Value {
    log.info("audioPlaySoundWrapper called", .{});
    const context = ctx orelse return Value.undefined;

    if (argv.len < 1) {
        log.err("audioPlaySoundWrapper: No arguments provided", .{});
        return Value.initBool(false);
    }

    const path_val: Value = @bitCast(argv[0]);
    if (path_val.isNull() or path_val.isUndefined()) {
        log.err("Path value is null or undefined", .{});
        return Value.initBool(false);
    }

    const path_slice = path_val.toZigSlice(context) orelse {
        log.err("Failed to convert path to Zig slice", .{});
        return Value.initBool(false);
    };
    defer context.freeCString(path_slice.ptr);
    
    log.info("audioPlaySoundWrapper: Path = {s}", .{path_slice});
    
    // Duplicate the string for miniaudio since QuickJS will free the original
    const path_dup = std.heap.c_allocator.dupeZ(u8, path_slice) catch |err| {
        log.err("Failed to duplicate path: {}", .{err});
        return Value.initBool(false);
    };
    defer std.heap.c_allocator.free(path_dup);

    // Ensure audio is initialized
    miniaudio.initAudio() catch |err| {
        log.err("Failed to initialize audio: {}", .{err});
        return Value.initBool(false);
    };

    miniaudio.playSound(path_dup) catch |err| {
        log.err("Failed to play sound: {}", .{err});
        return Value.initBool(false);
    };

    log.info("audioPlaySoundWrapper succeeded", .{});
    return Value.initBool(true);
}

fn audioSetVolumeWrapper(
    ctx: ?*Context,
    _: Value,
    argv: []const c.JSValue,
    _: c_int,
    _: [*c]c.JSValue,
) Value {
    const context = ctx orelse return Value.undefined;

    if (argv.len < 1) {
        return Value.undefined;
    }

    const volume_val: Value = @bitCast(argv[0]);
    if (volume_val.isNull() or volume_val.isUndefined()) {
        return Value.undefined;
    }

    const volume = volume_val.toFloat64(context) catch return Value.undefined;

    // Clamp volume between 0.0 and 1.0
    const clamped_volume = @max(0.0, @min(1.0, volume));

    if (miniaudio.getEngine()) |engine| {
        engine.setVolume(@floatCast(clamped_volume));
    }

    return Value.undefined;
}

fn audioPlayBufferWrapper(
    ctx: ?*Context,
    _: Value,
    argv: []const c.JSValue,
    _: c_int,
    _: [*c]c.JSValue,
) Value {
    log.info("audioPlayBufferWrapper called", .{});
    const context = ctx orelse return Value.undefined;

    if (argv.len < 3) {
        log.err("audioPlayBufferWrapper: Not enough arguments", .{});
        return Value.initBool(false);
    }

    // Get buffer data (Float32Array)
    const buffer_val: Value = @bitCast(argv[0]);
    if (buffer_val.isNull() or buffer_val.isUndefined()) {
        log.err("audioPlayBufferWrapper: Buffer is null or undefined", .{});
        return Value.initBool(false);
    }

    // Get buffer data 
    const buffer_info = buffer_val.getTypedArrayBuffer(context) orelse {
        log.err("audioPlayBufferWrapper: Failed to get buffer data", .{});
        return Value.initBool(false);
    };
    defer buffer_info.value.deinit(context);
    const buffer_len = buffer_info.byte_length;

    // Get sample rate
    const sample_rate_val: Value = @bitCast(argv[1]);
    const sample_rate = sample_rate_val.toFloat64(context) catch return Value.initBool(false);

    // Get number of channels
    const channels_val: Value = @bitCast(argv[2]);
    const channels = channels_val.toInt32(context) catch return Value.initBool(false);

    const sample_rate_u32: u32 = @intFromFloat(sample_rate);
    const sample_rate_f32: f32 = @floatCast(sample_rate);
    const samples_per_channel = buffer_len / @as(usize, @intFromFloat(sample_rate_f32));
    log.info("audioPlayBufferWrapper: Playing buffer: {} samples, {} Hz, {} channels", .{samples_per_channel, sample_rate_u32, channels});

    // For now, we'll log this as a stub - full implementation would require
    // converting Float32Array to PCM data and playing via miniaudio
    // This would need additional native functions for memory-based playback
    log.info("audioPlayBufferWrapper: Buffer playback not yet implemented", .{});

    return Value.initBool(false);
}