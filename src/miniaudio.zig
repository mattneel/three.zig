const std = @import("std");
const builtin = @import("builtin");

// C bindings for miniaudio
const c = @cImport({
    @cInclude("miniaudio.h");
});

// Android-specific bindings
const is_android = builtin.os.tag == .linux and builtin.abi == .android;
const android_c = if (is_android) @cImport({
    @cInclude("android/asset_manager.h");
}) else struct {};

// Global AAssetManager pointer for Android
var g_asset_manager: if (is_android) ?*android_c.AAssetManager else void = if (is_android) null else {};

pub fn setAssetManager(mgr: *anyopaque) void {
    if (is_android) {
        g_asset_manager = @ptrCast(@alignCast(mgr));
    }
}

// Background thread for audio operations
var audio_thread: ?std.Thread = null;
var audio_mutex = std.Thread.Mutex{};
var audio_condition = std.Thread.Condition{};
var audio_queue: [16]?AudioCommand = .{null} ** 16;
var audio_queue_mutex = std.Thread.Mutex{};
var audio_queue_head: usize = 0;
var audio_queue_tail: usize = 0;
var audio_running = false;

const AudioCommand = union(enum) {
    play_sound: struct {
        path: []const u8,
        result: *bool,
        done: *bool,
    },
    shutdown: void,
};

// Background thread function
fn audioThreadFunc() !void {
    std.log.info("Audio thread started", .{});
    
    while (audio_running) {
        // Get next command from queue
        audio_queue_mutex.lock();
        const cmd_opt = audio_queue[audio_queue_head];
        if (cmd_opt != null) {
            audio_queue[audio_queue_head] = null;
            audio_queue_head = (audio_queue_head + 1) % 16;
        }
        audio_queue_mutex.unlock();
        
        if (cmd_opt) |*cmd_ptr| {
            const cmd = cmd_ptr.*;
            switch (cmd) {
                .play_sound => |*play_cmd| {
                    std.log.info("Audio thread: Processing play_sound command: {s}", .{play_cmd.path});
                    // Execute audio play synchronously on background thread
                    const success = playSoundInternal(play_cmd.path);
                    play_cmd.result.* = success;
                    play_cmd.done.* = true;
                    std.log.info("Audio thread: Play sound completed, success={}", .{success});
                    
                    // Free allocated memory
                    std.heap.c_allocator.free(play_cmd.path);
                    std.heap.c_allocator.destroy(play_cmd.result);
                    std.heap.c_allocator.destroy(play_cmd.done);
                },
                .shutdown => {
                    std.log.info("Audio thread: Received shutdown command", .{});
                    audio_running = false;
                },
            }
        } else {
            // No command, wait for signal
            audio_mutex.lock();
            audio_condition.wait(&audio_mutex);
            audio_mutex.unlock();
        }
    }
    
    std.log.info("Audio thread exiting", .{});
}

