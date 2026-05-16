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

  constructor(context: AudioContextPolyfill) {
    this._context = context;
    this.context = context;
  }

  connect(_destination: AudioNodePolyfill): void {
    // Stub implementation
  }

  disconnect(): void {
    // Stub implementation
  }
}

/**
 * Minimal AudioBufferSourceNode implementation.
 */
class AudioBufferSourceNodePolyfill extends AudioNodePolyfill {
  private _buffer: AudioBufferPolyfill | null = null;
  private _loop: boolean = false;
  private _autoplay: boolean = false;

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

  start(when?: number, offset?: number, duration?: number): void {
    // For now, we'll just log - actual audio playback would need more work
    console.log("AudioBufferSourceNode.start called - audio playback not fully implemented");
  }

  stop(when?: number): void {
    console.log("AudioBufferSourceNode.stop called");
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