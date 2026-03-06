const std = @import("std");

pub fn build(b: *std.Build) !void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // C headers
    const c = translateC(b, target, optimize);
    const c_mod = c.addModule("quickjs_c");

    // Library
    const lib = try library(b, target, optimize);
    b.installArtifact(lib);

    // Zig module
    const mod = b.addModule("quickjs", .{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{.{
            .name = "quickjs_c",
            .module = c_mod,
        }},
    });

    // Tests
    const tests = b.addTest(.{
        .root_module = mod,
        // Compiler crash without this.
        .use_llvm = true,
    });
    tests.linkLibrary(lib);
    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_tests.step);
}

pub fn translateC(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
) *std.Build.Step.TranslateC {
    const upstream = b.dependency("quickjs", .{});

    const translate = b.addTranslateC(.{
        .root_source_file = upstream.path("quickjs.h"),
        .target = target,
        .optimize = optimize,
    });

    translate.addIncludePath(upstream.path(""));

    // Zig's TranslateC doesn't pass --libc to the subprocess, so for
    // Android cross-compilation we must manually add NDK sysroot headers.
    if (target.result.abi == .android) {
        const ndk_root = std.process.getEnvVarOwned(b.allocator, "ANDROID_NDK_HOME") catch
            @as([]const u8, "/home/autark/android/android-ndk-r27c");
        const prebuilt = "/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include";
        const arch_include = if (target.result.cpu.arch.isAARCH64())
            "/aarch64-linux-android"
        else
            "/x86_64-linux-android";
        // Generic C headers (stdio.h, stdlib.h, etc.)
        translate.addSystemIncludePath(.{
            .cwd_relative = b.fmt("{s}{s}", .{ ndk_root, prebuilt }),
        });
        // Arch-specific headers
        translate.addSystemIncludePath(.{
            .cwd_relative = b.fmt("{s}{s}{s}", .{ ndk_root, prebuilt, arch_include }),
        });
    }

    return translate;
}

pub fn library(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
) !*std.Build.Step.Compile {
    const upstream = b.dependency("quickjs", .{});

    const lib = b.addLibrary(.{
        .name = "quickjs-ng",
        .root_module = b.createModule(.{
            .target = target,
            .optimize = optimize,
        }),
        .linkage = .static,
    });
    lib.linkLibC();

    lib.addIncludePath(upstream.path(""));
    lib.installHeader(
        upstream.path("quickjs.h"),
        "quickjs.h",
    );

    var flags: std.ArrayList([]const u8) = .empty;
    try flags.appendSlice(b.allocator, &.{
        "-D_GNU_SOURCE",
        "-funsigned-char",
        "-fno-omit-frame-pointer",
        "-fno-sanitize=undefined",
        "-fno-sanitize-trap=undefined",
        "-fvisibility=hidden",
    });
    lib.addCSourceFiles(.{
        .root = upstream.path(""),
        .files = &.{
            "cutils.c",
            "dtoa.c",
            "libregexp.c",
            "libunicode.c",
            "quickjs.c",
        },
        .flags = flags.items,
    });

    return lib;
}
