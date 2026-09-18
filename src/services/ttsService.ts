import { Capacitor, registerPlugin } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

interface AppHelperPlugin {
  openTtsSettings(): Promise<void>;
}
const AppHelper = registerPlugin<AppHelperPlugin>('AppHelper');

export interface TtsVoice {
  id: string;
  name: string;
  rawName?: string;
  lang: string;
  isVietnamese: boolean;
  isNatural?: boolean;
  engine?: string;
}

export type TtsPauseMode = 'compact' | 'natural' | 'relaxed';

export type SleepTimerMode =
  | 'off'
  | '5m'
  | '10m'
  | '15m'
  | '30m'
  | '45m'
  | '60m'
  | 'end_of_chapter';

export interface TtsMetadata {
  title: string;
  author?: string;
  coverUrl?: string;
}

/**
 * Smart sentence tokenizer supporting Vietnamese and English punctuation,
 * abbreviations (TP., TS., Th.S, GS., PGS., BS., v.v., Mr., Mrs., Dr., etc.)
 */
export function splitIntoSentences(rawText: string): string[] {
  if (!rawText) return [];

  // Normalize newlines and clean extraneous whitespace
  const text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!text) return [];

  // Common abbreviations that shouldn't cause sentence split
  const abbrList = [
    'tp', 'th.s', 'ths', 'ts', 'gs', 'pgs', 'bs', 'ds', 'ks',
    'v.v', 'vv', 'nxb', 'bt', 'ct', 'đc',
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
    'vs', 'etc', 'e.g', 'i.e', 'approx', 'dept', 'est',
  ];

  // Protect abbreviations and decimal numbers temporarily
  let protectedText = text;

  // Protect decimals like 3.14, 1.000
  protectedText = protectedText.replace(/(\d)\.(\d)/g, '$1__DOT__$2');

  // Protect abbreviations
  abbrList.forEach((abbr) => {
    const regex = new RegExp(`\\b(${abbr})\\.(\\s+)`, 'gi');
    protectedText = protectedText.replace(regex, '$1__DOT__$2');
  });

  // Protect ellipsis
  protectedText = protectedText.replace(/\.{3,}/g, '__ELLIPSIS__');

  // Split on sentence boundaries: (. ! ? or newline) optionally followed by closing quotes, then space
  const rawChunks = protectedText.split(/(?<=[.!?\n]["'”’]?)\s+/);

  const sentences: string[] = [];

  for (let chunk of rawChunks) {
    chunk = chunk
      .replace(/__DOT__/g, '.')
      .replace(/__ELLIPSIS__/g, '...')
      .trim();

    if (!chunk) continue;

    // Further split on double newlines (paragraphs)
    const subLines = chunk.split(/\n{2,}/);
    for (let sub of subLines) {
      sub = sub.replace(/\n/g, ' ').trim();
      // Ignore empty or purely punctuation items
      if (sub.length > 0 && /[a-zA-Z0-9\u00C0-\u1EF9]/.test(sub)) {
        sentences.push(sub);
      }
    }
  }

  return sentences;
}

/**
 * Formats raw voice names and identifiers into clear, recognizable labels with engine tags.
 */
export function formatVoiceLabel(
  rawName: string,
  voiceURI?: string,
  lang?: string,
  index?: number
): { name: string; engine?: string; isNatural?: boolean } {
  const uri = (voiceURI || '').toLowerCase();
  const nameLower = (rawName || '').toLowerCase();
  const isVi = (lang || '').toLowerCase().startsWith('vi') || uri.includes('vi-vn') || uri.includes('vie');

  let engine = 'Hệ thống';
  if (uri.includes('samsung') || uri.includes('smt') || nameLower.includes('samsung')) {
    engine = 'Samsung Engine';
  } else if (uri.includes('google') || nameLower.includes('google') || uri.includes('vic') || uri.includes('vie') || uri.includes('gft')) {
    engine = 'Google TTS';
  } else if (uri.includes('microsoft') || nameLower.includes('microsoft')) {
    engine = 'Microsoft';
  } else if (uri.includes('apple') || nameLower.includes('siri')) {
    engine = 'Apple Siri';
  }

  let gender = '';
  if (
    uri.includes('-f00') ||
    uri.includes('female') ||
    uri.includes('-f-') ||
    nameLower.includes('female') ||
    nameLower.includes('nữ') ||
    nameLower.includes('mai') ||
    nameLower.includes('zira')
  ) {
    gender = 'Nữ';
  } else if (
    uri.includes('-m00') ||
    uri.includes('male') ||
    uri.includes('-m-') ||
    nameLower.includes('male') ||
    nameLower.includes('nam') ||
    nameLower.includes('david')
  ) {
    gender = 'Nam';
  }

  let quality = '';
  const isNatural =
    uri.includes('natural') ||
    uri.includes('online') ||
    uri.includes('neural') ||
    nameLower.includes('natural') ||
    nameLower.includes('online') ||
    nameLower.includes('neural') ||
    nameLower.includes('hoaimy') ||
    nameLower.includes('namminh');

  if (isNatural) {
    quality = '✨ Tự nhiên';
  } else if (uri.includes('network')) {
    quality = 'Trực tuyến';
  } else if (uri.includes('local') || uri.includes('offline') || uri.includes('embedded')) {
    quality = 'Ngoại tuyến';
  }

  if (isVi) {
    const parts: string[] = ['🇻🇳 Tiếng Việt'];
    if (gender) parts.push(`Giọng ${gender}`);
    else if (typeof index === 'number') parts.push(`Giọng ${index + 1}`);

    if (quality) parts.push(quality);
    parts.push(`(${engine})`);
    return { name: parts.join(' - '), engine, isNatural };
  }

  // Non-Vietnamese
  const langTag = lang ? `[${lang}]` : '';
  const finalName = `${rawName || 'Voice'} ${langTag} (${engine})`.trim();
  return { name: finalName, engine, isNatural };
}

/**
 * Background audio keeper: Keeps the audio hardware pipeline and CPU active
 * when the Android screen is turned off or app is minimized, maintaining Lock Screen presence.
 */
class BackgroundAudioKeeper {
  private audioEl: HTMLAudioElement | null = null;
  private wakeLock: any = null;

  public start() {
    try {
      if (!this.audioEl && typeof Audio !== 'undefined') {
        this.audioEl = new Audio();
        // Silent WAV track in base64
        this.audioEl.src =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        this.audioEl.loop = true;
        this.audioEl.volume = 0.05;
      }
      if (this.audioEl) {
        this.audioEl.play().catch(() => { });
      }
    } catch { }

    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
        (navigator as any).wakeLock
          .request('screen')
          .then((lock: any) => {
            this.wakeLock = lock;
          })
          .catch(() => { });
      }
    } catch { }
  }

  public stop() {
    try {
      if (this.audioEl) {
        this.audioEl.pause();
      }
    } catch { }
    try {
      if (this.wakeLock) {
        this.wakeLock.release().catch(() => { });
        this.wakeLock = null;
      }
    } catch { }
  }
}