// Internal blocking sound playback
fn playSoundInternal(path: []const u8) bool {
    std.log.info("playSoundInternal: Loading file: {s}", .{path});
    
    if (!g_initialized) {
        std.log.err("playSoundInternal: Audio not initialized", .{});
        return false;
    }
    
    // Unload previous decoder if exists
    if (g_decoder.outputFormat != 0) {
        std.log.info("playSoundInternal: Unloading previous decoder", .{});
        _ = c.ma_decoder_uninit(&g_decoder);
    }
    
    // Free previous audio data if exists
    if (g_audio_data) |data| {
        std.heap.c_allocator.free(data);
        g_audio_data = null;
    }
    
    // Stop the device if it's running
    if (c.ma_device_is_started(&g_device) != 0) {
        std.log.info("playSoundInternal: Stopping previous device", .{});
        _ = c.ma_device_stop(&g_device);
    }
    
    // Load the file (use AAssetManager on Android, file I/O on desktop)
    std.log.info("playSoundInternal: Initializing decoder", .{});
    const decoder_result = if (is_android) blk: {
        // On Android, load from AAssetManager into memory
        const audio_data = loadAudioDataFromAsset(path) orelse {
            std.log.err("Failed to load audio data from asset: {s}", .{path});
            break :blk c.MA_DOES_NOT_EXIST;
        };
        g_audio_data = audio_data;
        
        // Use memory-based decoding
        break :blk c.ma_decoder_init_memory(audio_data.ptr, audio_data.len, null, &g_decoder);
    } else blk: {
        // On desktop, use file-based decoding
        break :blk c.ma_decoder_init_file(path.ptr, null, &g_decoder);
    };
    
    if (decoder_result != c.MA_SUCCESS) {
        std.log.err("Failed to load audio: {s}, error={}", .{path, decoder_result});
        return false;
    }
    
    std.log.info("playSoundInternal: Decoder initialized successfully", .{});
    std.log.info("  Format: {}, Channels: {}, SampleRate: {}", .{g_decoder.outputFormat, g_decoder.outputChannels, g_decoder.outputSampleRate});
    
    // Seek to beginning
    _ = c.ma_decoder_seek_to_pcm_frame(&g_decoder, 0);
    
    // Initialize device with decoder's format
    std.log.info("playSoundInternal: Uninitializing previous device", .{});
    _ = c.ma_device_uninit(&g_device);
    
    std.log.info("playSoundInternal: Configuring audio device", .{});
    var deviceConfig = c.ma_device_config_init(c.ma_device_type_playback);
    deviceConfig.playback.format = g_decoder.outputFormat;
    deviceConfig.playback.channels = g_decoder.outputChannels;
    deviceConfig.sampleRate = g_decoder.outputSampleRate;
    deviceConfig.dataCallback = data_callback;
    deviceConfig.pUserData = &g_decoder;
    
    std.log.info("playSoundInternal: Initializing audio device", .{});
    const init_result = c.ma_device_init(null, &deviceConfig, &g_device);
    if (init_result != c.MA_SUCCESS) {
        std.log.err("Failed to initialize audio device, error={}", .{init_result});
        _ = c.ma_decoder_uninit(&g_decoder);
        return false;
    }
    
    std.log.info("playSoundInternal: Device initialized successfully", .{});
    
    std.log.info("playSoundInternal: Starting audio device", .{});
    const start_result = c.ma_device_start(&g_device);
    if (start_result != c.MA_SUCCESS) {
        std.log.err("Failed to start audio device, error={}", .{start_result});
        _ = c.ma_decoder_uninit(&g_decoder);
        return false;
    }
    
    std.log.info("playSoundInternal: Audio device started successfully", .{});
    return true;
}

// Error set for miniaudio operations
pub const Error = error{
    InitFailed,
    InvalidArgs,
    BackendNotSupported,
    FormatNotSupported,
    DeviceNotStarted,
    FileAccessFailed,
    DecodeFailed,
};

// Convert miniaudio result to Zig error
fn maToZigError(result: c_int) Error!void {
    return switch (result) {
        c.MA_SUCCESS => {},
        c.MA_ERROR => Error.InitFailed,
        c.MA_INVALID_ARGS => Error.InvalidArgs,
        c.MA_INVALID_OPERATION => Error.InitFailed,
        c.MA_OUT_OF_MEMORY => Error.InitFailed,
        c.MA_OUT_OF_RANGE => Error.InvalidArgs,
        c.MA_ACCESS_DENIED => Error.FileAccessFailed,
        c.MA_DOES_NOT_EXIST => Error.FileAccessFailed,
        c.MA_ALREADY_EXISTS => Error.InitFailed,
        c.MA_TOO_MANY_OPEN_FILES => Error.InitFailed,
        c.MA_INVALID_FILE => Error.FileAccessFailed,
        c.MA_TOO_BIG => Error.FileAccessFailed,
        c.MA_PATH_TOO_LONG => Error.FileAccessFailed,
        c.MA_NAME_TOO_LONG => Error.FileAccessFailed,
        c.MA_NOT_IMPLEMENTED => Error.BackendNotSupported,
        c.MA_AT_END => Error.DecodeFailed,
        c.MA_FORMAT_NOT_SUPPORTED => Error.FormatNotSupported,
        c.MA_DEVICE_TYPE_NOT_SUPPORTED => Error.InitFailed,
        c.MA_SHARE_MODE_NOT_SUPPORTED => Error.InitFailed,
        c.MA_NO_BACKEND => Error.InitFailed,
        c.MA_NO_DEVICE => Error.InitFailed,
        c.MA_API_NOT_FOUND => Error.InitFailed,
        c.MA_INVALID_DEVICE_CONFIG => Error.InitFailed,
        c.MA_DEVICE_NOT_INITIALIZED => Error.DeviceNotStarted,
        c.MA_DEVICE_NOT_STARTED => Error.DeviceNotStarted,
        else => Error.InitFailed,
    };
}

