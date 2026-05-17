# WebGPU API Coverage

> Last updated: 2026-05-17
> Source: `docs/WebGPU.webidl` vs `src/gpu_bridge.zig` native bindings
> Audit: every `gpu*Native` function body inspected for actual Dawn C API calls

Legend:
- 🟢 **Real** — function body calls Dawn C API (`wgpu.*` or `raw.c.wgpu*`)
- 🟡 **Lazy** — returns pre-created Dawn handle (object created during `GpuBridge.register`, native function just returns stored handle)
- 🔴 **Shim** — no Dawn interaction; dummy/stub
- ⚠️ **Ext** — Dawn-specific extension, not in the WebGPU standard
- ❌ **Missing** — not implemented at all

---

## GPU (entry point)

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `requestAdapter(options?)` | 🟡 `gpuRequestAdapter` | Returns `func_data[0]` — adapter created during `GpuBridge.register` |
| `getPreferredCanvasFormat()` | 🟢 `gpuGetPreferredCanvasFormat` | Calls `gctx.surface.getPreferredFormat()` |
| `wgslLanguageFeatures` (readonly) | ❌ | |

---

## GPUAdapter

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `requestDevice(descriptor?)` | 🟡 `gpuRequestDevice` | Returns `func_data[0]` — device created during `GpuBridge.register` |
| `features` (readonly) | ❌ | |
| `limits` (readonly) | ❌ | |
| `info` (readonly) | ❌ | |

---

## GPUDevice

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `destroy()` | 🟢 `gpuDeviceDestroy` | Gets device from handle table, calls `device.destroy()`, then frees handle |
| `createBuffer(descriptor)` | 🟢 `gpuCreateBuffer` | `raw.c.wgpuDeviceCreateBuffer()` |
| `createTexture(descriptor)` | 🟢 `gpuCreateTexture` | `raw.c.wgpuDeviceCreateTexture()` |
| `createSampler(descriptor?)` | 🟢 `gpuCreateSampler` | `raw.c.wgpuDeviceCreateSampler()` |
| `createBindGroupLayout(descriptor)` | 🟢 `gpuCreateBindGroupLayout` | `raw.c.wgpuDeviceCreateBindGroupLayout()` |
| `createPipelineLayout(descriptor)` | 🟢 `gpuCreatePipelineLayout` | `raw.c.wgpuDeviceCreatePipelineLayout()` |
| `createBindGroup(descriptor)` | 🟢 `gpuCreateBindGroup` | `raw.c.wgpuDeviceCreateBindGroup()` |
| `createShaderModule(descriptor)` | 🟢 `gpuCreateShaderModule` | `raw.c.wgpuDeviceCreateShaderModule()` |
| `createComputePipeline(descriptor)` | 🟢 `gpuCreateComputePipeline` | `raw.c.wgpuDeviceCreateComputePipeline()` — parses compute stage with WGPUStringView entryPoint |
| `createRenderPipeline(descriptor)` | 🟢 `gpuCreateRenderPipeline` | `raw.c.wgpuDeviceCreateRenderPipeline()` |
| `createCommandEncoder(descriptor?)` | 🟢 `gpuCreateCommandEncoder` | `gctx.device.createCommandEncoder()` |
| `createRenderBundleEncoder(descriptor)` | 🟢 `gpuCreateRenderBundleEncoder` | `device.createRenderBundleEncoder()` |
| `createComputePipelineAsync(descriptor)` | ❌ | |
| `createRenderPipelineAsync(descriptor)` | ❌ | |
| `pushErrorScope(filter)` | ❌ | |
| `popErrorScope()` | ❌ | |
| `features` (readonly) | ❌ | |
| `limits` (readonly) | ❌ | |
| `adapterInfo` (readonly) | ❌ | |
| `queue` (readonly) | 🟡 `gpuGetQueue` | Returns `func_data[0]` — queue created during `GpuBridge.register` |
| `lost` (readonly Promise) | ❌ | |
| `onuncapturederror` (event handler) | ❌ | |
| `label` (from GPUObjectBase) | ❌ | |

---

