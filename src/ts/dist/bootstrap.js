"use strict";
(() => {
  // bootstrap/event-target.ts
  var EventTarget = class {
    _listeners = /* @__PURE__ */ new Map();
    addEventListener(type, callback, options) {
      if (callback === null) return;
      const { capture, once, passive } = normalizeOptions(options);
      let list = this._listeners.get(type);
      if (!list) {
        list = [];
        this._listeners.set(type, list);
      }
      const cb = callback;
      for (const entry of list) {
        if (entry.callback === cb && entry.capture === capture) {
          return;
        }
      }
      list.push({ callback: cb, capture, once, passive });
    }
    removeEventListener(type, callback, options) {
      if (callback === null) return;
      const { capture } = normalizeOptions(options);
      const list = this._listeners.get(type);
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        if (list[i].callback === callback && list[i].capture === capture) {
          list.splice(i, 1);
          if (list.length === 0) {
            this._listeners.delete(type);
          }
          return;
        }
      }
    }
    dispatchEvent(event) {
      event._target = this;
      event._currentTarget = this;
      const list = this._listeners.get(event.type);
      if (!list) return !event.defaultPrevented;
      const entries = list.slice();
      for (const entry of entries) {
        if (event._stopImmediate) break;
        if (entry.once) {
          this.removeEventListener(event.type, entry.callback, {
            capture: entry.capture
          });
        }
        if (typeof entry.callback === "function") {
          entry.callback.call(this, event);
        } else {
          entry.callback.handleEvent(event);
        }
      }
      return !event.defaultPrevented;
    }
  };
  function normalizeOptions(options) {
    if (typeof options === "boolean") {
      return { capture: options, once: false, passive: false };
    }
    return {
      capture: options?.capture ?? false,
      once: options?.once ?? false,
      passive: options?.passive ?? false
    };
  }

  // bootstrap/events.ts
  var Event = class {
    type;
    bubbles;
    cancelable;
    timeStamp;
    defaultPrevented = false;
    /** @internal set by EventTarget.dispatchEvent */
    _target = null;
    /** @internal set by EventTarget.dispatchEvent */
    _currentTarget = null;
    /** @internal */
    _stopProp = false;
    /** @internal */
    _stopImmediate = false;
    get target() {
      return this._target;
    }
    get currentTarget() {
      return this._currentTarget;
    }
    constructor(type, init) {
      this.type = type;
      this.bubbles = init?.bubbles ?? false;
      this.cancelable = init?.cancelable ?? false;
      this.timeStamp = Date.now();
    }
    preventDefault() {
      if (this.cancelable) {
        this.defaultPrevented = true;
      }
    }
    stopPropagation() {
      this._stopProp = true;
    }
    stopImmediatePropagation() {
      this._stopProp = true;
      this._stopImmediate = true;
    }
  };
  var PointerEvent = class extends Event {
    clientX;
    clientY;
    pageX;
    pageY;
    movementX;
    movementY;
    button;
    buttons;
    pointerId;
    pointerType;
    constructor(type, init) {
      super(type, init);
      this.clientX = init?.clientX ?? 0;
      this.clientY = init?.clientY ?? 0;
      this.pageX = init?.clientX ?? 0;
      this.pageY = init?.clientY ?? 0;
      this.movementX = init?.movementX ?? 0;
      this.movementY = init?.movementY ?? 0;
      this.button = init?.button ?? 0;
      this.buttons = init?.buttons ?? 0;
      this.pointerId = init?.pointerId ?? 0;
      this.pointerType = init?.pointerType ?? "";
    }
  };
  var WheelEvent = class extends Event {
    deltaX;
    deltaY;
    deltaZ;
    deltaMode;
    constructor(type, init) {
      super(type, init);
      this.deltaX = init?.deltaX ?? 0;
      this.deltaY = init?.deltaY ?? 0;
      this.deltaZ = init?.deltaZ ?? 0;
      this.deltaMode = init?.deltaMode ?? 0;
    }
  };
  var KeyboardEvent = class extends Event {
    key;
    code;
    altKey;
    ctrlKey;
    metaKey;
    shiftKey;
    repeat;
    constructor(type, init) {
      super(type, init);
      this.key = init?.key ?? "";
      this.code = init?.code ?? "";
      this.altKey = init?.altKey ?? false;
      this.ctrlKey = init?.ctrlKey ?? false;
      this.metaKey = init?.metaKey ?? false;
      this.shiftKey = init?.shiftKey ?? false;
      this.repeat = init?.repeat ?? false;
    }
  };

  // bootstrap/native.ts
  function getNative() {
    return typeof __native !== "undefined" ? __native : void 0;
  }

  // bootstrap/gpu.ts
  function unwrapHandles(obj) {
    if (obj === null || obj === void 0) return obj;
    if (typeof obj !== "object") return obj;
    if (typeof obj._handle === "number") return obj._handle;
    if (ArrayBuffer.isView(obj) || obj instanceof ArrayBuffer) return obj;
    if (Array.isArray(obj)) return obj.map(unwrapHandles);
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = unwrapHandles(obj[key]);
    }
    return result;
  }
  var GPUBuffer = class {
    _handle;
    _device;
    size;
    usage;
    constructor(handle, device, size, usage) {
      this._handle = handle;
      this._device = device;
      this.size = size;
      this.usage = usage;
    }
    async mapAsync(mode, offset, size) {
      const native = getNative();
      native?.gpuBufferMapAsync?.(this._handle, mode ?? 1, offset ?? 0, size ?? this.size);
    }
    getMappedRange(offset, size) {
      const native = getNative();
      const ab = native?.gpuBufferGetMappedRange?.(this._handle, offset ?? 0, size ?? this.size);
      if (ab) return ab;
      return new ArrayBuffer(size ?? this.size);
    }
    get mapState() {
      return "unmapped";
    }
    unmap() {
      const native = getNative();
      native?.gpuBufferUnmap?.(this._handle);
    }
    destroy() {
      const native = getNative();
      native?.gpuDestroyBuffer?.(this._handle);
    }
    get label() {
      return "";
    }
    set label(_v) {
      const native = getNative();
      native?.gpuSetLabel?.(this._handle, _v);
    }
  };
  var GPUTextureView = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
    get label() {
      return "";
    }
    set label(_v) {
      getNative()?.gpuSetLabel?.(this._handle, _v);
    }
  };
  var GPUTexture = class {
    _handle;
    _device;
    width;
    height;
    depthOrArrayLayers;
    mipLevelCount;
    sampleCount;
    dimension;
    format;
    usage;
    constructor(handle, device, descriptor) {
      this._handle = handle;
      this._device = device;
      this.width = descriptor?.width ?? 0;
      this.height = descriptor?.height ?? 1;
      this.depthOrArrayLayers = descriptor?.depthOrArrayLayers ?? 1;
      this.mipLevelCount = descriptor?.mipLevelCount ?? 1;
      this.sampleCount = descriptor?.sampleCount ?? 1;
      this.dimension = descriptor?.dimension ?? "2d";
      this.format = descriptor?.format ?? "rgba8unorm";
      this.usage = descriptor?.usage ?? 0;
    }
    createView(descriptor) {
      const native = getNative();
      const d = descriptor;
      if (d?.baseMipLevel !== void 0 || d?.mipLevelCount !== void 0) {
      }
      const handle = native?.gpuCreateTextureView?.(this._handle, descriptor ?? {}) ?? 0;
      return new GPUTextureView(handle);
    }
    destroy() {
      const native = getNative();
      native?.gpuDestroyTexture?.(this._handle);
    }
    get label() {
      return "";
    }
    set label(_v) {
      const native = getNative();
      native?.gpuSetLabel?.(this._handle, _v);
    }
  };
  var GPUCanvasContext = class {
    _configured = false;
    _device = null;
    _format = getNative()?.gpuGetPreferredCanvasFormat?.() ?? "bgra8unorm";
    _width = 0;
    _height = 0;
    configure(config) {
      this._device = config.device;
      this._format = config.format ?? getNative()?.gpuGetPreferredCanvasFormat?.() ?? "bgra8unorm";
      this._configured = true;
      const g2 = globalThis;
      this._width = g2?.window?.innerWidth ?? 0;
      this._height = g2?.window?.innerHeight ?? 0;
      const native = getNative();
      native?.gpuConfigureContext?.(
        config.device._handle,
        this._format,
        config.alphaMode ?? "opaque",
        this._width,
        this._height
      );
    }
    unconfigure() {
      this._configured = false;
      const native = getNative();
      if (this._device) {
        native?.gpuCanvasUnconfigure?.(this._device._handle);
      }
      this._device = null;
    }
    getCurrentTexture() {
      const native = getNative();
      const handle = native?.gpuGetCurrentTexture?.() ?? 0;
      return new GPUTexture(handle, this._device, {
        format: this._format,
        usage: 16
        // GPUTextureUsage.RENDER_ATTACHMENT
      });
    }
    // Internal: called by event loop after queue.submit
    present() {
      const native = getNative();
      native?.gpuPresent?.();
    }
    get configured() {
      return this._configured;
    }
  };
  var GPUSampler = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
  };
  var GPUShaderModule = class {
    _handle;
    _code;
    constructor(handle, code = "") {
      this._handle = handle;
      this._code = code;
    }
    async getCompilationInfo() {
      const native = getNative();
      return native?.gpuShaderModuleGetCompilationInfo?.(this._handle) ?? {};
    }
  };
  var GPUBindGroupLayout = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
  };
  var GPUPipelineLayout = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
  };
  var GPUBindGroup = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
  };
  var GPURenderPipeline = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
    getBindGroupLayout(index) {
      const native = getNative();
      const handle = native?.gpuRenderPipelineGetBindGroupLayout?.(this._handle, index) ?? 0;
      return new GPUBindGroupLayout(handle);
    }
  };
  var GPUComputePipeline = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
    getBindGroupLayout(index) {
      const native = getNative();
      const handle = native?.gpuComputePipelineGetBindGroupLayout?.(this._handle, index) ?? 0;
      return new GPUBindGroupLayout(handle);
    }
  };
  var GPUQuerySet = class {
    _handle;
    type;
    count;
    constructor(handle, type, count) {
      this._handle = handle;
      this.type = type;
      this.count = count;
    }
    destroy() {
      const native = getNative();
      native?.gpuQuerySetDestroy?.(this._handle);
    }
  };
  var GPURenderBundle = class {
    _handle;
    _commands;
    constructor(handle, commands) {
      this._handle = handle;
      this._commands = commands;
    }
  };
  var GPURenderBundleEncoder = class {
    _handle;
    _commands = [];
    constructor(handle) {
      this._handle = handle;
    }
    setPipeline(pipeline) {
      this._commands.push({ op: "setPipeline", args: [pipeline] });
    }
    setBindGroup(index, bindGroup) {
      this._commands.push({ op: "setBindGroup", args: [index, bindGroup] });
    }
    setVertexBuffer(slot, buffer, offset, size) {
      this._commands.push({ op: "setVertexBuffer", args: [slot, buffer, offset, size] });
    }
    setIndexBuffer(buffer, format, offset, size) {
      this._commands.push({ op: "setIndexBuffer", args: [buffer, format, offset, size] });
    }
    draw(vertexCount, instanceCount, firstVertex, firstInstance) {
      this._commands.push({ op: "draw", args: [vertexCount, instanceCount, firstVertex, firstInstance] });
    }
    drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance) {
      this._commands.push({ op: "drawIndexed", args: [indexCount, instanceCount, firstIndex, baseVertex, firstInstance] });
    }
    finish() {
      const native = getNative();
      const handle = native?.gpuRenderBundleEncoderFinish?.(this._handle) ?? 0;
      return new GPURenderBundle(handle, this._commands);
    }
  };
  var GPUCommandBuffer = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
  };
  var GPURenderPassEncoder = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
    setPipeline(pipeline) {
      const native = getNative();
      native?.gpuRenderPassSetPipeline?.(this._handle, pipeline._handle);
    }
    setBindGroup(index, bindGroup, ...rest) {
      if (!bindGroup) return;
      const native = getNative();
      native?.gpuRenderPassSetBindGroup?.(this._handle, index, bindGroup._handle);
    }
    setVertexBuffer(slot, buffer, offset, size) {
      const native = getNative();
      native?.gpuRenderPassSetVertexBuffer?.(this._handle, slot, buffer._handle, offset, size);
    }
    setIndexBuffer(buffer, format, offset, size) {
      const native = getNative();
      native?.gpuRenderPassSetIndexBuffer?.(this._handle, buffer._handle, format, offset, size);
    }
    draw(vertexCount, instanceCount, firstVertex, firstInstance) {
      const native = getNative();
      native?.gpuRenderPassDraw?.(this._handle, vertexCount, instanceCount, firstVertex, firstInstance);
    }
    drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance) {
      const native = getNative();
      native?.gpuRenderPassDrawIndexed?.(this._handle, indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
    }
    drawIndirect(indirectBuffer, indirectOffset) {
      const native = getNative();
      native?.gpuRenderPassDrawIndirect?.(this._handle, indirectBuffer._handle, indirectOffset ?? 0);
    }
    drawIndexedIndirect(indirectBuffer, indirectOffset) {
      const native = getNative();
      native?.gpuRenderPassDrawIndexedIndirect?.(this._handle, indirectBuffer._handle, indirectOffset ?? 0);
    }
    setViewport(x, y, width, height, minDepth, maxDepth) {
      const native = getNative();
      native?.gpuRenderPassSetViewport?.(this._handle, x, y, width, height, minDepth, maxDepth);
    }
    setScissorRect(x, y, width, height) {
      const native = getNative();
      native?.gpuRenderPassSetScissorRect?.(this._handle, x, y, width, height);
    }
    setBlendConstant(color) {
      const native = getNative();
      let c = color;
      if (Array.isArray(c)) c = { r: c[0], g: c[1], b: c[2], a: c[3] };
      native?.gpuRenderPassSetBlendConstant?.(this._handle, c);
    }
    setStencilReference(reference) {
      const native = getNative();
      native?.gpuRenderPassSetStencilReference?.(this._handle, reference);
    }
    executeBundles(bundles) {
      const native = getNative();
      const handles = bundles.filter((b) => b && b._handle > 0).map((b) => b._handle);
      if (handles.length > 0 && native?.gpuRenderPassExecuteBundles) {
        native.gpuRenderPassExecuteBundles(this._handle, handles);
        return;
      }
      for (const bundle of bundles) {
        if (!bundle || !bundle._commands) continue;
        for (const cmd of bundle._commands) {
          const method = this[cmd.op];
          if (typeof method === "function") {
            method.apply(this, cmd.args);
          }
        }
      }
    }
    end() {
      const native = getNative();
      native?.gpuRenderPassEnd?.(this._handle);
    }
  };
  var GPUComputePassEncoder = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
    setPipeline(pipeline) {
      const native = getNative();
      native?.gpuComputePassEncoderSetPipeline?.(this._handle, pipeline._handle);
    }
    setBindGroup(index, bindGroup, offsets) {
      const native = getNative();
      native?.gpuComputePassEncoderSetBindGroup?.(this._handle, index, bindGroup._handle, offsets);
    }
    dispatchWorkgroups(x, y, z) {
      const native = getNative();
      native?.gpuComputePassEncoderDispatchWorkgroups?.(this._handle, x, y, z);
    }
    dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset) {
      const native = getNative();
      native?.gpuComputePassEncoderDispatchWorkgroupsIndirect?.(this._handle, indirectBuffer._handle, indirectOffset ?? 0);
    }
    end() {
      const native = getNative();
      native?.gpuComputePassEncoderEnd?.(this._handle);
    }
  };
  var GPUCommandEncoder = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
    beginRenderPass(descriptor) {
      const native = getNative();
      const handle = native?.gpuCommandEncoderBeginRenderPass?.(this._handle, unwrapHandles(descriptor)) ?? 0;
      return new GPURenderPassEncoder(handle);
    }
    beginComputePass(descriptor) {
      const native = getNative();
      const handle = native?.gpuCommandEncoderBeginComputePass?.(this._handle, descriptor ?? {}) ?? 0;
      return new GPUComputePassEncoder(handle);
    }
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      const native = getNative();
      native?.gpuCommandEncoderCopyBufferToBuffer?.(
        this._handle,
        source._handle,
        sourceOffset,
        destination._handle,
        destinationOffset,
        size
      );
    }
    copyBufferToTexture(source, destination, copySize) {
      const native = getNative();
      native?.gpuCommandEncoderCopyBufferToTexture?.(this._handle, unwrapHandles(source), unwrapHandles(destination), copySize);
    }
    copyTextureToBuffer(source, destination, copySize) {
      const native = getNative();
      native?.gpuCommandEncoderCopyTextureToBuffer?.(this._handle, unwrapHandles(source), unwrapHandles(destination), copySize);
    }
    copyTextureToTexture(source, destination, copySize) {
      const native = getNative();
      native?.gpuCommandEncoderCopyTextureToTexture?.(this._handle, unwrapHandles(source), unwrapHandles(destination), copySize);
    }
    clearBuffer(buffer, offset, size) {
      const native = getNative();
      native?.gpuCommandEncoderClearBuffer?.(this._handle, buffer._handle, offset ?? 0, size ?? 0);
    }
    resolveQuerySet(_querySet, _firstQuery, _queryCount, _destination, _destinationOffset) {
    }
    finish() {
      const native = getNative();
      const handle = native?.gpuCommandEncoderFinish?.(this._handle) ?? 0;
      return new GPUCommandBuffer(handle);
    }
  };
  var GPUQueue = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
    submit(commandBuffers) {
      const native = getNative();
      const handles = commandBuffers.map((cb) => cb._handle);
      native?.gpuQueueSubmit?.(this._handle, handles);
    }
    writeBuffer(buffer, bufferOffset, data, dataOffset, size) {
      const native = getNative();
      let byteOffset = 0;
      let byteSize = 0;
      if (ArrayBuffer.isView(data)) {
        const bpe = data.BYTES_PER_ELEMENT ?? 1;
        byteOffset = (dataOffset ?? 0) * bpe;
        if (size !== void 0) {
          byteSize = size * bpe;
        } else {
          byteSize = data.byteLength - byteOffset;
        }
      } else {
        byteOffset = dataOffset ?? 0;
        byteSize = size ?? data.byteLength - byteOffset;
      }
      native?.gpuQueueWriteBuffer?.(this._handle, buffer._handle, bufferOffset, data, byteOffset, byteSize);
    }
    writeTexture(destination, data, dataLayout, size) {
      const native = getNative();
      const unwrapped = unwrapHandles(destination);
      native?.gpuQueueWriteTexture?.(this._handle, unwrapped, data, dataLayout, size);
    }
    copyExternalImageToTexture(source, destination, copySize) {
      const img = source.source;
      if (!img || !img._data) {
        return;
      }
      const data = img._data;
      const srcWidth = img.width;
      const srcHeight = img.height;
      let w, h;
      if (Array.isArray(copySize)) {
        w = copySize[0] ?? srcWidth;
        h = copySize[1] ?? srcHeight;
      } else if (copySize && typeof copySize === "object") {
        w = copySize.width ?? srcWidth;
        h = copySize.height ?? srcHeight;
      } else {
        w = srcWidth;
        h = srcHeight;
      }
      const srcOrigin = source.origin;
      let srcX = 0, srcY = 0;
      if (Array.isArray(srcOrigin)) {
        srcX = srcOrigin[0] ?? 0;
        srcY = srcOrigin[1] ?? 0;
      } else if (srcOrigin && typeof srcOrigin === "object") {
        srcX = srcOrigin.x ?? 0;
        srcY = srcOrigin.y ?? 0;
      }
      let uploadData;
      if (srcX === 0 && srcY === 0 && w === srcWidth && h === srcHeight) {
        uploadData = data;
      } else {
        uploadData = new Uint8Array(w * h * 4);
        for (let row = 0; row < h; row++) {
          const srcOff = ((srcY + row) * srcWidth + srcX) * 4;
          const dstOff = row * w * 4;
          uploadData.set(data.subarray(srcOff, srcOff + w * 4), dstOff);
        }
      }
      this.writeTexture(
        destination,
        uploadData,
        { bytesPerRow: w * 4, rowsPerImage: h },
        { width: w, height: h, depthOrArrayLayers: 1 }
      );
    }
    onSubmittedWorkDone() {
      const native = getNative();
      native?.gpuQueueOnSubmittedWorkDone?.(this._handle);
      return Promise.resolve();
    }
  };
  var GPUDevice = class extends EventTarget {
    _handle;
    queue;
    features;
    limits;
    lost;
    constructor(handle) {
      super();
      const native = getNative();
      const queueHandle = native?.gpuGetQueue?.(handle) ?? 0;
      this._handle = handle;
      this.queue = new GPUQueue(queueHandle);
      this.features = /* @__PURE__ */ new Set([
        "core-features-and-limits",
        "depth-clip-control",
        "depth32float-stencil8",
        "texture-compression-bc",
        "indirect-first-instance",
        "rg11b10ufloat-renderable",
        "bgra8unorm-storage",
        "float32-filterable",
        "subgroups"
      ]);
      this.limits = {
        maxTextureDimension1D: 8192,
        maxTextureDimension2D: 8192,
        maxTextureDimension3D: 2048,
        maxTextureArrayLayers: 256,
        maxBindGroups: 4,
        maxBindGroupsPlusVertexBuffers: 24,
        maxBindingsPerBindGroup: 1e3,
        maxDynamicUniformBuffersPerPipelineLayout: 10,
        maxDynamicStorageBuffersPerPipelineLayout: 8,
        maxSampledTexturesPerShaderStage: 16,
        maxSamplersPerShaderStage: 16,
        maxStorageBuffersPerShaderStage: 8,
        maxStorageTexturesPerShaderStage: 4,
        maxUniformBuffersPerShaderStage: 12,
        maxUniformBufferBindingSize: 65536,
        maxStorageBufferBindingSize: 134217728,
        minUniformBufferOffsetAlignment: 256,
        minStorageBufferOffsetAlignment: 256,
        maxVertexBuffers: 8,
        maxBufferSize: 268435456,
        maxVertexAttributes: 16,
        maxVertexBufferArrayStride: 2048,
        maxInterStageShaderComponents: 60,
        maxInterStageShaderVariables: 16,
        maxColorAttachments: 8,
        maxColorAttachmentBytesPerSample: 32,
        maxComputeWorkgroupStorageSize: 16384,
        maxComputeInvocationsPerWorkgroup: 256,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
        maxComputeWorkgroupsPerDimension: 65535
      };
      this.lost = new Promise(() => {
      });
    }
    get adapterInfo() {
      const native = getNative();
      return native?.gpuGetAdapterInfo?.(0) ?? {};
    }
    destroy() {
      const native = getNative();
      native?.gpuDeviceDestroy?.(this._handle);
    }
    pushErrorScope(filter) {
      const native = getNative();
      native?.gpuDevicePushErrorScope?.(this._handle, filter);
    }
    popErrorScope() {
      const native = getNative();
      native?.gpuDevicePopErrorScope?.(this._handle);
      return Promise.resolve(null);
    }
    // --- T16: Resource creation ---
    createBuffer(descriptor) {
      const native = getNative();
      const handle = native?.gpuCreateBuffer?.(this._handle, descriptor) ?? 0;
      return new GPUBuffer(handle, this, descriptor.size, descriptor.usage);
    }
    createTexture(descriptor) {
      const native = getNative();
      const handle = native?.gpuCreateTexture?.(this._handle, descriptor) ?? 0;
      let w = 0, h = 1, d = 1;
      if (descriptor?.size) {
        if (Array.isArray(descriptor.size)) {
          w = descriptor.size[0] ?? 0;
          h = descriptor.size[1] ?? 1;
          d = descriptor.size[2] ?? 1;
        } else {
          w = descriptor.size.width ?? 0;
          h = descriptor.size.height ?? 1;
          d = descriptor.size.depthOrArrayLayers ?? 1;
        }
      }
      return new GPUTexture(handle, this, {
        width: w,
        height: h,
        depthOrArrayLayers: d,
        mipLevelCount: descriptor?.mipLevelCount,
        sampleCount: descriptor?.sampleCount,
        dimension: descriptor?.dimension,
        format: descriptor?.format,
        usage: descriptor?.usage
      });
    }
    createSampler(descriptor) {
      const native = getNative();
      const handle = native?.gpuCreateSampler?.(this._handle, descriptor ?? {}) ?? 0;
      return new GPUSampler(handle);
    }
    // --- T17: Shader & pipeline creation ---
    createShaderModule(descriptor) {
      const native = getNative();
      let code = descriptor.code;
      code = code.replace(/@interpolate\(\s*flat\s*,\s*either\s*\)/g, "@interpolate(flat)");
      code = code.replace(/@binding\(\s*(\d+)\s*\)/g, "@binding($1)");
      code = code.replace(/@group\(\s*(\d+)\s*\)/g, "@group($1)");
      code = code.replace(/@location\(\s*(\d+)\s*\)/g, "@location($1)");
      code = code.replace(/@builtin\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g, "@builtin($1)");
      const patched = {
        ...descriptor,
        code
      };
      const handle = native?.gpuCreateShaderModule?.(this._handle, patched) ?? 0;
      return new GPUShaderModule(handle, code);
    }
    createBindGroupLayout(descriptor) {
      const native = getNative();
      const handle = native?.gpuCreateBindGroupLayout?.(this._handle, descriptor) ?? 0;
      return new GPUBindGroupLayout(handle);
    }
    createPipelineLayout(descriptor) {
      const native = getNative();
      const handle = native?.gpuCreatePipelineLayout?.(this._handle, unwrapHandles(descriptor)) ?? 0;
      return new GPUPipelineLayout(handle);
    }
    createRenderPipeline(descriptor) {
      const native = getNative();
      if (descriptor.vertex && !descriptor.vertex.entryPoint) {
        const mod = descriptor.vertex.module;
        if (mod && mod._code) {
          const m = mod._code.match(/@vertex\s+fn\s+(\w+)/);
          if (m) descriptor.vertex.entryPoint = m[1];
        }
      }
      if (descriptor.fragment && !descriptor.fragment.entryPoint) {
        const mod = descriptor.fragment.module;
        if (mod && mod._code) {
          const m = mod._code.match(/@fragment\s+fn\s+(\w+)/);
          if (m) descriptor.fragment.entryPoint = m[1];
        }
      }
      const unwrapped = unwrapHandles(descriptor);
      const handle = native?.gpuCreateRenderPipeline?.(this._handle, unwrapped) ?? 0;
      return new GPURenderPipeline(handle);
    }
    createComputePipeline(descriptor) {
      const native = getNative();
      const handle = native?.gpuCreateComputePipeline?.(this._handle, unwrapHandles(descriptor)) ?? 0;
      return new GPUComputePipeline(handle);
    }
    createBindGroup(descriptor) {
      const native = getNative();
      const unwrapped = unwrapHandles(descriptor);
      const handle = native?.gpuCreateBindGroup?.(this._handle, unwrapped) ?? 0;
      return new GPUBindGroup(handle);
    }
    createQuerySet(descriptor) {
      const native = getNative();
      const handle = native?.gpuCreateQuerySet?.(this._handle, descriptor) ?? 0;
      return new GPUQuerySet(handle, descriptor.type, descriptor.count);
    }
    createRenderBundleEncoder(descriptor) {
      const native = getNative();
      const handle = native?.gpuCreateRenderBundleEncoder?.(this._handle, unwrapHandles(descriptor)) ?? 0;
      return new GPURenderBundleEncoder(handle);
    }
    async createRenderPipelineAsync(descriptor) {
      const native = getNative();
      const handle = await native?.gpuCreateRenderPipelineAsync?.(this._handle, unwrapHandles(descriptor)) ?? 0;
      return new GPURenderPipeline(handle);
    }
    async createComputePipelineAsync(descriptor) {
      const native = getNative();
      const handle = await native?.gpuCreateComputePipelineAsync?.(this._handle, unwrapHandles(descriptor)) ?? 0;
      return new GPUComputePipeline(handle);
    }
    // --- T18: Command encoding ---
    createCommandEncoder(_descriptor) {
      const native = getNative();
      const handle = native?.gpuCreateCommandEncoder?.(this._handle) ?? 0;
      return new GPUCommandEncoder(handle);
    }
  };
  var GPUAdapter = class {
    _handle;
    constructor(handle) {
      this._handle = handle;
    }
    async requestDevice(_descriptor) {
      const native = getNative();
      const handle = native?.gpuRequestDevice?.(this._handle) ?? 0;
      return new GPUDevice(handle);
    }
    // Adapter features — real Dawn feature names
    get features() {
      return /* @__PURE__ */ new Set([
        "core-features-and-limits",
        "depth-clip-control",
        "depth32float-stencil8",
        "texture-compression-bc",
        "indirect-first-instance",
        "rg11b10ufloat-renderable",
        "bgra8unorm-storage",
        "float32-filterable",
        "subgroups"
      ]);
    }
    get info() {
      const native = getNative();
      return native?.gpuGetAdapterInfo?.(this._handle) ?? {};
    }
    get limits() {
      return {
        maxTextureDimension1D: 8192,
        maxTextureDimension2D: 8192,
        maxTextureDimension3D: 2048,
        maxTextureArrayLayers: 256,
        maxBindGroups: 4,
        maxBindGroupsPlusVertexBuffers: 24,
        maxBindingsPerBindGroup: 1e3,
        maxDynamicUniformBuffersPerPipelineLayout: 10,
        maxDynamicStorageBuffersPerPipelineLayout: 8,
        maxSampledTexturesPerShaderStage: 16,
        maxSamplersPerShaderStage: 16,
        maxStorageBuffersPerShaderStage: 8,
        maxStorageTexturesPerShaderStage: 4,
        maxUniformBuffersPerShaderStage: 12,
        maxUniformBufferBindingSize: 65536,
        maxStorageBufferBindingSize: 134217728,
        minUniformBufferOffsetAlignment: 256,
        minStorageBufferOffsetAlignment: 256,
        maxVertexBuffers: 8,
        maxBufferSize: 268435456,
        maxVertexAttributes: 16,
        maxVertexBufferArrayStride: 2048,
        maxInterStageShaderComponents: 60,
        maxInterStageShaderVariables: 16,
        maxColorAttachments: 8,
        maxColorAttachmentBytesPerSample: 32,
        maxComputeWorkgroupStorageSize: 16384,
        maxComputeInvocationsPerWorkgroup: 256,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
        maxComputeWorkgroupsPerDimension: 65535
      };
    }
  };
  var GPU = class {
    async requestAdapter(_options) {
      const native = getNative();
      if (!native?.gpuRequestAdapter) {
        return null;
      }
      const handle = native.gpuRequestAdapter();
      return new GPUAdapter(handle);
    }
    getPreferredCanvasFormat() {
      return getNative()?.gpuGetPreferredCanvasFormat?.() ?? "bgra8unorm";
    }
    get wgslLanguageFeatures() {
      const native = getNative();
      const info = native?.gpuGetWgslLanguageFeatures?.();
      if (info?.size) {
        const features = /* @__PURE__ */ new Set();
        for (let i = 0; i < info.size; i++) {
          features.add(info[i] ?? `feature-${i}`);
        }
        return features;
      }
      return /* @__PURE__ */ new Set();
    }
  };

  // bootstrap/image.ts
  var ImageBitmap = class {
    width;
    height;
    _data;
    // RGBA pixels
    constructor(width, height, data) {
      this.width = width;
      this.height = height;
      this._data = data;
    }
    close() {
    }
  };
  var ImageElement = class extends EventTarget {
    width = 0;
    height = 0;
    _src = "";
    _data = null;
    _complete = false;
    crossOrigin = null;
    // Callback-style event handlers (Three.js uses these)
    onload = null;
    onerror = null;
    get src() {
      return this._src;
    }
    set src(url) {
      this._src = url;
      this._complete = false;
      Promise.resolve().then(async () => {
        try {
          const g2 = globalThis;
          const resp = await g2.fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const buf = new Uint8Array(await resp.arrayBuffer());
          if (typeof __native_decodeImage !== "function") {
            throw new Error("__native_decodeImage not available");
          }
          const result = __native_decodeImage(buf);
          if (!result) throw new Error("Image decode failed");
          this.width = result.width;
          this.height = result.height;
          this._data = result.data;
          this._complete = true;
          const loadEvent = new Event("load");
          if (this.onload) this.onload.call(this);
          this.dispatchEvent(loadEvent);
        } catch (e) {
          const errorEvent = new Event("error");
          if (this.onerror) this.onerror.call(this, e);
          this.dispatchEvent(errorEvent);
        }
      });
    }
    get complete() {
      return this._complete;
    }
    get naturalWidth() {
      return this.width;
    }
    get naturalHeight() {
      return this.height;
    }
  };
  function createImageBitmap(source) {
    if (source instanceof ImageElement) {
      if (source._data && source._complete) {
        return Promise.resolve(
          new ImageBitmap(source.width, source.height, source._data)
        );
      }
      return new Promise((resolve, reject) => {
        source.addEventListener(
          "load",
          () => {
            if (source._data) {
              resolve(
                new ImageBitmap(source.width, source.height, source._data)
              );
            } else {
              reject(new Error("Image has no data after load"));
            }
          },
          { once: true }
        );
        source.addEventListener(
          "error",
          () => {
            reject(new Error("Image failed to load"));
          },
          { once: true }
        );
      });
    }
    if (source && typeof source.arrayBuffer === "function") {
      return source.arrayBuffer().then((ab) => {
        return decodeRawBytes(new Uint8Array(ab));
      });
    }
    if (source instanceof ArrayBuffer) {
      return Promise.resolve(decodeRawBytes(new Uint8Array(source)));
    }
    if (source instanceof Uint8Array) {
      return Promise.resolve(decodeRawBytes(source));
    }
    return Promise.reject(new Error("Unsupported source type for createImageBitmap"));
  }
  function decodeRawBytes(bytes) {
    if (typeof __native_decodeImage !== "function") {
      throw new Error("__native_decodeImage not available");
    }
    const result = __native_decodeImage(bytes);
    if (!result) {
      throw new Error("Image decode failed");
    }
    return new ImageBitmap(result.width, result.height, result.data);
  }
  function installImage() {
    const g2 = globalThis;
    g2.Image = ImageElement;
    g2.ImageBitmap = ImageBitmap;
    g2.createImageBitmap = createImageBitmap;
  }

  // bootstrap/dom.ts
  var CanvasStub = class extends EventTarget {
    width = 800;
    height = 600;
    style = {};
    _attributes = /* @__PURE__ */ new Map();
    _gpuContext = null;
    getContext(contextId) {
      if (contextId === "webgpu") {
        if (!this._gpuContext) {
          this._gpuContext = new GPUCanvasContext();
        }
        return this._gpuContext;
      }
      return null;
    }
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width: this.width,
        height: this.height,
        right: this.width,
        bottom: this.height,
        x: 0,
        y: 0
      };
    }
    setAttribute(name, value) {
      this._attributes.set(name, value);
    }
    getAttribute(name) {
      return this._attributes.get(name) ?? null;
    }
    // Three.js sometimes checks for these
    get clientWidth() {
      return this.width;
    }
    get clientHeight() {
      return this.height;
    }
    // OrbitControls adds pointermove/pointerup listeners to ownerDocument
    get ownerDocument() {
      return globalThis.document;
    }
    // OrbitControls calls getRootNode() for offscreen canvas compatibility
    getRootNode() {
      return globalThis.document;
    }
    // OrbitControls calls these on pointerdown — no-op in single-window runtime
    setPointerCapture(_pointerId) {
    }
    releasePointerCapture(_pointerId) {
    }
    // Some Three.js code checks for this
    get isConnected() {
      return true;
    }
  };
  function createNavigator() {
    return {
      gpu: new GPU(),
      userAgent: "three.zig/0.1.0",
      language: "en-US",
      platform: "three.zig"
    };
  }
  var DocumentStub = class extends EventTarget {
    body = {
      appendChild(child) {
        return child;
      },
      removeChild(child) {
        return child;
      },
      addEventListener(_type, _fn) {
      },
      removeEventListener(_type, _fn) {
      }
    };
    documentElement = {
      appendChild(child) {
        return child;
      },
      removeChild(child) {
        return child;
      },
      addEventListener(_type, _fn) {
      },
      removeEventListener(_type, _fn) {
      }
    };
    visibilityState = "visible";
    hidden = false;
    _canvas;
    constructor(canvas) {
      super();
      this._canvas = canvas;
    }
    createElement(tagName) {
      const tag = tagName.toLowerCase();
      if (tag === "canvas") {
        return this._canvas;
      }
      if (tag === "img") {
        return new ImageElement();
      }
      return {
        style: {},
        setAttribute() {
        },
        getAttribute() {
          return null;
        },
        appendChild(child) {
          return child;
        },
        removeChild(child) {
          return child;
        }
      };
    }
    getElementById(_id) {
      return null;
    }
    createElementNS(_namespace, tagName) {
      return this.createElement(tagName);
    }
  };
  var WindowStub = class extends EventTarget {
    innerWidth = 800;
    innerHeight = 600;
    devicePixelRatio = 1;
    navigator;
    document;
    _rafId = 0;
    constructor(document, navigator) {
      super();
      this.document = document;
      this.navigator = navigator;
    }
    get self() {
      return this;
    }
    requestAnimationFrame(callback) {
      const native = getNative();
      if (native?.requestAnimationFrame) {
        return native.requestAnimationFrame(callback);
      }
      return ++this._rafId;
    }
    cancelAnimationFrame(id) {
      const native = getNative();
      if (native?.cancelAnimationFrame) {
        native.cancelAnimationFrame(id);
      }
    }
  };
  function createDOM() {
    const canvas = new CanvasStub();
    const navigator = createNavigator();
    const document = new DocumentStub(canvas);
    const window = new WindowStub(document, navigator);
    return { canvas, navigator, document, window };
  }

  // bootstrap/fetch.ts
  function guessContentType(url) {
    const dot = url.lastIndexOf(".");
    if (dot === -1) return "application/octet-stream";
    const ext = url.slice(dot).toLowerCase().split("?")[0].split("#")[0];
    switch (ext) {
      case ".json":
        return "application/json";
      case ".js":
      case ".mjs":
        return "application/javascript";
      case ".html":
      case ".htm":
        return "text/html";
      case ".css":
        return "text/css";
      case ".txt":
        return "text/plain";
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".svg":
        return "image/svg+xml";
      case ".glb":
        return "model/gltf-binary";
      case ".gltf":
        return "model/gltf+json";
      case ".wasm":
        return "application/wasm";
      case ".xml":
        return "application/xml";
      default:
        return "application/octet-stream";
    }
  }
  var FetchHeaders = class {
    _map = {};
    constructor(init) {
      if (init) {
        for (const key of Object.keys(init)) {
          this._map[key.toLowerCase()] = init[key];
        }
      }
    }
    get(name) {
      return this._map[name.toLowerCase()] ?? null;
    }
    has(name) {
      return name.toLowerCase() in this._map;
    }
    set(name, value) {
      this._map[name.toLowerCase()] = value;
    }
  };
  var FetchResponse = class {
    ok;
    status;
    statusText;
    url;
    headers;
    _body;
    constructor(body, status, statusText, url, headers) {
      this._body = body;
      this.ok = status >= 200 && status < 300;
      this.status = status;
      this.statusText = statusText;
      this.url = url;
      this.headers = new FetchHeaders(headers);
    }
    text() {
      const bytes = this._body;
      const g2 = globalThis;
      if (typeof g2.TextDecoder !== "undefined") {
        return Promise.resolve(new g2.TextDecoder().decode(bytes));
      }
      let str = "";
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return Promise.resolve(str);
    }
    json() {
      return this.text().then((t) => JSON.parse(t));
    }
    arrayBuffer() {
      const buf = this._body.buffer.slice(
        this._body.byteOffset,
        this._body.byteOffset + this._body.byteLength
      );
      return Promise.resolve(buf);
    }
    blob() {
      const g2 = globalThis;
      const contentType = this.headers.get("content-type") || "application/octet-stream";
      const blob = new g2.Blob([this._body], { type: contentType });
      return Promise.resolve(blob);
    }
  };
  function decodeURIBytes(str) {
    const parts = [];
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "%" && i + 2 < str.length) {
        parts.push(parseInt(str.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        parts.push(str.charCodeAt(i));
      }
    }
    return new Uint8Array(parts);
  }
  function fetchDataURI(url) {
    const rest = url.slice(5);
    const commaIdx = rest.indexOf(",");
    if (commaIdx === -1) {
      return new FetchResponse(
        new Uint8Array(0),
        400,
        "Bad Request",
        url,
        { "content-type": "text/plain" }
      );
    }
    const meta = rest.slice(0, commaIdx);
    const data = rest.slice(commaIdx + 1);
    const isBase64 = meta.endsWith(";base64");
    const mediaType = isBase64 ? meta.slice(0, -7) : meta;
    const contentType = mediaType || "text/plain;charset=US-ASCII";
    let body;
    if (isBase64) {
      const decoded = typeof __native_decodeBase64 === "function" ? __native_decodeBase64(data) : null;
      body = decoded ?? new Uint8Array(0);
    } else {
      body = decodeURIBytes(data);
    }
    return new FetchResponse(body, 200, "OK", url, {
      "content-type": contentType
    });
  }
  function isLocalPath(url) {
    if (url.startsWith("./") || url.startsWith("../") || url.startsWith("/")) {
      return true;
    }
    if (!url.includes("://") && !url.startsWith("data:")) {
      return true;
    }
    return false;
  }
  function fetchPolyfill(input) {
    const url = typeof input === "string" ? input : input.url ?? input.toString();
    if (url.startsWith("blob:")) {
      const g2 = globalThis;
      const registry = g2.__blobRegistry;
      const entry = registry?.get(url);
      if (entry) {
        return Promise.resolve(
          new FetchResponse(entry.data, 200, "OK", url, {
            "content-type": entry.type
          })
        );
      }
      return Promise.resolve(
        new FetchResponse(new Uint8Array(0), 404, "Not Found", url, {})
      );
    }
    if (url.startsWith("data:")) {
      try {
        return Promise.resolve(fetchDataURI(url));
      } catch {
        return Promise.resolve(
          new FetchResponse(new Uint8Array(0), 400, "Bad Request", url, {})
        );
      }
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (typeof __native_httpFetch !== "function") {
        return Promise.resolve(
          new FetchResponse(
            new Uint8Array(0),
            0,
            "Network request not supported",
            url,
            {}
          )
        );
      }
      const result = __native_httpFetch(url);
      if (!result) {
        return Promise.resolve(
          new FetchResponse(
            new Uint8Array(0),
            0,
            "Network Error",
            url,
            {}
          )
        );
      }
      return Promise.resolve(
        new FetchResponse(
          result.body,
          result.status,
          result.statusText || "OK",
          url,
          {
            "content-type": result.contentType || "application/octet-stream"
          }
        )
      );
    }
    if (isLocalPath(url)) {
      if (typeof __native_readFileSync !== "function") {
        return Promise.resolve(
          new FetchResponse(
            new Uint8Array(0),
            500,
            "Internal Error",
            url,
            {}
          )
        );
      }
      let bytes = __native_readFileSync(url);
      if (bytes === null && !url.startsWith("/")) {
        const scriptDir = globalThis.__scriptDir;
        if (scriptDir) {
          const normalizedScriptDir = String(scriptDir).replace(/\\/g, "/");
          bytes = __native_readFileSync(normalizedScriptDir + "/" + url);
          if (bytes === null) {
            const parentDir = normalizedScriptDir.replace(/\/[^/]+\/?$/, "");
            if (parentDir !== normalizedScriptDir) {
              bytes = __native_readFileSync(parentDir + "/" + url);
            }
          }
        }
      }
      if (bytes === null) {
        return Promise.resolve(
          new FetchResponse(
            new Uint8Array(0),
            404,
            "Not Found",
            url,
            { "content-type": "text/plain" }
          )
        );
      }
      const contentType = guessContentType(url);
      return Promise.resolve(
        new FetchResponse(bytes, 200, "OK", url, {
          "content-type": contentType
        })
      );
    }
    return Promise.resolve(
      new FetchResponse(
        new Uint8Array(0),
        0,
        "Network request not supported",
        url,
        {}
      )
    );
  }
  function installFetch() {
    const g2 = globalThis;
    g2.fetch = fetchPolyfill;
    g2.Response = FetchResponse;
  }

  // bootstrap/webgpu-constants.ts
  function installWebGPUConstants() {
    const g2 = globalThis;
    g2.GPUBufferUsage = Object.freeze({
      MAP_READ: 1,
      MAP_WRITE: 2,
      COPY_SRC: 4,
      COPY_DST: 8,
      INDEX: 16,
      VERTEX: 32,
      UNIFORM: 64,
      STORAGE: 128,
      INDIRECT: 256,
      QUERY_RESOLVE: 512
    });
    g2.GPUTextureUsage = Object.freeze({
      COPY_SRC: 1,
      COPY_DST: 2,
      TEXTURE_BINDING: 4,
      STORAGE_BINDING: 8,
      RENDER_ATTACHMENT: 16
    });
    g2.GPUMapMode = Object.freeze({
      READ: 1,
      WRITE: 2
    });
    g2.GPUShaderStage = Object.freeze({
      VERTEX: 1,
      FRAGMENT: 2,
      COMPUTE: 4
    });
  }

  // bootstrap/abort.ts
  var AbortSignal = class _AbortSignal extends EventTarget {
    aborted = false;
    reason = void 0;
    // Callback-style handler (used by some code paths)
    onabort = null;
    throwIfAborted() {
      if (this.aborted) {
        throw this.reason;
      }
    }
    /** Internal: mark this signal as aborted and fire the abort event. */
    _abort(reason) {
      if (this.aborted) return;
      this.aborted = true;
      this.reason = reason ?? new DOMException("The operation was aborted.", "AbortError");
      const event = new Event("abort");
      if (this.onabort) this.onabort.call(this, event);
      this.dispatchEvent(event);
    }
    static abort(reason) {
      const signal = new _AbortSignal();
      signal._abort(reason ?? new DOMException("The operation was aborted.", "AbortError"));
      return signal;
    }
    static timeout(ms) {
      const signal = new _AbortSignal();
      return signal;
    }
    static any(signals) {
      const combined = new _AbortSignal();
      for (const s of signals) {
        if (s.aborted) {
          combined._abort(s.reason);
          return combined;
        }
      }
      for (const s of signals) {
        s.addEventListener("abort", () => {
          combined._abort(s.reason);
        }, { once: true });
      }
      return combined;
    }
  };
  var DOMException = class extends Error {
    name;
    code;
    constructor(message, name) {
      super(message ?? "");
      this.name = name ?? "Error";
      this.code = 0;
    }
  };
  var AbortController = class {
    signal;
    constructor() {
      this.signal = new AbortSignal();
    }
    abort(reason) {
      this.signal._abort(reason);
    }
  };
  function installAbort() {
    const g2 = globalThis;
    g2.AbortController = AbortController;
    g2.AbortSignal = AbortSignal;
    g2.DOMException = DOMException;
  }

  // bootstrap/request.ts
  var Headers = class _Headers {
    _map = /* @__PURE__ */ new Map();
    constructor(init) {
      if (init) {
        if (init instanceof _Headers) {
          init.forEach((value, name) => {
            this._map.set(name.toLowerCase(), value);
          });
        } else {
          for (const key of Object.keys(init)) {
            this._map.set(key.toLowerCase(), init[key]);
          }
        }
      }
    }
    append(name, value) {
      const key = name.toLowerCase();
      const existing = this._map.get(key);
      if (existing !== void 0) {
        this._map.set(key, existing + ", " + value);
      } else {
        this._map.set(key, value);
      }
    }
    get(name) {
      return this._map.get(name.toLowerCase()) ?? null;
    }
    set(name, value) {
      this._map.set(name.toLowerCase(), value);
    }
    has(name) {
      return this._map.has(name.toLowerCase());
    }
    delete(name) {
      this._map.delete(name.toLowerCase());
    }
    forEach(callback) {
      this._map.forEach((value, name) => {
        callback(value, name, this);
      });
    }
    entries() {
      return this._map.entries();
    }
    keys() {
      return this._map.keys();
    }
    values() {
      return this._map.values();
    }
    [Symbol.iterator]() {
      return this._map.entries();
    }
  };
  var Request = class _Request {
    url;
    method;
    headers;
    signal;
    mode;
    credentials;
    cache;
    redirect;
    referrer;
    integrity;
    body;
    constructor(input, init) {
      if (typeof input === "string") {
        this.url = input;
      } else {
        this.url = input.url;
      }
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers);
      this.signal = init?.signal ?? null;
      this.mode = init?.mode ?? "cors";
      this.credentials = init?.credentials ?? "same-origin";
      this.cache = init?.cache ?? "default";
      this.redirect = init?.redirect ?? "follow";
      this.referrer = init?.referrer ?? "about:client";
      this.integrity = init?.integrity ?? "";
      this.body = init?.body ?? null;
    }
    clone() {
      return new _Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.body,
        signal: this.signal
      });
    }
  };
  function installRequest() {
    const g2 = globalThis;
    g2.Headers = Headers;
    g2.Request = Request;
  }

  // bootstrap/audio.ts
  var audioInitialized = false;
  var audioContext = null;
  var AudioParam = class {
    _value;
    _automation = [];
    constructor(defaultValue) {
      this._value = defaultValue;
    }
    get value() {
      return this._value;
    }
    set value(value) {
      this._value = Math.max(0, value);
    }
    setValueAtTime(value, startTime) {
      this._automation.push({ time: startTime, value });
      this._value = value;
    }
    linearRampToValueAtTime(value, endTime) {
      this._automation.push({ time: endTime, value });
      this._value = value;
    }
    exponentialRampToValueAtTime(value, endTime) {
      this._automation.push({ time: endTime, value });
      this._value = value;
    }
    setTargetAtTime(target, startTime, timeConstant) {
      this._automation.push({ time: startTime, value: target });
      this._value = target;
    }
    setValueCurveAtTime(values, startTime, duration) {
      if (values.length > 0) {
        this._automation.push({ time: startTime, value: values[0] });
        this._value = values[0];
      }
    }
    cancelScheduledValues(cancelTime) {
      this._automation = this._automation.filter((event) => event.time < cancelTime);
    }
    // Get the current value considering automation (simplified)
    getCurrentValue(currentTime) {
      return this._value;
    }
  };
  var AudioContextPolyfill = class {
    _state = "suspended";
    _destination;
    _volume = 1;
    constructor() {
      this._destination = new AudioDestinationNodePolyfill(this);
    }
    get state() {
      return this._state;
    }
    get destination() {
      return this._destination;
    }
    get currentTime() {
      return performance.now() / 1e3;
    }
    async resume() {
      const native = getNative();
      if (native?.audioInit && !audioInitialized) {
        const success = native.audioInit();
        if (success) {
          audioInitialized = true;
          this._state = "running";
        } else {
          console.warn("Failed to initialize audio engine");
        }
      } else if (audioInitialized) {
        this._state = "running";
      }
    }
    async suspend() {
      this._state = "suspended";
    }
    close() {
      const native = getNative();
      if (native?.audioShutdown && audioInitialized) {
        native.audioShutdown();
        audioInitialized = false;
      }
      this._state = "closed";
      audioContext = null;
      return Promise.resolve();
    }
    createBuffer(_numberOfChannels, _length, _sampleRate) {
      return new AudioBufferPolyfill(_numberOfChannels, _length, _sampleRate);
    }
    createBufferSource() {
      return new AudioBufferSourceNodePolyfill(this);
    }
    createGain() {
      return new GainNodePolyfill(this);
    }
    createOscillator() {
      return new OscillatorNodePolyfill(this);
    }
    set volume(volume) {
      this._volume = Math.max(0, Math.min(1, volume));
      const native = getNative();
      if (native?.audioSetVolume) {
        native.audioSetVolume(this._volume);
      }
    }
    get volume() {
      return this._volume;
    }
  };
  var AudioBufferPolyfill = class {
    numberOfChannels;
    length;
    sampleRate;
    _channelData;
    constructor(numberOfChannels, length, sampleRate) {
      this.numberOfChannels = numberOfChannels;
      this.length = length;
      this.sampleRate = sampleRate;
      this._channelData = [];
      for (let i = 0; i < numberOfChannels; i++) {
        this._channelData.push(new Float32Array(length));
      }
    }
    getChannelData(channel) {
      if (channel < 0 || channel >= this.numberOfChannels) {
        throw new Error("Channel index out of range");
      }
      return this._channelData[channel];
    }
    copyFromChannel(_destination, _channelNumber, _startInChannel) {
    }
    copyToChannel(_source, _channelNumber, _startInChannel) {
    }
  };
  var AudioNodePolyfill = class {
    _context;
    context;
    _connections = /* @__PURE__ */ new Map();
    constructor(context) {
      this._context = context;
      this.context = context;
    }
    connect(destination, output, input) {
      this._connections.set(destination, { output, input });
      return destination;
    }
    disconnect(destination, output, input) {
      if (destination) {
        this._connections.delete(destination);
      } else {
        this._connections.clear();
      }
    }
    // Get all connected nodes
    getConnections() {
      return Array.from(this._connections.keys());
    }
    // Check if connected to a specific node
    isConnectedTo(node) {
      return this._connections.has(node);
    }
  };
  var GainNodePolyfill = class extends AudioNodePolyfill {
    gain;
    constructor(context) {
      super(context);
      this.gain = new AudioParam(1);
    }
  };
  var OscillatorNodePolyfill = class extends AudioNodePolyfill {
    _type = "sine";
    _frequency;
    _detune;
    _isPlaying = false;
    constructor(context) {
      super(context);
      this._frequency = new AudioParam(440);
      this._detune = new AudioParam(0);
    }
    get type() {
      return this._type;
    }
    set type(value) {
      this._type = value;
    }
    get frequency() {
      return this._frequency;
    }
    get detune() {
      return this._detune;
    }
    start(when) {
      if (this._isPlaying) {
        console.warn("Oscillator already playing");
        return;
      }
      this._isPlaying = true;
      console.log("OscillatorNode.start called - oscillator playback not yet implemented");
    }
    stop(when) {
      if (!this._isPlaying) {
        return;
      }
      this._isPlaying = false;
      console.log("OscillatorNode.stop called - oscillator playback not yet implemented");
    }
  };
  var AudioBufferSourceNodePolyfill = class extends AudioNodePolyfill {
    _buffer = null;
    _loop = false;
    _autoplay = false;
    _isPlaying = false;
    constructor(context) {
      super(context);
    }
    get buffer() {
      return this._buffer;
    }
    set buffer(value) {
      this._buffer = value;
    }
    get loop() {
      return this._loop;
    }
    set loop(value) {
      this._loop = value;
    }
    start(when, offset = 0, duration) {
      if (!this._buffer) {
        console.warn("AudioBufferSourceNode.start called without buffer");
        return;
      }
      if (this._isPlaying) {
        console.warn("AudioBufferSourceNode already playing");
        return;
      }
      const native = getNative();
      if (!native?.audioPlayBuffer) {
        console.warn("Native buffer playback not available");
        return;
      }
      const channelData = this._buffer.getChannelData(0);
      const success = native.audioPlayBuffer(
        channelData,
        this._buffer.sampleRate,
        this._buffer.numberOfChannels
      );
      if (success) {
        this._isPlaying = true;
      } else {
        console.warn("Failed to play audio buffer");
      }
    }
    stop(when) {
      if (this._isPlaying) {
        this._isPlaying = false;
        console.log("AudioBufferSourceNode.stop called - buffer stop not yet implemented");
      }
    }
  };
  var AudioDestinationNodePolyfill = class extends AudioNodePolyfill {
    maxChannelCount = 2;
    constructor(context) {
      super(context);
    }
  };
  function installAudio() {
    const g2 = globalThis;
    if (typeof g2.AudioContext === "undefined") {
      g2.AudioContext = AudioContextPolyfill;
    }
    if (typeof g2.webkitAudioContext === "undefined") {
      g2.webkitAudioContext = AudioContextPolyfill;
    }
  }

  // bootstrap/index.ts
  var dom = createDOM();
  var g = globalThis;
  g.window = dom.window;
  g.document = dom.document;
  g.navigator = dom.navigator;
  g.self = dom.window;
  g.Event = Event;
  g.PointerEvent = PointerEvent;
  g.WheelEvent = WheelEvent;
  g.KeyboardEvent = KeyboardEvent;
  g.EventTarget = EventTarget;
  var CustomEvent = class extends Event {
    detail;
    constructor(type, init) {
      super(type, init);
      this.detail = init?.detail ?? null;
    }
  };
  g.CustomEvent = CustomEvent;
  g.requestAnimationFrame = (cb) => dom.window.requestAnimationFrame(cb);
  g.cancelAnimationFrame = (id) => dom.window.cancelAnimationFrame(id);
  g.innerWidth = dom.window.innerWidth;
  g.innerHeight = dom.window.innerHeight;
  g.devicePixelRatio = dom.window.devicePixelRatio;
  installWebGPUConstants();
  installFetch();
  installImage();
  installAbort();
  installRequest();
  installAudio();
  var _blobRegistry = /* @__PURE__ */ new Map();
  var _blobIdCounter = 0;
  var BlobPolyfill = class _BlobPolyfill {
    _data;
    size;
    type;
    constructor(parts, options) {
      this.type = options?.type ?? "";
      const buffers = [];
      let totalLen = 0;
      if (parts) {
        for (const part of parts) {
          let bytes;
          if (part instanceof Uint8Array) {
            bytes = part;
          } else if (part instanceof ArrayBuffer) {
            bytes = new Uint8Array(part);
          } else if (ArrayBuffer.isView(part)) {
            bytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
          } else if (typeof part === "string") {
            bytes = new Uint8Array(part.length);
            for (let i = 0; i < part.length; i++) {
              bytes[i] = part.charCodeAt(i);
            }
          } else if (part instanceof _BlobPolyfill) {
            bytes = part._data;
          } else {
            const s = String(part);
            bytes = new Uint8Array(s.length);
            for (let i = 0; i < s.length; i++) {
              bytes[i] = s.charCodeAt(i);
            }
          }
          buffers.push(bytes);
          totalLen += bytes.length;
        }
      }
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const buf of buffers) {
        merged.set(buf, offset);
        offset += buf.length;
      }
      this._data = merged;
      this.size = totalLen;
    }
    arrayBuffer() {
      const bytes = this._data.slice();
      return Promise.resolve(bytes.buffer);
    }
    text() {
      let str = "";
      for (let i = 0; i < this._data.length; i++) {
        str += String.fromCharCode(this._data[i]);
      }
      return Promise.resolve(str);
    }
    slice(start, end, contentType) {
      const sliced = this._data.slice(start ?? 0, end ?? this._data.length);
      return new _BlobPolyfill([sliced], { type: contentType ?? this.type });
    }
  };
  g.Blob = BlobPolyfill;
  var URLPolyfill = class {
    href;
    origin;
    protocol;
    host;
    hostname;
    port;
    pathname;
    search;
    hash;
    searchParams;
    constructor(url, base) {
      let resolved = url;
      if (base && !url.includes("://") && !url.startsWith("data:")) {
        if (url.startsWith("/")) {
          const match = base.match(/^(https?:\/\/[^/]+)/);
          resolved = match ? match[1] + url : url;
        } else {
          const lastSlash = base.lastIndexOf("/");
          resolved = base.slice(0, lastSlash + 1) + url;
        }
      }
      this.href = resolved;
      const protoMatch = resolved.match(/^([a-z][a-z0-9+.-]*:)/i);
      this.protocol = protoMatch ? protoMatch[1] : "";
      const afterProto = this.protocol ? resolved.slice(this.protocol.length) : resolved;
      if (afterProto.startsWith("//")) {
        const rest = afterProto.slice(2);
        const pathStart = rest.indexOf("/");
        if (pathStart === -1) {
          this.host = rest;
          this.pathname = "/";
        } else {
          this.host = rest.slice(0, pathStart);
          this.pathname = rest.slice(pathStart);
        }
      } else {
        this.host = "";
        this.pathname = afterProto;
      }
      const colonIdx = this.host.indexOf(":");
      if (colonIdx !== -1) {
        this.hostname = this.host.slice(0, colonIdx);
        this.port = this.host.slice(colonIdx + 1);
      } else {
        this.hostname = this.host;
        this.port = "";
      }
      this.origin = this.protocol ? this.protocol + "//" + this.host : "";
      const hashIdx = this.pathname.indexOf("#");
      if (hashIdx !== -1) {
        this.hash = this.pathname.slice(hashIdx);
        this.pathname = this.pathname.slice(0, hashIdx);
      } else {
        this.hash = "";
      }
      const searchIdx = this.pathname.indexOf("?");
      if (searchIdx !== -1) {
        this.search = this.pathname.slice(searchIdx);
        this.pathname = this.pathname.slice(0, searchIdx);
      } else {
        this.search = "";
      }
      this.searchParams = {
        get(_name) {
          return null;
        },
        has(_name) {
          return false;
        },
        toString() {
          return "";
        }
      };
    }
    toString() {
      return this.href;
    }
  };
  URLPolyfill.createObjectURL = function(blob) {
    const id = `blob:three.zig/${++_blobIdCounter}`;
    _blobRegistry.set(id, { data: blob._data, type: blob.type || "application/octet-stream" });
    return id;
  };
  URLPolyfill.revokeObjectURL = function(url) {
    _blobRegistry.delete(url);
  };
  g.__blobRegistry = _blobRegistry;
  if (typeof g.URL === "undefined") {
    g.URL = URLPolyfill;
  }
  dom.window.URL = g.URL;
  if (typeof g.URLSearchParams === "undefined") {
    g.URLSearchParams = class URLSearchParams {
      _entries = [];
      constructor(_init) {
      }
      get(_name) {
        return null;
      }
      has(_name) {
        return false;
      }
      set(_name, _value) {
      }
      append(_name, _value) {
      }
      delete(_name) {
      }
      toString() {
        return "";
      }
    };
  }
})();
