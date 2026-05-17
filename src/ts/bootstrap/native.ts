/**
 * Type declarations for the __native global bridge.
 *
 * These functions are registered by Zig into the QuickJS context
 * before bootstrap.js runs. The actual implementations will be
 * wired up in later tickets; for now this file serves as the
 * typed contract between TypeScript and Zig.
 */

export interface NativeBridge {
  /** Request the pre-created GPU adapter (returns an opaque handle ID). */
  gpuRequestAdapter?(): number;
  /** Request the pre-created GPU device (returns an opaque handle ID). */
  gpuRequestDevice?(adapterId: number): number;
  /** Get the pre-created queue for a device (returns an opaque handle ID). */
  gpuGetQueue?(deviceId: number): number;

  /** Get the current window/surface dimensions. */
  getWindowWidth?(): number;
  getWindowHeight?(): number;
  getDevicePixelRatio?(): number;

  /** Request the next animation frame. */
  requestAnimationFrame?(callback: (time: number) => void): number;
  cancelAnimationFrame?(id: number): void;

  /** Logging bridge. */
  log?(level: string, ...args: unknown[]): void;

  /** Read a file synchronously, returning raw bytes or null on failure. */
  readFileSync?(path: string): Uint8Array | null;

  /** Decode a base64 string to raw bytes, or null on invalid input. */
  decodeBase64?(data: string): Uint8Array | null;

  /** Perform an HTTP/HTTPS GET request, returning response info or null on error. */
  httpFetch?(url: string): {
    status: number;
    statusText: string;
    contentType: string;
    body: Uint8Array;
  } | null;

  /** Decode PNG/JPEG image bytes to RGBA pixels, or null on failure. */
  decodeImage?(data: Uint8Array): {
    width: number;
    height: number;
    data: Uint8Array;
  } | null;

  // --- T16: Buffer / Texture / Sampler creation & destruction ---

  /** Create a GPU buffer, returning an opaque handle ID. */
  gpuCreateBuffer?(deviceId: number, descriptor: object): number;
  /** Create a GPU texture, returning an opaque handle ID. */
  gpuCreateTexture?(deviceId: number, descriptor: object): number;
  /** Create a texture view from a texture, returning an opaque handle ID. */
  gpuCreateTextureView?(textureId: number, descriptor?: object): number;
  /** Create a GPU sampler, returning an opaque handle ID. */
  gpuCreateSampler?(deviceId: number, descriptor?: object): number;
  /** Unmap a previously mapped GPU buffer. */
  gpuBufferUnmap?(bufferId: number): void;
  /** Get the mapped range of a buffer as an ArrayBuffer (zero-copy). */
  gpuBufferGetMappedRange?(bufferId: number, offset: number, size: number): ArrayBuffer | null;
  /** Destroy a GPU buffer, releasing its handle. */
  gpuDestroyBuffer?(bufferId: number): void;
  /** Destroy a GPU texture, releasing its handle. */
  gpuDestroyTexture?(textureId: number): void;

  // --- T17: Shader / Pipeline / BindGroup creation ---

  /** Create a shader module from WGSL source, returning an opaque handle ID. */
  gpuCreateShaderModule?(deviceId: number, descriptor: object): number;
  /** Create a bind group layout, returning an opaque handle ID. */
  gpuCreateBindGroupLayout?(deviceId: number, descriptor: object): number;
  /** Create a pipeline layout, returning an opaque handle ID. */
  gpuCreatePipelineLayout?(deviceId: number, descriptor: object): number;
  /** Create a render pipeline, returning an opaque handle ID. */
  gpuCreateRenderPipeline?(deviceId: number, descriptor: object): number;
  /** Create a compute pipeline, returning an opaque handle ID. */
  gpuCreateComputePipeline?(deviceId: number, descriptor: object): number;
  /** Create a bind group, returning an opaque handle ID. */
  gpuCreateBindGroup?(deviceId: number, descriptor: object): number;

  // --- T18: Command encoding / render pass ---

