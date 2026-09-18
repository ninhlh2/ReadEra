import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export interface TtsVoice {
  id: string;
  name: string;
  lang: string;
  isVietnamese: boolean;
}

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

  // Split on sentence boundaries: (. ! ? or newline) followed by space or quote or end
  // Also preserve dialog quotes
  const rawChunks = protectedText.split(/(?<=[.!?\n])\s+/);

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
 * Background audio keeper: Keeps the audio hardware pipeline and CPU active
 * when the Android screen is turned off or app is minimized.
 */
class BackgroundAudioKeeper {
  private audioEl: HTMLAudioElement | null = null;
  private wakeLock: any = null;

  public start() {
    try {
      if (!this.audioEl && typeof Audio !== 'undefined') {
        this.audioEl = new Audio();
        // 1-second silent WAV in base64
        this.audioEl.src =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        this.audioEl.loop = true;
        this.audioEl.volume = 0.01;
      }
      if (this.audioEl) {
        this.audioEl.play().catch(() => {});
      }
    } catch {}

    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
        (navigator as any).wakeLock
          .request('screen')
          .then((lock: any) => {
            this.wakeLock = lock;
          })
          .catch(() => {});
      }
    } catch {}
  }

  public stop() {
    try {
      if (this.audioEl) {
        this.audioEl.pause();
      }
    } catch {}
    try {
      if (this.wakeLock) {
        this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
      }
    } catch {}
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

  // Callbacks
  private onSentenceChangeListeners: Array<(index: number, text: string, progressRatio: number) => void> = [];
  private onPlaybackStateChangeListeners: Array<(isPlaying: boolean, isPaused: boolean) => void> = [];
  private onSleepTimerTickListeners: Array<(remainingSeconds: number | null, mode: SleepTimerMode) => void> = [];
  private onChapterCompleteListeners: Array<() => void> = [];

  constructor() {
    this.setupMediaSession();
  }

  // --- Voice discovery ---
  public async getAvailableVoices(): Promise<TtsVoice[]> {
    if (this.isNative) {
      try {
        const res = await TextToSpeech.getSupportedVoices();
        if (res && res.voices && res.voices.length > 0) {
          const list: TtsVoice[] = res.voices.map((v, index) => ({
            id: index.toString(),
            name: v.name,
            lang: v.lang,
            isVietnamese: v.lang.toLowerCase().startsWith('vi'),
          }));

          // Sort Vietnamese first
          return list.sort((a, b) => {
            if (a.isVietnamese && !b.isVietnamese) return -1;
            if (!a.isVietnamese && b.isVietnamese) return 1;
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

      const list: TtsVoice[] = voices.map((v) => ({
        id: v.voiceURI,
        name: `${v.name} (${v.lang})`,
        lang: v.lang,
        isVietnamese: v.lang.toLowerCase().startsWith('vi'),
      }));

      return list.sort((a, b) => {
        if (a.isVietnamese && !b.isVietnamese) return -1;
        if (!a.isVietnamese && b.isVietnamese) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    return [];
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
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
    }
  }

  private updateMediaSessionMetadata() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: this.metadata.title || 'ReadEra TTS',
        artist: this.metadata.author || 'ReadEra Reader',
        album: `Câu ${this.currentIndex + 1} / ${this.sentences.length || 1}`,
        artwork: this.metadata.coverUrl
          ? [{ src: this.metadata.coverUrl, sizes: '512x512', type: 'image/png' }]
          : undefined,
      });
      navigator.mediaSession.playbackState = this.isPlaying
        ? this.isPaused
          ? 'paused'
          : 'playing'
        : 'none';
    }
  }

  // --- Queue & Sentence Management ---
  public loadSentences(sentences: string[], startIndex = 0) {
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
    this.isPlaying = false;
    this.isPaused = false;
    this.audioKeeper.stop();
    this.stopSpeakingInternal();
    this.clearSleepTimer();
    this.notifyPlaybackState();
  }

  public nextSentence() {
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
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.notifySentenceChange();
      if (this.isPlaying && !this.isPaused) {
        this.speakCurrentSentence();
      }
    }
  }

  public jumpToSentence(index: number) {
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

  // --- Core Speaking Implementation ---
  private async speakCurrentSentence() {
    if (!this.isPlaying || this.isPaused) return;
    const text = this.sentences[this.currentIndex];
    if (!text || !text.trim()) {
      this.nextSentence();
      return;
    }

    this.stopSpeakingInternal();
    this.updateMediaSessionMetadata();

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
        if (this.isPlaying && !this.isPaused) {
          this.nextSentence();
        }
      } catch (err) {
        console.warn('Lỗi native TTS speak, fallback sang web:', err);
        this.speakWebSpeech(text);
      }
    } else {
      this.speakWebSpeech(text);
    }
  }

  private speakWebSpeech(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

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

    utterance.onend = () => {
      this.clearWebSpeechKeepAlive();
      if (this.isPlaying && !this.isPaused) {
        this.nextSentence();
      }
    };

    utterance.onerror = (e) => {
      this.clearWebSpeechKeepAlive();
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Lỗi Web Speech API:', e.error);
        if (this.isPlaying && !this.isPaused) {
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
    if (this.isNative) {
      try {
        TextToSpeech.stop().catch(() => {});
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private handleListComplete() {
    if (this.sleepTimerMode === 'end_of_chapter') {
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