// Audio engine wrapper
pub const Engine = struct {
    engine: c.ma_engine,

    pub fn init(config: ?*const c.ma_engine_config) Error!Engine {
        var engine: Engine = undefined;
        const result = c.ma_engine_init(if (config) |cfg| cfg else null, &engine.engine);
        try maToZigError(result);
        return engine;
    }

    pub fn deinit(self: *Engine) void {
        c.ma_engine_uninit(&self.engine);
    }

    pub fn playSound(self: *Engine, path: [:0]const u8) Error!void {
        const result = c.ma_engine_play_sound(&self.engine, path, null);
        try maToZigError(result);
    }

    pub fn playSoundEx(self: *Engine, path: [:0]const u8, group: ?*c.ma_sound_group) Error!void {
        const result = c.ma_engine_play_sound(&self.engine, path, group);
        try maToZigError(result);
    }

    pub fn setVolume(self: *Engine, volume: f32) void {
        _ = c.ma_engine_set_volume(&self.engine, volume);
    }
};

// Simple sound playback wrapper
pub const Sound = struct {
    sound: c.ma_sound,

    pub fn initFromFile(engine: *c.ma_engine, path: [:0]const u8) Error!Sound {
        var sound: Sound = undefined;
        const result = c.ma_sound_init_from_file(engine, path, c.MA_SOUND_FLAG_DECODE, null, null, &sound.sound);
        try maToZigError(result);
        return sound;
    }

    pub fn deinit(self: *Sound) void {
        c.ma_sound_uninit(&self.sound);
    }

    pub fn start(self: *Sound) Error!void {
        const result = c.ma_sound_start(&self.sound);
        try maToZigError(result);
    }

    pub fn stop(self: *Sound) Error!void {
        const result = c.ma_sound_stop(&self.sound);
        try maToZigError(result);
    }

    pub fn setVolume(self: *Sound, volume: f32) void {
        c.ma_sound_set_volume(&self.sound, volume);
    }

    pub fn setPitch(self: *Sound, pitch: f32) void {
        c.ma_sound_set_pitch(&self.sound, pitch);
    }

    pub fn setPan(self: *Sound, pan: f32) void {
        c.ma_sound_set_pan(&self.sound, pan);
    }

    pub fn isPlaying(self: *const Sound) bool {
        return c.ma_sound_is_playing(&self.sound) != 0;
    }
};

// Simple decoder-based playback (like the simple playback example)
var g_decoder: c.ma_decoder = undefined;
var g_device: c.ma_device = undefined;
var g_initialized = false;

// Audio data buffer for Android assets
var g_audio_data: ?[]u8 = null;

// Load audio data from Android AAssetManager
fn loadAudioDataFromAsset(path: []const u8) ?[]u8 {
    if (!is_android) return null;
    const mgr = g_asset_manager orelse return null;

    std.log.info("Loading audio from asset: {s}", .{path});

    // AAssetManager_open needs a null-terminated string
    var path_buf: [1024]u8 = undefined;
    if (path.len >= path_buf.len) return null;
    @memcpy(path_buf[0..path.len], path);
    path_buf[path.len] = 0;

    const asset = android_c.AAssetManager_open(mgr, @ptrCast(path_buf[0..path.len :0]), android_c.AASSET_MODE_BUFFER) orelse {
        std.log.err("Failed to open asset: {s}", .{path});
        return null;
    };
    defer android_c.AAsset_close(asset);

    const len = android_c.AAsset_getLength(asset);
    if (len < 0) return null;
    const ulen: usize = @intCast(len);

    const max_size = 64 * 1024 * 1024; // 64MB limit
    if (ulen > max_size) {
        std.log.err("Audio file too large: {} bytes", .{ulen});
        return null;
    }

    const buf = std.heap.c_allocator.alloc(u8, ulen) catch {
        std.log.err("Failed to allocate memory for audio data", .{});
        return null;
    };

    const read = android_c.AAsset_read(asset, buf.ptr, ulen);
    if (read != len) {
        std.log.err("Failed to read complete audio data: {} != {}", .{read, len});
        std.heap.c_allocator.free(buf);
        return null;
    }

    std.log.info("Audio data loaded successfully: {} bytes", .{ulen});
    return buf;
}