  /** Create a command encoder, returning an opaque handle ID. */
  gpuCreateCommandEncoder?(deviceId: number): number;
  /** Begin a render pass on a command encoder, returning a render pass handle ID. */
  gpuCommandEncoderBeginRenderPass?(encoderId: number, descriptor: object): number;
  /** Set the pipeline on a render pass encoder. */
  gpuRenderPassSetPipeline?(passId: number, pipelineId: number): void;
  /** Set a bind group on a render pass encoder. */
  gpuRenderPassSetBindGroup?(passId: number, index: number, bindGroupId: number): void;
  /** Set a vertex buffer on a render pass encoder. */
  gpuRenderPassSetVertexBuffer?(passId: number, slot: number, bufferId: number, offset?: number, size?: number): void;
  /** Set the index buffer on a render pass encoder. */
  gpuRenderPassSetIndexBuffer?(passId: number, bufferId: number, format: string, offset?: number, size?: number): void;
  /** Record a draw call on a render pass encoder. */
  gpuRenderPassDraw?(passId: number, vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  /** Record an indexed draw call on a render pass encoder. */
  gpuRenderPassDrawIndexed?(passId: number, indexCount: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number): void;
  /** Set the viewport on a render pass encoder. */
  gpuRenderPassSetViewport?(passId: number, x: number, y: number, width: number, height: number, minDepth: number, maxDepth: number): void;
  /** Set the scissor rect on a render pass encoder. */
  gpuRenderPassSetScissorRect?(passId: number, x: number, y: number, width: number, height: number): void;
  /** End a render pass, freeing the render pass handle. */
  gpuRenderPassEnd?(passId: number): void;
  /** Finish command encoding, returning a command buffer handle ID. */
  gpuCommandEncoderFinish?(encoderId: number): number;
  /** Submit command buffers to a queue. */
  gpuQueueSubmit?(queueId: number, commandBuffers: number[]): void;

  // --- T22: Queue write operations + pipeline introspection ---

  /** Write data to a GPU buffer. */
  gpuQueueWriteBuffer?(queueId: number, bufferId: number, bufferOffset: number, data: ArrayBuffer | ArrayBufferView, dataOffset: number, size: number): void;
  /** Write data to a GPU texture. */
  gpuQueueWriteTexture?(queueId: number, destination: object, data: ArrayBuffer | ArrayBufferView, dataLayout: object, size: object): void;
  /** Get the bind group layout at the given index from a render pipeline. */
  gpuRenderPipelineGetBindGroupLayout?(pipelineId: number, index: number): number;
  /** Get the bind group layout at the given index from a compute pipeline. */
  gpuComputePipelineGetBindGroupLayout?(pipelineId: number, index: number): number;

  // --- T19: WebGPU present / swap chain ---

  /** Configure the GPU canvas context surface. */
  gpuConfigureContext?(deviceId: number, format: string, alphaMode: string, width: number, height: number): void;
  /** Unconfigure the GPU canvas context surface. */
  gpuCanvasUnconfigure?(deviceId: number): void;
  /** Get the current swap chain texture, returning an opaque handle ID. */
  gpuGetCurrentTexture?(): number;
  /** Signal frame present after queue.submit. */
  gpuPresent?(): void;

  // --- Additional WebGPU API coverage ---

  /** Set the debug label on any GPU object handle. */
  gpuSetLabel?(handleId: number, label: string): void;
  /** Get adapter info (vendor, architecture, device, description, etc.). */
  gpuGetAdapterInfo?(adapterId: number): object;
  /** Get WGSL language features. */
  gpuGetWgslLanguageFeatures?(): object;
  /** Get device lost state (null if not lost). */
  gpuGetDeviceLostState?(deviceId: number): object | null;
  /** Begin a compute pass. */
  gpuCommandEncoderBeginComputePass?(encoderId: number, descriptor?: object): number;
  /** Copy buffer to texture. */
  gpuCommandEncoderCopyBufferToTexture?(encoderId: number, source: object, destination: object, copySize: object): void;
  /** Copy texture to buffer. */
  gpuCommandEncoderCopyTextureToBuffer?(encoderId: number, source: object, destination: object, copySize: object): void;
  /** Copy texture to texture. */
  gpuCommandEncoderCopyTextureToTexture?(encoderId: number, source: object, destination: object, copySize: object): void;
  /** Clear a buffer region. */
  gpuCommandEncoderClearBuffer?(encoderId: number, bufferId: number, offset: number, size: number): void;
  /** Draw indirect on render pass. */
  gpuRenderPassDrawIndirect?(passId: number, indirectBufferId: number, indirectOffset: number): void;
  /** Draw indexed indirect on render pass. */
  gpuRenderPassDrawIndexedIndirect?(passId: number, indirectBufferId: number, indirectOffset: number): void;
  /** Set blend constant on render pass. */
  gpuRenderPassSetBlendConstant?(passId: number, color: object): void;
  /** Set stencil reference on render pass. */
  gpuRenderPassSetStencilReference?(passId: number, reference: number): void;
  /** Execute render bundles on render pass. */
  gpuRenderPassExecuteBundles?(passId: number, bundleIds: number[]): void;
  /** Set pipeline on compute pass. */
  gpuComputePassEncoderSetPipeline?(passId: number, pipelineId: number): void;
  /** Set bind group on compute pass. */
  gpuComputePassEncoderSetBindGroup?(passId: number, index: number, bindGroupId: number, offsets?: number[]): void;
  /** Dispatch workgroups on compute pass. */
  gpuComputePassEncoderDispatchWorkgroups?(passId: number, x: number, y?: number, z?: number): void;
  /** Dispatch workgroups indirect on compute pass. */
  gpuComputePassEncoderDispatchWorkgroupsIndirect?(passId: number, indirectBufferId: number, indirectOffset: number): void;
  /** End a compute pass. */
  gpuComputePassEncoderEnd?(passId: number): void;
  /** Create a render bundle encoder. */
  gpuCreateRenderBundleEncoder?(deviceId: number, descriptor: object): number;
  /** Finish a render bundle encoder, returning bundle handle. */
  gpuRenderBundleEncoderFinish?(encoderId: number): number;
  /** Create a query set. */
  gpuCreateQuerySet?(deviceId: number, descriptor: object): number;
  /** Destroy a query set. */
  gpuQuerySetDestroy?(querySetId: number): void;
  /** Destroy a GPU device. */
  gpuDeviceDestroy?(deviceId: number): void;
  /** Push an error scope on a device. */
  gpuDevicePushErrorScope?(deviceId: number, filter: string): void;
  /** Pop an error scope on a device. */
  gpuDevicePopErrorScope?(deviceId: number): void;
  /** Map a buffer asynchronously. */
  gpuBufferMapAsync?(bufferId: number, mode: number, offset: number, size: number): void;
  /** Get buffer size. */
  gpuBufferGetSize?(bufferId: number): number;
  /** Get buffer usage flags. */
  gpuBufferGetUsage?(bufferId: number): number;
  /** Get texture width. */
  gpuTextureGetWidth?(textureId: number): number;
  /** Get texture height. */
  gpuTextureGetHeight?(textureId: number): number;
  /** Get texture format enum value. */
  gpuTextureGetFormat?(textureId: number): number;
  /** Get shader module compilation info. */
  gpuShaderModuleGetCompilationInfo?(shaderModuleId: number): object;
  /** Create a render pipeline asynchronously (returns Promise<number>). */
  gpuCreateRenderPipelineAsync?(deviceId: number, descriptor: object): Promise<number>;
  /** Create a compute pipeline asynchronously (returns Promise<number>). */
  gpuCreateComputePipelineAsync?(deviceId: number, descriptor: object): Promise<number>;
  /** Signal on-submitted-work-done on a queue. */
  gpuQueueOnSubmittedWorkDone?(queueId: number): void;

  // --- Audio functions ---

  /** Initialize the audio engine. */
  audioInit?(): boolean;
  /** Shutdown the audio engine. */
  audioShutdown?(): void;
  /** Play a sound file. */
  audioPlaySound?(path: string): boolean;
  /** Set volume for audio engine (0.0 to 1.0). */
  audioSetVolume?(volume: number): void;
}

/**
 * The __native global, if registered by the Zig host.
 * May be undefined if bootstrap is evaluated in a plain QuickJS context
 * without native bindings (e.g., during testing).
 */
declare const __native: NativeBridge | undefined;

export function getNative(): NativeBridge | undefined {
  return typeof __native !== "undefined" ? __native : undefined;
}