## GPUBuffer

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `mapAsync(mode, offset?, size?)` | ❌ | |
| `getMappedRange(offset?, size?)` | 🟢 `gpuBufferGetMappedRange` | `buffer.getMappedRange()` |
| `unmap()` | 🟢 `gpuBufferUnmap` | `buffer.unmap()` |
| `destroy()` | 🟢 `gpuDestroyBuffer` | `buffer.destroy()` + `buffer.release()` |
| `size` (readonly) | ❌ | |
| `usage` (readonly) | ❌ | |
| `mapState` (readonly) | ❌ | |
| `label` (from GPUObjectBase) | ❌ | |

---

## GPUTexture

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `createView(descriptor?)` | 🟢 `gpuCreateTextureView` | `raw.c.wgpuTextureCreateView()` |
| `destroy()` | 🟢 `gpuDestroyTexture` | `texture.destroy()` + `texture.release()` |
| `width` (readonly) | ❌ | |
| `height` (readonly) | ❌ | |
| `depthOrArrayLayers` (readonly) | ❌ | |
| `mipLevelCount` (readonly) | ❌ | |
| `sampleCount` (readonly) | ❌ | |
| `dimension` (readonly) | ❌ | |
| `format` (readonly) | ❌ | |
| `usage` (readonly) | ❌ | |
| `label` (from GPUObjectBase) | ❌ | |

---

## GPUTextureView

| IDL API | Status |
|---------|--------|
| (no methods/attributes) | — |
| `label` (from GPUObjectBase) | ❌ |

---

## GPUSampler

| IDL API | Status |
|---------|--------|
| (no methods/attributes) | — |
| `label` (from GPUObjectBase) | ❌ |

---

## GPUBindGroupLayout

| IDL API | Status |
|---------|--------|
| (no methods/attributes) | — |
| `label` (from GPUObjectBase) | ❌ |

---

## GPUBindGroup

| IDL API | Status |
|---------|--------|
| (no methods/attributes) | — |
| `label` (from GPUObjectBase) | ❌ |

---

## GPUPipelineLayout

| IDL API | Status |
|---------|--------|
| (no methods/attributes) | — |
| `label` (from GPUObjectBase) | ❌ |

---

## GPUShaderModule

| IDL API | Status |
|---------|--------|
| `getCompilationInfo()` | ❌ |
| `label` (from GPUObjectBase) | ❌ |

---

## GPUPipelineBase (mixin)

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `getBindGroupLayout(index)` | 🟢 `gpuRenderPipelineGetBindGroupLayout` | `pipeline.getBindGroupLayout()` |
| | 🟢 `gpuComputePipelineGetBindGroupLayout` | `pipeline.getBindGroupLayout()` |

---

## GPUCommandEncoder

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `beginComputePass(descriptor?)` | 🟢 `gpuCommandEncoderBeginComputePass` | `encoder.beginComputePass()` |
| `beginRenderPass(descriptor)` | 🟢 `gpuCommandEncoderBeginRenderPass` | `raw.c.wgpuCommandEncoderBeginRenderPass()` |
| `copyBufferToBuffer(src, srcOff, dst, dstOff, size)` | 🟢 `gpuCommandEncoderCopyBufferToBuffer` | `encoder.copyBufferToBuffer()` |
| `copyBufferToTexture(src, dst, size)` | ❌ | |
| `copyTextureToBuffer(src, dst, size)` | ❌ | |
| `copyTextureToTexture(src, dst, size)` | ❌ | |
| `finish(descriptor?)` | 🟢 `gpuCommandEncoderFinish` | `encoder.finish()` + `encoder.release()` |
| `pushDebugGroup(label)` | 🟢 `gpuCommandEncoderPushDebugGroup` | `encoder.pushDebugGroup()` |
| `popDebugGroup()` | 🟢 `gpuCommandEncoderPopDebugGroup` | `encoder.popDebugGroup()` |
| `insertDebugMarker(label)` | 🟢 `gpuCommandEncoderInsertDebugMarker` | `encoder.insertDebugMarker()` |
| `label` (from GPUObjectBase) | ❌ | |

### Dawn extensions on CommandEncoder

