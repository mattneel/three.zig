/**
 * Basic Web Audio API polyfill for three.zig using miniaudio.
 *
 * This provides a minimal subset of the Web Audio API that Three.js
 * expects for basic audio playback.
 */

import { getNative } from "./native";

let audioInitialized = false;
let audioContext: AudioContextPolyfill | null = null;

/**
 * AudioParam - for controlling audio parameters over time.
 */
class AudioParam {
  private _value: number;
  private _automation: Array<{time: number, value: number}> = [];

  constructor(defaultValue: number) {
    this._value = defaultValue;
  }

  get value(): number {
    return this._value;
  }

  set value(value: number) {
    this._value = Math.max(0, value); // Most audio params are non-negative
  }

  setValueAtTime(value: number, startTime: number): void {
    this._automation.push({ time: startTime, value });
    this._value = value;
  }

  linearRampToValueAtTime(value: number, endTime: number): void {
    this._automation.push({ time: endTime, value });
    this._value = value;
  }

  exponentialRampToValueAtTime(value: number, endTime: number): void {
    this._automation.push({ time: endTime, value });
    this._value = value;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): void {
    // Simplified - just set the target value immediately
    this._automation.push({ time: startTime, value: target });
    this._value = target;
  }

  setValueCurveAtTime(values: Float32Array, startTime: number, duration: number): void {
    // Simplified - just use the first value
    if (values.length > 0) {
      this._automation.push({ time: startTime, value: values[0] });
      this._value = values[0];
    }
  }

  cancelScheduledValues(cancelTime: number): void {
    this._automation = this._automation.filter(event => event.time < cancelTime);
  }

  // Get the current value considering automation (simplified)
  getCurrentValue(currentTime: number): number {
    // For now, just return the current value
    // A full implementation would interpolate between automation points
    return this._value;
  }
}

/**
 * Minimal AudioContext implementation.
 */
class AudioContextPolyfill {
  private _state: "suspended" | "running" | "closed" = "suspended";
  private _destination: AudioDestinationNodePolyfill;
  private _volume: number = 1.0;

  constructor() {
    this._destination = new AudioDestinationNodePolyfill(this);
  }

  get state(): "suspended" | "running" | "closed" {
    return this._state;
  }

  get destination(): AudioDestinationNodePolyfill {
    return this._destination;
  }

  get currentTime(): number {
    // Return a simple time counter
    return performance.now() / 1000;
  }

  async resume(): Promise<void> {
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

  async suspend(): Promise<void> {
    this._state = "suspended";
  }

  close(): Promise<void> {
    const native = getNative();
    if (native?.audioShutdown && audioInitialized) {
      native.audioShutdown();
      audioInitialized = false;
    }
    this._state = "closed";
    audioContext = null;
    return Promise.resolve();
  }

  createBuffer(
    _numberOfChannels: number,
    _length: number,
    _sampleRate: number
  ): AudioBufferPolyfill {
    return new AudioBufferPolyfill(_numberOfChannels, _length, _sampleRate);
  }

  createBufferSource(): AudioBufferSourceNodePolyfill {
    return new AudioBufferSourceNodePolyfill(this);
  }

  createGain(): GainNodePolyfill {
    return new GainNodePolyfill(this);
  }

  createOscillator(): OscillatorNodePolyfill {
    return new OscillatorNodePolyfill(this);
  }

  set volume(volume: number) {
    this._volume = Math.max(0.0, Math.min(1.0, volume));
    const native = getNative();
    if (native?.audioSetVolume) {
      native.audioSetVolume(this._volume);
    }
  }

  get volume(): number {
    return this._volume;
  }
}

/**
 * Minimal AudioBuffer implementation.
 */
class AudioBufferPolyfill {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  private _channelData: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._channelData = [];
    for (let i = 0; i < numberOfChannels; i++) {
      this._channelData.push(new Float32Array(length));
    }
  }

  getChannelData(channel: number): Float32Array {
    if (channel < 0 || channel >= this.numberOfChannels) {
      throw new Error("Channel index out of range");
    }
    return this._channelData[channel];
  }

  copyFromChannel(_destination: Float32Array, _channelNumber: number, _startInChannel?: number): void {
    // Stub implementation
  }

  copyToChannel(_source: Float32Array, _channelNumber: number, _startInChannel?: number): void {
    // Stub implementation
  }
}

/**
 * Minimal AudioNode base class.
 */
class AudioNodePolyfill {
  protected _context: AudioContextPolyfill;
  readonly context: AudioContextPolyfill;
  protected _connections: Map<AudioNodePolyfill, {output?: number, input?: number}> = new Map();