export fn data_callback(pDevice: ?*c.ma_device, pOutput: ?*anyopaque, pInput: ?*const anyopaque, frameCount: c.ma_uint32) void {
    _ = pInput;
    const decoder: ?*c.ma_decoder = @ptrCast(@alignCast(pDevice.?.pUserData));
    if (decoder) |d| {
        var frames_read: c.ma_uint64 = 0;
        _ = c.ma_decoder_read_pcm_frames(d, pOutput, frameCount, &frames_read);
        
        if (frames_read < frameCount) {
            // Fill remaining with silence
            const bytes_per_frame = d.outputChannels * @as(usize, if (d.outputFormat == c.ma_format_f32) 4 else 2);
            const silence_start = @as([*]u8, @ptrCast(pOutput)) + @as(usize, @intCast(frames_read * bytes_per_frame));
            const silence_bytes = (frameCount - @as(c.ma_uint32, @intCast(frames_read))) * bytes_per_frame;
            @memset(silence_start[0..silence_bytes], 0);
        }
    } else {
        @memset(@as([*]u8, @ptrCast(pOutput))[0..(frameCount * 4)], 0); // Silence
    }
}

pub fn initAudio() Error!void {
    if (g_initialized) {
        std.log.info("Audio already initialized", .{});
        return;
    }

    std.log.info("Initializing audio system...", .{});
    
    // Start background audio thread
    audio_running = true;
    audio_thread = std.Thread.spawn(.{}, audioThreadFunc, .{}) catch |err| {
        std.log.err("Failed to spawn audio thread: {}", .{err});
        return Error.InitFailed;
    };
    
    std.log.info("Audio thread spawned successfully", .{});
    g_initialized = true;
}

pub fn playSound(path: [:0]const u8) Error!void {
    std.log.info("playSound: Called with path: {s}", .{path});
    
    if (!g_initialized) {
        std.log.err("playSound: Audio not initialized", .{});
        return Error.DeviceNotStarted;
    }
    
    // Allocate memory for the command (will be freed by background thread)
    const path_copy = std.heap.c_allocator.dupeZ(u8, path) catch {
        std.log.err("playSound: Failed to duplicate path", .{});
        return Error.InitFailed;
    };
    
    const result_ptr = std.heap.c_allocator.create(bool) catch {
        std.log.err("playSound: Failed to allocate result pointer", .{});
        std.heap.c_allocator.free(path_copy);
        return Error.InitFailed;
    };
    
    const done_ptr = std.heap.c_allocator.create(bool) catch {
        std.log.err("playSound: Failed to allocate done pointer", .{});
        std.heap.c_allocator.free(path_copy);
        std.heap.c_allocator.destroy(result_ptr);
        return Error.InitFailed;
    };
    
    result_ptr.* = false;
    done_ptr.* = false;
    
    // Create and enqueue the command
    const cmd = AudioCommand{ .play_sound = .{
        .path = path_copy,
        .result = result_ptr,
        .done = done_ptr,
    }};
    
    std.log.info("playSound: Enqueueing command", .{});
    audio_queue_mutex.lock();
    const next_tail = (audio_queue_tail + 1) % 16;
    if (next_tail == audio_queue_head) {
        // Queue full, drop the command
        std.log.err("playSound: Queue full, dropping command", .{});
        audio_queue_mutex.unlock();
        std.heap.c_allocator.free(path_copy);
        std.heap.c_allocator.destroy(result_ptr);
        std.heap.c_allocator.destroy(done_ptr);
        return Error.InitFailed;
    }
    audio_queue[audio_queue_tail] = cmd;
    audio_queue_tail = next_tail;
    audio_queue_mutex.unlock();
    
    std.log.info("playSound: Signaling audio thread", .{});
    // Signal the background thread
    audio_mutex.lock();
    audio_condition.signal();
    audio_mutex.unlock();
    
    std.log.info("playSound: Command queued successfully", .{});
    // Return immediately - audio plays in background
}

pub fn deinitAudio() void {
    if (!g_initialized) return;
    
    // Signal shutdown to background thread
    audio_running = false;
    audio_mutex.lock();
    audio_condition.signal();
    audio_mutex.unlock();
    
    // Wait for thread to finish
    if (audio_thread) |thread| {
        thread.join();
        audio_thread = null;
    }
    
    _ = c.ma_decoder_uninit(&g_decoder);
    _ = c.ma_device_uninit(&g_device);
    
    // Free audio data if exists
    if (g_audio_data) |data| {
        std.heap.c_allocator.free(data);
        g_audio_data = null;
    }
    
    g_initialized = false;
}

pub fn getEngine() ?*Engine {
    return null; // Not using engine API
}

pub fn setVolume(volume: f32) void {
    _ = c.ma_device_set_master_volume(&g_device, volume);
}