class TtsServiceManager {
  private isNative = Capacitor.isNativePlatform();
  private sentences: string[] = [];
  private currentIndex = 0;
  private isPlaying = false;
  private isPaused = false;
  private rate = 1.0;
  private pitch = 1.0;
  private selectedVoiceId: string | null = null;
  private metadata: TtsMetadata = { title: 'ReadEra' };
  private audioKeeper = new BackgroundAudioKeeper();

  // Timer
  private sleepTimerMode: SleepTimerMode = 'off';
  private sleepTimerRemaining: number | null = null; // in seconds
  private sleepIntervalId: any = null;

  // Web speech fallback ref
  private keepAliveInterval: any = null;

  // Speaking session control (cancels stale speak loops)
  private speechSessionId = 0;
  private pendingPauseTimer: any = null;

  // Callbacks
  private onSentenceChangeListeners: Array<(index: number, text: string, progressRatio: number) => void> = [];
  private onPlaybackStateChangeListeners: Array<(isPlaying: boolean, isPaused: boolean) => void> = [];
  private onSleepTimerTickListeners: Array<(remainingSeconds: number | null, mode: SleepTimerMode) => void> = [];
  private onChapterCompleteListeners: Array<() => void> = [];
  private beforeSpeakHook: ((index: number, text: string) => Promise<void> | void) | null = null;

  constructor() {
    this.setupMediaSession();
  }

  public setBeforeSpeakHook(hook: ((index: number, text: string) => Promise<void> | void) | null) {
    this.beforeSpeakHook = hook;
  }