  constructor(context: AudioContextPolyfill) {
    this._context = context;
    this.context = context;
  }

  connect(destination: AudioNodePolyfill, output?: number, input?: number): AudioNodePolyfill {
    this._connections.set(destination, { output, input });
    return destination;
  }

  disconnect(destination?: AudioNodePolyfill, output?: number, input?: number): void {
    if (destination) {
      this._connections.delete(destination);
    } else {
      this._connections.clear();
    }
  }

  // Get all connected nodes
  getConnections(): AudioNodePolyfill[] {
    return Array.from(this._connections.keys());
  }

  // Check if connected to a specific node
  isConnectedTo(node: AudioNodePolyfill): boolean {
    return this._connections.has(node);
  }
}

/**
 * Minimal GainNode implementation for volume control.
 */
class GainNodePolyfill extends AudioNodePolyfill {
  readonly gain: AudioParam;

  constructor(context: AudioContextPolyfill) {
    super(context);
    this.gain = new AudioParam(1.0);
  }
}

/**
 * Minimal OscillatorNode implementation for procedural sound generation.
 */
class OscillatorNodePolyfill extends AudioNodePolyfill {
  private _type: OscillatorType = "sine";
  private _frequency: AudioParam;
  private _detune: AudioParam;
  private _isPlaying: boolean = false;

  constructor(context: AudioContextPolyfill) {
    super(context);
    this._frequency = new AudioParam(440); // A4
    this._detune = new AudioParam(0);
  }

  get type(): OscillatorType {
    return this._type;
  }

  set type(value: OscillatorType) {
    this._type = value;
  }

  get frequency(): AudioParam {
    return this._frequency;
  }

  get detune(): AudioParam {
    return this._detune;
  }

  start(when?: number): void {
    if (this._isPlaying) {
      console.warn("Oscillator already playing");
      return;
    }
    this._isPlaying = true;
    console.log("OscillatorNode.start called - oscillator playback not yet implemented");
  }

  stop(when?: number): void {
    if (!this._isPlaying) {
      return;
    }
    this._isPlaying = false;
    console.log("OscillatorNode.stop called - oscillator playback not yet implemented");
  }
}

type OscillatorType = "sine" | "square" | "sawtooth" | "triangle" | "custom";

/**
 * Minimal AudioBufferSourceNode implementation.
 */
class AudioBufferSourceNodePolyfill extends AudioNodePolyfill {
  private _buffer: AudioBufferPolyfill | null = null;
  private _loop: boolean = false;
  private _autoplay: boolean = false;
  private _isPlaying: boolean = false;

  constructor(context: AudioContextPolyfill) {
    super(context);
  }

  get buffer(): AudioBufferPolyfill | null {
    return this._buffer;
  }

  set buffer(value: AudioBufferPolyfill | null) {
    this._buffer = value;
  }

  get loop(): boolean {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = value;
  }

  start(when?: number, offset: number = 0, duration?: number): void {
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

    // Get the first channel data (mono for simplicity)
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

  stop(when?: number): void {
    if (this._isPlaying) {
      this._isPlaying = false;
      // Note: We don't have a native stop function for buffer playback yet
      console.log("AudioBufferSourceNode.stop called - buffer stop not yet implemented");
    }
  }
}

/**
 * Minimal AudioDestinationNode implementation.
 */
class AudioDestinationNodePolyfill extends AudioNodePolyfill {
  readonly maxChannelCount: number = 2;

  constructor(context: AudioContextPolyfill) {
    super(context);
  }
}

/**
 * Install the Web Audio API polyfill.
 */
export function installAudio(): void {
  const g = globalThis as any;

  // AudioContext
  if (typeof g.AudioContext === "undefined") {
    g.AudioContext = AudioContextPolyfill;
  }

  // webkitAudioContext for compatibility
  if (typeof g.webkitAudioContext === "undefined") {
    g.webkitAudioContext = AudioContextPolyfill;
  }
}

/**
 * Helper function to play a sound file directly (simpler API for games).
 */
export function playSoundFile(path: string): boolean {
  const native = getNative();
  if (!native?.audioPlaySound) {
    console.warn("Native audio playback not available");
    return false;
  }

  // Initialize audio if not already done
  if (!audioInitialized) {
    const success = native.audioInit();
    if (!success) {
      console.warn("Failed to initialize audio engine");
      return false;
    }
    audioInitialized = true;
  }

  return native.audioPlaySound(path);
}