const std = @import("std");
const builtin = @import("builtin");
const dawn = @import("dawn/context.zig");
const zglfw = @import("zglfw");

const log = std.log.scoped(.window);

pub const WindowConfig = struct {
    width: u32 = 1280,
    height: u32 = 720,
    title: [:0]const u8 = "three.zig",
};

pub const Window = struct {
    glfw_window: *zglfw.Window,
    window_provider: dawn.WindowProvider,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator, config: WindowConfig) !Window {
        if (builtin.os.tag == .linux) {
            try zglfw.initHint(.platform, zglfw.Platform.x11);
        }
        try zglfw.init();
        errdefer zglfw.terminate();

        zglfw.WindowHint.set(.client_api, .no_api);

        const glfw_window = try zglfw.createWindow(
            @intCast(config.width),
            @intCast(config.height),
            config.title,
            null,
            null,
        );
        errdefer zglfw.destroyWindow(glfw_window);

        const window_provider = dawn.WindowProvider{
            .window = @ptrCast(glfw_window),
            .fn_getTime = @ptrCast(&zglfw.getTime),
            .fn_getFramebufferSize = @ptrCast(&zglfw.Window.getFramebufferSize),
            .fn_getX11Display = @ptrCast(&zglfw.getX11Display),
            .fn_getX11Window = @ptrCast(&zglfw.getX11Window),
            .fn_getWaylandDisplay = @ptrCast(&zglfw.getWaylandDisplay),
            .fn_getWaylandSurface = @ptrCast(&zglfw.getWaylandWindow),
            .fn_getCocoaWindow = @ptrCast(&zglfw.getCocoaWindow),
            .fn_getWin32Window = @ptrCast(&zglfw.getWin32Window),
        };

        log.info("GLFW window created {}x{}", .{ config.width, config.height });

        glfw_window.show();
        glfw_window.focus();

        const fb = glfw_window.getFramebufferSize();
        const visible = zglfw.getWindowAttributeUntyped(glfw_window, .visible);
        log.info("framebuffer {}x{}, visible={}", .{ fb[0], fb[1], visible });

        return .{
            .glfw_window = glfw_window,
            .window_provider = window_provider,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Window) void {
        zglfw.destroyWindow(self.glfw_window);
        zglfw.terminate();
    }

    pub fn shouldClose(self: *const Window) bool {
        return self.glfw_window.shouldClose();
    }

    pub fn pollEvents(_: *Window) void {
        zglfw.pollEvents();
    }

    pub fn getSize(self: *const Window) struct { width: u32, height: u32 } {
        const size = self.glfw_window.getSize();
        return .{ .width = @intCast(size[0]), .height = @intCast(size[1]) };
    }

    pub fn getFramebufferSize(self: *const Window) struct { width: u32, height: u32 } {
        const size = self.glfw_window.getFramebufferSize();
        return .{ .width = @intCast(size[0]), .height = @intCast(size[1]) };
    }

    pub fn getContentScale(self: *const Window) f32 {
        const scale = self.glfw_window.getContentScale();
        return scale[0];
    }
};