| API | Status | Implementation |
|-----|--------|---------------|
| `clearBuffer(bufferId, offset, size)` | ⚠️🟢 `gpuCommandEncoderClearBuffer` | `encoder.clearBuffer()` |
| `writeBuffer(bufferId, offset, data, dataOffset, size)` | ⚠️🟢 `gpuCommandEncoderWriteBuffer` | `encoder.writeBuffer()` |

---

## GPUComputePassEncoder

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `setPipeline(pipeline)` | 🟢 `gpuComputePassEncoderSetPipeline` | `pass.setPipeline()` |
| `dispatchWorkgroups(x, y?, z?)` | 🟢 `gpuComputePassEncoderDispatchWorkgroups` | `pass.dispatchWorkgroups()` |
| `dispatchWorkgroupsIndirect(buffer, offset)` | ❌ | |
| `end()` | 🟢 `gpuComputePassEncoderEnd` | `pass.end()` + `pass.release()` |
| `pushDebugGroup(label)` | ❌ | |
| `popDebugGroup()` | ❌ | |
| `insertDebugMarker(label)` | ❌ | |
| `label` (from GPUObjectBase) | ❌ | |

### Inherited from GPUProgrammablePassEncoder

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `setBindGroup(index, bindGroup, offsets?)` | 🟢 `gpuComputePassEncoderSetBindGroup` | `pass.setBindGroup()` |

---

## GPURenderPassEncoder

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `setViewport(x, y, w, h, minD, maxD)` | 🟢 `gpuRenderPassSetViewport` | `pass.setViewport()` |
| `setScissorRect(x, y, w, h)` | 🟢 `gpuRenderPassSetScissorRect` | `pass.setScissorRect()` |
| `setBlendConstant(color)` | 🟢 `gpuRenderPassSetBlendConstant` | `pass.setBlendConstant()` |
| `setStencilReference(ref)` | 🟢 `gpuRenderPassSetStencilReference` | `pass.setStencilReference()` |
| `executeBundles(bundles)` | ❌ | |
| `end()` | 🟢 `gpuRenderPassEnd` | `pass.end()` + `pass.release()` |
| `pushDebugGroup(label)` | 🟢 `gpuRenderPassPushDebugGroup` | `pass.pushDebugGroup()` |
| `popDebugGroup()` | 🟢 `gpuRenderPassPopDebugGroup` | `pass.popDebugGroup()` |
| `insertDebugMarker(label)` | 🟢 `gpuRenderPassInsertDebugMarker` | `pass.insertDebugMarker()` |
| `label` (from GPUObjectBase) | ❌ | |

### Inherited from GPUProgrammablePassEncoder

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `setBindGroup(index, bindGroup, offsets?)` | 🟢 `gpuRenderPassSetBindGroup` | `pass.setBindGroup()` |

### Inherited from GPURenderEncoderBase

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `setPipeline(pipeline)` | 🟢 `gpuRenderPassSetPipeline` | `pass.setPipeline()` |
| `setIndexBuffer(buf, fmt, off?, size?)` | 🟢 `gpuRenderPassSetIndexBuffer` | `pass.setIndexBuffer()` |
| `setVertexBuffer(slot, buf, off?, size?)` | 🟢 `gpuRenderPassSetVertexBuffer` | `pass.setVertexBuffer()` |
| `draw(vCount, iCount?, firstV?, firstI?)` | 🟢 `gpuRenderPassDraw` | `pass.draw()` |
| `drawIndexed(iCount, iCount?, firstI?, baseV?, firstI?)` | 🟢 `gpuRenderPassDrawIndexed` | `pass.drawIndexed()` |
| `drawIndirect(buf, offset)` | 🟢 `gpuRenderPassDrawIndirect` | `pass.drawIndirect()` |
| `drawIndexedIndirect(buf, offset)` | 🟢 `gpuRenderPassDrawIndexedIndirect` | `pass.drawIndexedIndirect()` |

---

## GPURenderBundleEncoder

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `finish(descriptor?)` | 🟢 `gpuRenderBundleEncoderFinish` | `encoder.finish()` |
| `pushDebugGroup(label)` | ❌ | |
| `popDebugGroup()` | ❌ | |
| `insertDebugMarker(label)` | ❌ | |
| `label` (from GPUObjectBase) | ❌ | |