  // --- Voice discovery ---
  public async getAvailableVoices(): Promise<TtsVoice[]> {
    if (this.isNative) {
      try {
        const res = await TextToSpeech.getSupportedVoices();
        if (res && res.voices && res.voices.length > 0) {
          const list: TtsVoice[] = res.voices.map((v, index) => {
            const formatted = formatVoiceLabel(v.name, v.voiceURI, v.lang, index);
            return {
              id: index.toString(),
              name: formatted.name,
              rawName: v.name,
              lang: v.lang,
              isVietnamese: Boolean(
                v.lang.toLowerCase().startsWith('vi') ||
                (v.voiceURI && v.voiceURI.toLowerCase().includes('vi'))
              ),
              isNatural: formatted.isNatural,
              engine: formatted.engine,
            };
          });

          // Sort Vietnamese first (with natural voices prioritized), then other languages
          return list.sort((a, b) => {
            if (a.isVietnamese && !b.isVietnamese) return -1;
            if (!a.isVietnamese && b.isVietnamese) return 1;
            if (a.isVietnamese && b.isVietnamese) {
              if (a.isNatural && !b.isNatural) return -1;
              if (!a.isNatural && b.isNatural) return 1;
            }
            return a.name.localeCompare(b.name);
          });
        }
      } catch (err) {
        console.warn('Lỗi lấy giọng đọc native:', err);
      }
    }

    // Web Speech API fallback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const getWebVoices = (): SpeechSynthesisVoice[] => {
        return window.speechSynthesis.getVoices();
      };

