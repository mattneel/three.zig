const std = @import("std");

pub const c = @cImport({
    @cInclude("dawn/webgpu.h");
});

const log = std.log.scoped(.dawn_raw);

pub const WaitError = error{
    WaitFailed,
    AdapterRequestFailed,
    DeviceRequestFailed,
};

pub fn stringViewToSlice(view: c.WGPUStringView) []const u8 {
    if (view.data == null) return "";
    return view.data[0..view.length];
}

fn waitForCallback(instance: c.WGPUInstance, completed: *const std.atomic.Value(bool)) void {
    while (!completed.load(.acquire)) {
        c.wgpuInstanceProcessEvents(instance);
        std.Thread.sleep(1 * std.time.ns_per_ms);
    }
}

pub fn requestAdapterSync(
    instance: c.WGPUInstance,
    options: ?*const c.WGPURequestAdapterOptions,
) WaitError!c.WGPUAdapter {
    const State = struct {
        completed: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
        status: c.WGPURequestAdapterStatus = 0,
        adapter: c.WGPUAdapter = null,
    };

    const callback = struct {
        fn call(
            status: c.WGPURequestAdapterStatus,
            adapter: c.WGPUAdapter,
            message: c.WGPUStringView,
            userdata1: ?*anyopaque,
            userdata2: ?*anyopaque,
        ) callconv(.c) void {
            _ = userdata2;
            if (status != c.WGPURequestAdapterStatus_Success) {
                log.err("requestAdapter failed: {s}", .{stringViewToSlice(message)});
            }
            const state = @as(*State, @ptrCast(@alignCast(userdata1.?)));
            state.status = status;
            state.adapter = adapter;
            state.completed.store(true, .release);
        }
    }.call;

    var state = State{};
    const callback_info = c.WGPURequestAdapterCallbackInfo{
        .nextInChain = null,
        .mode = c.WGPUCallbackMode_AllowProcessEvents,
        .callback = callback,
        .userdata1 = &state,
        .userdata2 = null,
    };
    _ = c.wgpuInstanceRequestAdapter(instance, options, callback_info);
    waitForCallback(instance, &state.completed);

    if (state.status != c.WGPURequestAdapterStatus_Success or state.adapter == null) {
        log.err("requestAdapter final status={d}", .{state.status});
        return error.AdapterRequestFailed;
    }
    return state.adapter;
}

pub fn requestDeviceSync(
    instance: c.WGPUInstance,
    adapter: c.WGPUAdapter,
    descriptor: ?*const c.WGPUDeviceDescriptor,
) WaitError!c.WGPUDevice {
    const State = struct {
        completed: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
        status: c.WGPURequestDeviceStatus = 0,
        device: c.WGPUDevice = null,
    };

    const callback = struct {
        fn call(
            status: c.WGPURequestDeviceStatus,
            device: c.WGPUDevice,
            message: c.WGPUStringView,
            userdata1: ?*anyopaque,
            userdata2: ?*anyopaque,
        ) callconv(.c) void {
            _ = userdata2;
            if (status != c.WGPURequestDeviceStatus_Success) {
                log.err("requestDevice failed: {s}", .{stringViewToSlice(message)});
            }
            const state = @as(*State, @ptrCast(@alignCast(userdata1.?)));
            state.status = status;
            state.device = device;
            state.completed.store(true, .release);
        }
    }.call;

    var state = State{};
    const callback_info = c.WGPURequestDeviceCallbackInfo{
        .nextInChain = null,
        .mode = c.WGPUCallbackMode_AllowProcessEvents,
        .callback = callback,
        .userdata1 = &state,
        .userdata2 = null,
    };
    _ = c.wgpuAdapterRequestDevice(adapter, descriptor, callback_info);
    waitForCallback(instance, &state.completed);

    if (state.status != c.WGPURequestDeviceStatus_Success or state.device == null) {
        log.err("requestDevice final status={d}", .{state.status});
        return error.DeviceRequestFailed;
    }
    return state.device;
}