> Also inherits GPUProgrammablePassEncoder and GPURenderEncoderBase (see RenderPassEncoder).

---

## GPUQueue

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `submit(buffers)` | 🟢 `gpuQueueSubmit` | `gctx.queue.submit()` |
| `writeBuffer(buf, offset, data, dataOff?, size?)` | 🟢 `gpuQueueWriteBuffer` | `gctx.queue.writeBuffer()` |
| `writeTexture(dest, data, layout, size)` | 🟢 `gpuQueueWriteTexture` | `raw.c.wgpuQueueWriteTexture()` |
| `onSubmittedWorkDone()` | ❌ | |
| `label` (from GPUObjectBase) | ❌ | |

---

## GPUQuerySet

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `destroy()` | 🟢 `gpuQuerySetDestroy` | `qs.destroy()` |
| `label` (from GPUObjectBase) | ❌ | |

---

## GPUCanvasContext

| IDL API | Status | Implementation |
|---------|--------|---------------|
| `configure(config)` | 🟢 `gpuConfigureContext` | `gctx.configureSurface(format, alphaMode)` — parses JS strings and calls `wgpuSurfaceConfigure` |
| `unconfigure()` | ❌ | |
| `getCurrentTexture()` | 🟢 `gpuGetCurrentTexture` | `gctx.getCurrentTextureView()` |

### Non-standard extensions

| API | Status | Implementation |
|-----|--------|---------------|
| `present()` | ⚠️🟢 `gpuPresent` | `gctx.present()` |

---

## Summary

| Category | Real | Lazy | Shim | Missing |
|----------|------|------|------|---------|
| Resource creation (device.create*) | 10 | 0 | 0 | 2 (async) |
| Resource destruction | 6 | 0 | 0 | 0 |
| Render pass commands | 14 | 0 | 0 | 1 |
| Compute pass commands | 5 | 0 | 0 | 5 |
| Command encoder | 7 | 0 | 0 | 3 |
| Queue operations | 3 | 0 | 0 | 1 |
| Canvas context | 2 | 0 | 0 | 1 |
| Adapter/device lifecycle | 0 | 3 | 0 | 0 |
| Object attributes (label, info, limits) | 0 | 0 | 0 | 20+ |
| Error handling | 0 | 0 | 0 | 5 |
| Buffer mapping (mapAsync) | 0 | 0 | 0 | 1 |
| Shader introspection | 0 | 0 | 0 | 1 |
| **Total** | **47** | **3** | **0** | **40+** |

All native functions now call Dawn C API. No shims remain.

### Lazy functions (return pre-created handles)

| Function | Note |
|----------|------|
| `gpuRequestAdapter` | Adapter created during `GpuBridge.register` → `dawn.GraphicsContext.create()` |
| `gpuRequestDevice` | Device created during `GpuBridge.register` |
| `gpuGetQueue` | Queue created during `GpuBridge.register` |

### High-priority gaps

1. **Error scopes** (`pushErrorScope`, `popErrorScope`) — needed for robust error handling
2. **Texture copy operations** (`copyBufferToTexture`, etc.) — needed for screenshots, texture uploads
3. **Async pipeline creation** — needed for non-blocking pipeline compilation
4. **Object labels** — needed for GPU debugger integration
5. **Adapter/device info** (`features`, `limits`, `adapterInfo`) — needed for capability detection
6. **Buffer `mapAsync`** — needed for readback
7. **`dispatchWorkgroupsIndirect`** — needed for GPU-driven compute
8. **`executeBundles`** — needed for render bundle playback
9. **`onSubmittedWorkDone`** — needed for queue fence
10. **`lost` promise / `onuncapturederror`** — needed for device loss handling
11. **Compute pass debug groups** — missing on ComputePassEncoder and RenderBundleEncoder

### Non-standard Dawn extensions in use

- `gpuCommandEncoderClearBuffer` — Dawn-only convenience for clearing buffers in a command encoder
- `gpuCommandEncoderWriteBuffer` — Dawn-only convenience for writing buffers in a command encoder
- `gpuPresent` — Dawn swap chain presentation (standard WebGPU uses canvas auto-present)