      let voices = getWebVoices();
      if (voices.length === 0) {
        // Wait for voiceschanged event if not loaded yet
        await new Promise<void>((resolve) => {
          const handler = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', handler);
            resolve();
          };
          window.speechSynthesis.addEventListener('voiceschanged', handler);
          setTimeout(resolve, 500); // timeout safeguard
        });
        voices = getWebVoices();
      }

      const list: TtsVoice[] = voices.map((v, index) => {
        const formatted = formatVoiceLabel(v.name, v.voiceURI, v.lang, index);
        return {
          id: v.voiceURI,
          name: formatted.name,
          rawName: v.name,
          lang: v.lang,
          isVietnamese: v.lang.toLowerCase().startsWith('vi'),
          isNatural: formatted.isNatural,
          engine: formatted.engine,
        };
      });

      return list.sort((a, b) => {
        if (a.isVietnamese && !b.isVietnamese) return -1;
        if (!a.isVietnamese && b.isVietnamese) return 1;
        if (a.isVietnamese && b.isVietnamese) {
          if (a.isNatural && !b.isNatural) return -1;
          if (!a.isNatural && b.isNatural) return 1;
        }
        return a.name.localeCompare(b.name);
      });
    }

    return [];
  }

  // --- Open Android/System TTS Settings (Samsung, Google, etc.) ---
  public async openTtsSettings(): Promise<void> {
    if (this.isNative) {
      try {
        await AppHelper.openTtsSettings();
        return;
      } catch (err) {
        console.warn('Lỗi AppHelper.openTtsSettings, fallback TextToSpeech.openInstall:', err);
        try {
          await TextToSpeech.openInstall();
          return;
        } catch { }
      }
    } else {
      alert('Tùy chỉnh Engine (Samsung, Google...) chỉ khả dụng trên thiết bị Android / iOS.');
    }
  }

  // --- Metadata & MediaSession ---
  public setMetadata(meta: TtsMetadata) {
    this.metadata = meta;
    this.updateMediaSessionMetadata();
  }

  private setupMediaSession() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevSentence());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextSentence());
      navigator.mediaSession.setActionHandler('seekbackward', () => this.prevSentence());
      navigator.mediaSession.setActionHandler('seekforward', () => this.nextSentence());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
    }
  }

  private updateMediaSessionMetadata() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: this.metadata.title || 'ReadEra TTS',
        artist: this.metadata.author || 'ReadEra Reader',
        album: `Câu ${this.currentIndex + 1} / ${this.sentences.length || 1}`,
        artwork: [
          {
            src: this.metadata.coverUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 24 24" fill="%236366f1"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      });
      navigator.mediaSession.playbackState = this.isPlaying
        ? this.isPaused
          ? 'paused'
          : 'playing'
        : 'none';

      // Lock screen progress scrubber state
      if ('setPositionState' in navigator.mediaSession && this.sentences.length > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(1, this.sentences.length),
            playbackRate: 1.0,
            position: Math.min(this.currentIndex + 1, Math.max(1, this.sentences.length)),
          });
        } catch { }
      }
    }
  }

  // --- Queue & Sentence Management ---
  public loadSentences(sentences: string[], startIndex = 0) {
    this.speechSessionId++;
    this.clearPendingPause();
    this.stopSpeakingInternal();
    this.sentences = sentences;
    this.currentIndex = Math.max(0, Math.min(startIndex, Math.max(0, sentences.length - 1)));
    this.notifySentenceChange();
  }

  public getSentences(): string[] {
    return this.sentences;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentSentence(): string {
    return this.sentences[this.currentIndex] || '';
  }

  public getProgressRatio(): number {
    if (this.sentences.length === 0) return 0;
    return (this.currentIndex + 1) / this.sentences.length;
  }

  // --- Playback Controls ---
  public async play() {
    if (this.sentences.length === 0) return;

    if (this.isPaused) {
      await this.resume();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.audioKeeper.start();
    this.notifyPlaybackState();
    this.speakCurrentSentence();
  }

  public async pause() {
    this.speechSessionId++;
    this.clearPendingPause();
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.audioKeeper.stop();
    this.stopSpeakingInternal();
    this.notifyPlaybackState();
  }

  public async resume() {
    if (!this.isPlaying) {
      this.play();
      return;
    }
    this.isPaused = false;
    this.audioKeeper.start();
    this.notifyPlaybackState();
    this.speakCurrentSentence();
  }

  public async stop() {
    this.speechSessionId++;
    this.clearPendingPause();
    this.isPlaying = false;
    this.isPaused = false;
    this.audioKeeper.stop();
    this.stopSpeakingInternal();
    this.clearSleepTimer();
    this.notifyPlaybackState();
  }

  public nextSentence() {
    this.speechSessionId++;
    this.clearPendingPause();
    if (this.currentIndex < this.sentences.length - 1) {
      this.currentIndex++;
      this.notifySentenceChange();
      if (this.isPlaying && !this.isPaused) {
        this.speakCurrentSentence();
      }
    } else {
      // Reached the end of current list
      this.handleListComplete();
    }
  }

  public prevSentence() {
    this.speechSessionId++;
    this.clearPendingPause();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.notifySentenceChange();
      if (this.isPlaying && !this.isPaused) {
        this.speakCurrentSentence();
      }
    }
  }

  public jumpToSentence(index: number) {
    this.speechSessionId++;
    this.clearPendingPause();
    if (index >= 0 && index < this.sentences.length) {
      this.currentIndex = index;
      this.notifySentenceChange();
      if (this.isPlaying && !this.isPaused) {
        this.speakCurrentSentence();
      }
    }
  }

  // --- Settings ---
  public setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(3.0, rate));
    if (this.isPlaying && !this.isPaused) {
      this.speakCurrentSentence();
    }
  }

  public getRate(): number {
    return this.rate;
  }

  public setPitch(pitch: number) {
    this.pitch = Math.max(0.5, Math.min(1.5, pitch));
    if (this.isPlaying && !this.isPaused) {
      this.speakCurrentSentence();
    }
  }

  public getPitch(): number {
    return this.pitch;
  }

  public setVoice(voiceId: string | null) {
    this.selectedVoiceId = voiceId;
    if (this.isPlaying && !this.isPaused) {
      this.speakCurrentSentence();
    }
  }

  public getSelectedVoiceId(): string | null {
    return this.selectedVoiceId;
  }

  // --- Pause Duration Mode ---
  private pauseMode: TtsPauseMode = 'natural';

  public setPauseMode(mode: TtsPauseMode) {
    this.pauseMode = mode;
  }

  public getPauseMode(): TtsPauseMode {
    return this.pauseMode;
  }

  public getSentencePauseDuration(sentenceText?: string): number {
    const text = (sentenceText || '').trim();
    // 'natural' is ~75ms (human breathing pause, not rushed, not too long)
    // 'compact' is ~25ms (flowing reading with minimal gap)
    // 'relaxed' is ~160ms (slower contemplation pause)
    let baseMs = 75;
    if (this.pauseMode === 'compact') baseMs = 5;
    else if (this.pauseMode === 'relaxed') baseMs = 160;

    // Sub-clauses ending with comma, semicolon, or colon need even less pause
    if (/[,;:]$/.test(text) || /[,;:]["”’']$/.test(text)) {
      baseMs = Math.round(baseMs * 0.45);
    }

    return Math.max(5, Math.round(baseMs / this.rate));
  }

  // --- Sleep Timer ---
  public setSleepTimer(mode: SleepTimerMode) {
    this.sleepTimerMode = mode;
    this.clearSleepTimer();

    if (mode === 'off') {
      this.notifySleepTimerTick();
      return;
    }

    if (mode === 'end_of_chapter') {
      this.sleepTimerRemaining = null;
      this.notifySleepTimerTick();
      return;
    }

    const minutesMap: Record<string, number> = {
      '5m': 5,
      '10m': 10,
      '15m': 15,
      '30m': 30,
      '45m': 45,
      '60m': 60,
    };

    const minutes = minutesMap[mode] || 15;
    this.sleepTimerRemaining = minutes * 60;
    this.notifySleepTimerTick();

    this.sleepIntervalId = setInterval(() => {
      if (this.sleepTimerRemaining !== null) {
        this.sleepTimerRemaining--;
        this.notifySleepTimerTick();

        if (this.sleepTimerRemaining <= 0) {
          this.clearSleepTimer();
          this.stop();
        }
      }
    }, 1000);
  }

  public getSleepTimerMode(): SleepTimerMode {
    return this.sleepTimerMode;
  }

  public getSleepTimerRemaining(): number | null {
    return this.sleepTimerRemaining;
  }

  private clearSleepTimer() {
    if (this.sleepIntervalId) {
      clearInterval(this.sleepIntervalId);
      this.sleepIntervalId = null;
    }
    if (this.sleepTimerMode !== 'end_of_chapter') {
      this.sleepTimerRemaining = null;
    }
  }

  // --- Pause Between Sentences Helper ---
  private sentencePause(ms: number, sessionId: number): Promise<void> {
    return new Promise((resolve) => {
      this.clearPendingPause();
      this.pendingPauseTimer = setTimeout(() => {
        this.pendingPauseTimer = null;
        if (this.speechSessionId === sessionId) {
          resolve();
        }
      }, ms);
    });
  }

  private clearPendingPause() {
    if (this.pendingPauseTimer) {
      clearTimeout(this.pendingPauseTimer);
      this.pendingPauseTimer = null;
    }
  }

  // --- Core Speaking Implementation ---
  private async speakCurrentSentence() {
    if (!this.isPlaying || this.isPaused) return;
    const sessionId = ++this.speechSessionId;
    this.clearPendingPause();

    const text = this.sentences[this.currentIndex];
    if (!text || !text.trim()) {
      if (this.speechSessionId === sessionId && this.isPlaying && !this.isPaused) {
        this.nextSentence();
      }
      return;
    }

    this.stopSpeakingInternal();
    this.updateMediaSessionMetadata();

    // Allow reader view to turn page or highlight before speech begins
    if (this.beforeSpeakHook) {
      try {
        await Promise.race([
          this.beforeSpeakHook(this.currentIndex, text),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch (err) {
        console.warn('Lỗi beforeSpeakHook:', err);
      }
    }

    // Abort if playback was stopped, paused, or sentence changed while hook was running
    if (this.speechSessionId !== sessionId || !this.isPlaying || this.isPaused) return;

    if (this.isNative) {
      try {
        await TextToSpeech.speak({
          text: text.trim(),
          lang: 'vi-VN',
          rate: this.rate,
          pitch: this.pitch,
          volume: 1.0,
          category: 'playback',
          voice: this.selectedVoiceId ? parseInt(this.selectedVoiceId, 10) || undefined : undefined,
        });

        // Finished speaking this sentence
        if (this.speechSessionId === sessionId && this.isPlaying && !this.isPaused) {
          const pauseMs = this.getSentencePauseDuration(text);
          await this.sentencePause(pauseMs, sessionId);
          if (this.speechSessionId === sessionId && this.isPlaying && !this.isPaused) {
            this.nextSentence();
          }
        }
      } catch (err) {
        // Only fallback if this speech session is still valid and actively playing
        if (this.speechSessionId !== sessionId || !this.isPlaying || this.isPaused) {
          return;
        }
        console.warn('Lỗi native TTS speak, fallback sang web:', err);
        this.speakWebSpeech(text, sessionId);
      }
    } else {
      this.speakWebSpeech(text, sessionId);
    }
  }

  private speakWebSpeech(text: string, sessionId: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.speechSessionId !== sessionId || !this.isPlaying || this.isPaused) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    // Voice selection
    const voices = window.speechSynthesis.getVoices();
    if (this.selectedVoiceId) {
      const v = voices.find((x) => x.voiceURI === this.selectedVoiceId);
      if (v) utterance.voice = v;
    } else {
      // Pick Vietnamese first
      const vi = voices.find((x) => x.lang.toLowerCase().startsWith('vi'));
      if (vi) utterance.voice = vi;
    }

    utterance.onend = async () => {
      this.clearWebSpeechKeepAlive();
      if (this.speechSessionId === sessionId && this.isPlaying && !this.isPaused) {
        const pauseMs = this.getSentencePauseDuration(text);
        await this.sentencePause(pauseMs, sessionId);
        if (this.speechSessionId === sessionId && this.isPlaying && !this.isPaused) {
          this.nextSentence();
        }
      }
    };

    utterance.onerror = (e) => {
      this.clearWebSpeechKeepAlive();
      if (this.speechSessionId !== sessionId || !this.isPlaying || this.isPaused) {
        return;
      }
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Lỗi Web Speech API:', e.error);
        if (this.speechSessionId === sessionId && this.isPlaying && !this.isPaused) {
          this.nextSentence();
        }
      }
    };

    // Keep-alive workaround for browser 15s pause bug
    this.startWebSpeechKeepAlive();
    window.speechSynthesis.speak(utterance);
  }

  private startWebSpeechKeepAlive() {
    this.clearWebSpeechKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 10000);
  }

  private clearWebSpeechKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private stopSpeakingInternal() {
    this.clearWebSpeechKeepAlive();
    this.clearPendingPause();
    if (this.isNative) {
      try {
        TextToSpeech.stop().catch(() => { });
      } catch { }
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private handleListComplete() {
    this.speechSessionId++;
    this.clearPendingPause();

    if (this.sleepTimerMode === 'end_of_chapter') {
      this.stop();
      return;
    }

    if (this.onChapterCompleteListeners.length === 0) {
      this.stop();
      return;
    }

    // Trigger chapter complete event so reader can advance chapter
    for (const listener of this.onChapterCompleteListeners) {
      listener();
    }
  }

  // --- Listeners & Subscriptions ---
  public onSentenceChange(cb: (index: number, text: string, progressRatio: number) => void) {
    this.onSentenceChangeListeners.push(cb);
    return () => {
      this.onSentenceChangeListeners = this.onSentenceChangeListeners.filter((l) => l !== cb);
    };
  }

  public onPlaybackStateChange(cb: (isPlaying: boolean, isPaused: boolean) => void) {
    this.onPlaybackStateChangeListeners.push(cb);
    return () => {
      this.onPlaybackStateChangeListeners = this.onPlaybackStateChangeListeners.filter((l) => l !== cb);
    };
  }

  public onSleepTimerTick(cb: (remainingSeconds: number | null, mode: SleepTimerMode) => void) {
    this.onSleepTimerTickListeners.push(cb);
    return () => {
      this.onSleepTimerTickListeners = this.onSleepTimerTickListeners.filter((l) => l !== cb);
    };
  }

  public onChapterComplete(cb: () => void) {
    this.onChapterCompleteListeners.push(cb);
    return () => {
      this.onChapterCompleteListeners = this.onChapterCompleteListeners.filter((l) => l !== cb);
    };
  }

  private notifySentenceChange() {
    const text = this.getCurrentSentence();
    const ratio = this.getProgressRatio();
    this.updateMediaSessionMetadata();
    for (const l of this.onSentenceChangeListeners) {
      l(this.currentIndex, text, ratio);
    }
  }

  private notifyPlaybackState() {
    this.updateMediaSessionMetadata();
    for (const l of this.onPlaybackStateChangeListeners) {
      l(this.isPlaying, this.isPaused);
    }
  }

  private notifySleepTimerTick() {
    for (const l of this.onSleepTimerTickListeners) {
      l(this.sleepTimerRemaining, this.sleepTimerMode);
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }
}

export const ttsService = new TtsServiceManager();
