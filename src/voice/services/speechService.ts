// Web Speech API interface definitions for TypeScript
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  isFinal?: boolean;
  length: number;
  [subIndex: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export type SupportedLanguage = 'en-IN' | 'gu-IN' | 'hi-IN';
export type MicMode = 'idle' | 'standby' | 'listening';

export interface SpeechCallbacks {
  onStart?: () => void;
  onModeChange?: (mode: MicMode) => void;
  onWakeWord?: () => void;
  onStopWord?: () => void;
  onResult: (transcript: string, alternatives: string[]) => void;
  onInterim?: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
  onEnd?: () => void;
}

const WAKE_WORD_PATTERNS = [
  /\bfenku+\b/i,
  /\bfenk[ou]+\b/i,
  /\bfanku+\b/i,
  /\bphenku+\b/i,
  /\bfeku+\b/i,
  /\bpheku+\b/i,
  /\bfainku+\b/i,
  /\bfen\s*ku+\b/i,
  /\bfan\s*ku+\b/i,
  /ફેંક[ુૂં]*/u,
  /ફેક[ુૂં]*/u,
  /ફેન્ક[ુૂં]*/u,
  /ફેંકો/u,
  /ફેકો/u,
  /ફંકુ/u,
  /फेंक[ूुं]*/u,
  /फेक[ूुं]*/u,
  /फेन्क[ूु]*/u,
  /फेंको/u,
];

const STOP_WORD_PATTERNS = [
  /\bok(?:ay)?[\s,.\-]*ok(?:ay)?\b/i,
  /\bo\.?\s*k\.?[\s,.\-]*o\.?\s*k\.?\b/i,
  /\bokok\b/i,
  /ઓકે[\s,.\-]*ઓકે/u,
  /ઓ\s*કે[\s,.\-]*ઓ\s*કે/u,
  /ओके[\s,.\-]*ओके/u,
  /ओ\s*के[\s,.\-]*ओ\s*के/u,
];

export function detectWakeWord(transcript: string, alternatives: string[] = []): {
  detected: boolean;
  remainder: string;
} {
  const candidates = [transcript, ...alternatives].filter(Boolean);
  for (const text of candidates) {
    for (const pattern of WAKE_WORD_PATTERNS) {
      if (pattern.test(text)) {
        const remainder = text.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
        return { detected: true, remainder };
      }
    }
  }
  return { detected: false, remainder: transcript };
}

export function detectStopWord(transcript: string, alternatives: string[] = []): {
  detected: boolean;
  beforeStop: string;
} {
  const candidates = [transcript, ...alternatives].filter(Boolean);
  for (const text of candidates) {
    for (const pattern of STOP_WORD_PATTERNS) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        const beforeStop = text.slice(0, match.index).replace(/\s+/g, ' ').trim();
        return { detected: true, beforeStop };
      }
    }
  }
  return { detected: false, beforeStop: transcript };
}

// Gentle optional Web Audio cue so the merchant hears confirmation without needing to look at the screen
function playAudioCue(type: 'wake' | 'stop'): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'wake' ? 740 : 440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(type === 'wake' ? 980 : 320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 250);
  } catch {
    // Ignore audio context restriction errors
  }
}

export class SpeechService {
  private recognition: SpeechRecognitionInstance | null = null;
  private mode: MicMode = 'idle';
  private shouldKeepAlive = false;
  private currentLang: SupportedLanguage = 'en-IN';
  private callbacks: SpeechCallbacks | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private flushOnStop = false;

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  public startListening(
    language: SupportedLanguage = 'en-IN',
    callbacks: SpeechCallbacks,
    initialMode: 'listening' | 'standby' = 'listening'
  ): boolean {
    if (!SpeechService.isSupported()) {
      callbacks.onError?.('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }

    this.stopListening();
    this.currentLang = language;
    this.callbacks = callbacks;
    this.shouldKeepAlive = true;
    this.setMode(initialMode);

    return this.spawnRecognition();
  }

  public setLanguage(language: SupportedLanguage): void {
    if (this.currentLang === language) return;
    this.currentLang = language;
    if (this.shouldKeepAlive && this.mode !== 'idle') {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {
          // Ignore
        }
      }
    }
  }

  public enterStandby(): void {
    if (!this.shouldKeepAlive) return;
    this.setMode('standby');
    playAudioCue('stop');
    this.callbacks?.onStopWord?.();
  }

  public enterActiveListening(): void {
    if (!this.shouldKeepAlive) return;
    this.setMode('listening');
    playAudioCue('wake');
    this.callbacks?.onWakeWord?.();
  }

  private setMode(nextMode: MicMode): void {
    this.mode = nextMode;
    this.callbacks?.onModeChange?.(nextMode);
  }

  private spawnRecognition(): boolean {
    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) return false;

      const rec = new SpeechRecognitionClass();
      rec.lang = this.currentLang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;

      rec.onstart = () => {
        if (this.mode === 'listening') {
          this.callbacks?.onStart?.();
        }
      };

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        if (!event.results) return;
        const startIdx = typeof event.resultIndex === 'number' ? event.resultIndex : 0;

        const interimParts: string[] = [];
        for (let r = startIdx; r < event.results.length; r++) {
          const resultItem = event.results[r];
          if (!resultItem) continue;

          const alternatives: string[] = [];
          for (let i = 0; i < resultItem.length; i++) {
            if (resultItem[i]?.transcript) alternatives.push(resultItem[i].transcript.trim());
          }
          const topTranscript = alternatives[0] || '';
          if (!topTranscript) continue;

          if (resultItem.isFinal === false) {
            // Interim text is display-only. It is never added to the final command buffer.
            if (this.mode === 'listening') interimParts.push(topTranscript);
            continue;
          }

          this.handleRecognizedUtterance(topTranscript, alternatives);
        }
        this.callbacks?.onInterim?.(interimParts.join(' ').replace(/\s+/g, ' ').trim());
      };

      rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
        // 'no-speech' and 'aborted' are normal in continuous/standby listening; keep alive
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }

        this.shouldKeepAlive = false;
        this.setMode('idle');

        let msg = event.error;
        if (event.error === 'not-allowed') {
          msg = 'Microphone access was denied. Please allow microphone permissions in browser settings.';
        } else if (event.error === 'audio-capture') {
          msg = 'No microphone was found on this system.';
        }
        this.callbacks?.onError?.(msg);
      };

      rec.onend = () => {
        this.recognition = null;
        this.flushOnStop = false;
        if (this.shouldKeepAlive && this.mode !== 'idle') {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.shouldKeepAlive && this.mode !== 'idle') {
              this.spawnRecognition();
            }
          }, 220);
        } else {
          this.setMode('idle');
          this.callbacks?.onEnd?.();
        }
      };

      this.recognition = rec;
      rec.start();
      return true;
    } catch (err: unknown) {
      this.shouldKeepAlive = false;
      this.setMode('idle');
      this.callbacks?.onError?.(err instanceof Error ? err.message : 'Failed to start microphone');
      return false;
    }
  }

  private handleRecognizedUtterance(topTranscript: string, alternatives: string[]): void {
    // 1. Check stop phrase ("OK OK") first if actively listening
    if (this.mode === 'listening') {
      const stopCheck = detectStopWord(topTranscript, alternatives);
      if (stopCheck.detected) {
        if (stopCheck.beforeStop) {
          this.callbacks?.onResult(stopCheck.beforeStop, [stopCheck.beforeStop]);
        }
        this.setMode('standby');
        playAudioCue('stop');
        this.callbacks?.onStopWord?.();
        return;
      }

      // If user says "Fenku <command>" while already listening, strip "Fenku" cleanly
      const wakeCheck = detectWakeWord(topTranscript, alternatives);
      if (wakeCheck.detected) {
        if (wakeCheck.remainder) {
          this.callbacks?.onResult(wakeCheck.remainder, [wakeCheck.remainder]);
        }
        return;
      }

      // Normal active command
      this.callbacks?.onResult(topTranscript, alternatives);
      return;
    }

    // 2. If in Standby mode, only wake up on "Fenku"
    if (this.mode === 'standby') {
      const wakeCheck = detectWakeWord(topTranscript, alternatives);
      if (wakeCheck.detected) {
        this.setMode('listening');
        playAudioCue('wake');
        this.callbacks?.onWakeWord?.();
        if (wakeCheck.remainder) {
          this.callbacks?.onResult(wakeCheck.remainder, [wakeCheck.remainder]);
        }
      }
      // Ignore all other background chatter while in standby
    }
  }

  public stopListening(flushFinalResult = false): void {
    this.shouldKeepAlive = false;
    this.flushOnStop = flushFinalResult;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      const activeRecognition = this.recognition;
      // stop() asks the browser to deliver any pending final result; abort() discards it.
      try {
        if (flushFinalResult) activeRecognition.stop();
        else activeRecognition.abort();
      } catch {
        try { activeRecognition.stop(); } catch { /* Ignore */ }
      }
      if (!flushFinalResult) this.recognition = null;
    }
    this.setMode('idle');
  }

  public getStatus(): boolean {
    return this.mode === 'listening';
  }

  public getMode(): MicMode {
    return this.mode;
  }
}

export const speechService = new SpeechService();
