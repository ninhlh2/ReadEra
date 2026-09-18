import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  X,
  FastForward,
  Settings,
  Clock,
  Mic,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { ttsService } from '../services/ttsService';
import type { TtsVoice, SleepTimerMode, TtsPauseMode } from '../services/ttsService';

interface TtsPlayerProps {
  bookTitle?: string;
  chapterTitle?: string;
  sentences: string[];
  initialSentenceIndex?: number;
  highlightEnabled?: boolean;
  onToggleHighlight?: (enabled: boolean) => void;
  onSentenceChange?: (index: number, sentenceText: string) => void;
  onClose: () => void;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  onPlayResume?: () => Promise<void> | void;
}

export const TtsPlayer: React.FC<TtsPlayerProps> = ({
  bookTitle,
  chapterTitle,
  sentences,
  initialSentenceIndex = 0,
  highlightEnabled = true,
  onToggleHighlight,
  onSentenceChange,
  onClose,
  onNextChapter,
  onPlayResume,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialSentenceIndex);
  const [rate, setRate] = useState(ttsService.getRate());
  const [pitch, setPitch] = useState(ttsService.getPitch());
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(ttsService.getSelectedVoiceId());
  const [sleepMode, setSleepMode] = useState<SleepTimerMode>(ttsService.getSleepTimerMode());
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(ttsService.getSleepTimerRemaining());
  const [pauseMode, setPauseMode] = useState<TtsPauseMode>(ttsService.getPauseMode());
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Initialize service with metadata and sentences
  useEffect(() => {
    ttsService.setMetadata({
      title: chapterTitle || bookTitle || 'ReadEra TTS',
      author: bookTitle,
    });
  }, [bookTitle, chapterTitle]);

  // Load voices on mount
  useEffect(() => {
    ttsService.getAvailableVoices().then((list) => {
      setVoices(list);
      if (!selectedVoiceId && list.length > 0) {
        // Auto select first Vietnamese Natural voice or default Vietnamese
        const vi = list.find((v) => v.isVietnamese && v.isNatural) || list.find((v) => v.isVietnamese);
        if (vi) {
          setSelectedVoiceId(vi.id);
          ttsService.setVoice(vi.id);
        }
      }
    });
  }, []);

  // Listen for TTS events
  useEffect(() => {
    const unsubSentence = ttsService.onSentenceChange((idx, text) => {
      setCurrentIndex(idx);
      if (onSentenceChange) {
        onSentenceChange(idx, text);
      }
    });

    const unsubPlayback = ttsService.onPlaybackStateChange((playing, paused) => {
      setIsPlaying(playing);
      setIsPaused(paused);
    });

    const unsubTimer = ttsService.onSleepTimerTick((remaining, mode) => {
      setSleepRemaining(remaining);
      setSleepMode(mode);
    });

    const unsubComplete = ttsService.onChapterComplete(() => {
      if (onNextChapter) {
        onNextChapter();
      }
    });

    return () => {
      unsubSentence();
      unsubPlayback();
      unsubTimer();
      unsubComplete();
    };
  }, [onSentenceChange, onNextChapter]);

  // Ensure TTS stops when player is unmounted/closed
  useEffect(() => {
    return () => {
      ttsService.stop();
    };
  }, []);

  const lastLoadedSentencesRef = useRef<string[] | null>(null);

  // When sentences change (e.g. new chapter loaded or opened)
  useEffect(() => {
    if (sentences.length > 0 && sentences !== lastLoadedSentencesRef.current) {
      lastLoadedSentencesRef.current = sentences;
      ttsService.loadSentences(sentences, initialSentenceIndex);
      ttsService.play();
    }
  }, [sentences]);

  const handleTogglePlay = async () => {
    if (isPlaying && !isPaused) {
      ttsService.pause();
    } else {
      if (onPlayResume) {
        try {
          await onPlayResume();
        } catch (err) {
          console.warn('Lỗi onPlayResume:', err);
        }
      }
      ttsService.play();
    }
  };

  const handleStop = () => {
    ttsService.stop();
    onClose();
  };

  const handlePrev = () => {
    ttsService.prevSentence();
  };

  const handleNext = () => {
    ttsService.nextSentence();
  };

  const handleCycleRate = () => {
    const rates = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0];
    const curIdx = rates.findIndex((r) => Math.abs(r - rate) < 0.05);
    const nextRate = rates[(curIdx + 1) % rates.length];
    setRate(nextRate);
    ttsService.setRate(nextRate);
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    ttsService.setRate(newRate);
  };

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch);
    ttsService.setPitch(newPitch);
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    ttsService.setVoice(voiceId || null);
  };

  const handleSleepModeChange = (mode: SleepTimerMode) => {
    setSleepMode(mode);
    ttsService.setSleepTimer(mode);
  };

  const formatTimer = (seconds: number | null) => {
    if (seconds === null) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent =
    sentences.length > 0 ? Math.round(((currentIndex + 1) / sentences.length) * 100) : 0;

  return (
    <>
      {/* Floating ReadEra Bottom Bar */}
      <div className="readera-tts-floating-bar">
        {/* Progress Fill Bar along the top of the player */}
        <div
          className="readera-tts-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />

        <div className="readera-tts-main-row">
          {/* Left: Info & State */}
          <div className="readera-tts-info-section">
            <div className="readera-tts-icon-wrap">
              <Volume2
                size={20}
                className={`readera-tts-speaker-icon ${isPlaying && !isPaused ? 'pulsing' : ''}`}
              />
            </div>
            <div className="readera-tts-text-wrap">
              <span className="readera-tts-chapter-title">
                {chapterTitle || bookTitle || 'Đang đọc'}
              </span>
              <div className="readera-tts-meta-row">
                <span className="readera-tts-counter">
                  Câu {currentIndex + 1} / {sentences.length || 1} ({progressPercent}%)
                </span>
                {sleepRemaining !== null && (
                  <span className="readera-tts-timer-badge" title="Thời gian hẹn giờ còn lại">
                    <Clock size={11} />
                    {formatTimer(sleepRemaining)}
                  </span>
                )}
                {sleepMode === 'end_of_chapter' && (
                  <span className="readera-tts-timer-badge" title="Dừng khi đọc hết chương">
                    <Clock size={11} />
                    Hết chương
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Core Controls */}
          <div className="readera-tts-controls">
            <button
              className="readera-tts-btn btn-prev"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              title="Lùi lại 1 câu (Trước)"
            >
              <SkipBack size={18} />
            </button>

            <button
              className={`readera-tts-btn btn-play-pause ${isPlaying && !isPaused ? 'playing' : ''}`}
              onClick={handleTogglePlay}
              title={isPlaying && !isPaused ? 'Tạm dừng' : 'Tiếp tục đọc'}
            >
              {isPlaying && !isPaused ? <Pause size={22} /> : <Play size={22} />}
            </button>

            <button
              className="readera-tts-btn btn-next"
              onClick={handleNext}
              disabled={currentIndex >= sentences.length - 1}
              title="Chuyển sang câu kế tiếp (Sau)"
            >
              <SkipForward size={18} />
            </button>
          </div>

          {/* Right: Quick actions */}
          <div className="readera-tts-actions">
            {/* Speed toggle */}
            <button
              className="readera-tts-chip-btn"
              onClick={handleCycleRate}
              title="Tốc độ đọc (Bấm để đổi)"
            >
              <FastForward size={13} />
              <span>{rate.toFixed(1)}x</span>
            </button>

            {/* Settings Modal Toggle */}
            <button
              className={`readera-tts-icon-btn ${showSettingsModal ? 'active' : ''}`}
              onClick={() => setShowSettingsModal((prev) => !prev)}
              title="Cài đặt giọng đọc & hẹn giờ"
            >
              <Settings size={18} />
            </button>

            {/* Stop & Close */}
            <button
              className="readera-tts-icon-btn btn-close"
              onClick={handleStop}
              title="Dừng đọc và đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded TTS Settings Modal / Bottom Sheet */}
      {showSettingsModal && (
        <div className="readera-tts-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div
            className="readera-tts-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="readera-tts-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="var(--color-primary)" />
                <h3>Cài đặt Giọng đọc ReadEra</h3>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowSettingsModal(false)}
                title="Đóng bảng cài đặt"
              >
                <X size={18} />
              </button>
            </div>

            <div className="readera-tts-modal-body">
              {/* Voice Selector */}
              <div className="tts-setting-group">
                <label className="tts-setting-label">
                  <Mic size={16} />
                  <span>Chọn Giọng Đọc</span>
                </label>
                <div className="tts-select-wrapper">
                  <select
                    className="tts-voice-select"
                    value={selectedVoiceId || ''}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                  >
                    {voices.length === 0 && (
                      <option value="">Giọng đọc mặc định hệ thống</option>
                    )}
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.isVietnamese ? (v.name.startsWith('⭐') ? v.name : `⭐ ${v.name}`) : v.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="select-arrow" />
                </div>

                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => ttsService.openTtsSettings()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary, #6366f1)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 0',
                    }}
                    title="Mở cài đặt giọng đọc trên máy để kích hoạt Samsung Engine hoặc tải thêm giọng"
                  >
                    <Settings size={13} />
                    <span>Cài đặt giọng đọc hệ thống (Samsung / Google)</span>
                  </button>
                </div>
              </div>

              {/* Speed Slider */}
              <div className="tts-setting-group">
                <div className="tts-setting-label-row">
                  <label className="tts-setting-label">
                    <FastForward size={16} />
                    <span>Tốc độ đọc</span>
                  </label>
                  <span className="tts-slider-value">{rate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                  className="tts-range-slider"
                />
                <div className="tts-chip-row">
                  {[0.8, 1.0, 1.2, 1.5, 2.0].map((r) => (
                    <button
                      key={r}
                      className={`tts-chip ${Math.abs(rate - r) < 0.05 ? 'active' : ''}`}
                      onClick={() => handleRateChange(r)}
                    >
                      {r.toFixed(1)}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch Slider */}
              <div className="tts-setting-group">
                <div className="tts-setting-label-row">
                  <label className="tts-setting-label">
                    <Volume2 size={16} />
                    <span>Cao độ giọng nói (Pitch)</span>
                  </label>
                  <span className="tts-slider-value">{pitch.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.1"
                  value={pitch}
                  onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                  className="tts-range-slider"
                />
              </div>

              {/* Pause Between Sentences Style */}
              <div className="tts-setting-group">
                <div className="tts-setting-label-row">
                  <label className="tts-setting-label">
                    <Sparkles size={16} />
                    <span>Khoảng ngắt giữa câu</span>
                  </label>
                  <span className="tts-slider-value">
                    {pauseMode === 'compact' ? 'Gọn gàng (~5ms)' : pauseMode === 'relaxed' ? 'Thong thả (~160ms)' : 'Tự nhiên (~70ms)'}
                  </span>
                </div>
                <div className="tts-chip-row">
                  {[
                    { id: 'compact', label: 'Gọn gàng' },
                    { id: 'natural', label: 'Tự nhiên' },
                    { id: 'relaxed', label: 'Thong thả' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      className={`tts-chip ${pauseMode === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setPauseMode(item.id as TtsPauseMode);
                        ttsService.setPauseMode(item.id as TtsPauseMode);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sleep Timer */}
              <div className="tts-setting-group">
                <div className="tts-setting-label-row">
                  <label className="tts-setting-label">
                    <Clock size={16} />
                    <span>Hẹn giờ ngủ</span>
                  </label>
                  {sleepRemaining !== null && (
                    <span className="tts-timer-active-text">
                      Còn lại: {formatTimer(sleepRemaining)}
                    </span>
                  )}
                </div>
                <div className="tts-timer-grid">
                  {(
                    [
                      ['off', 'Tắt'],
                      ['5m', '5 phút'],
                      ['10m', '10 phút'],
                      ['15m', '15 phút'],
                      ['30m', '30 phút'],
                      ['45m', '45 phút'],
                      ['60m', '60 phút'],
                      ['end_of_chapter', 'Hết chương'],
                    ] as [SleepTimerMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      className={`tts-timer-btn ${sleepMode === mode ? 'active' : ''}`}
                      onClick={() => handleSleepModeChange(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Highlight toggle */}
              {onToggleHighlight && (
                <div className="tts-setting-group tts-toggle-group">
                  <span className="tts-toggle-label">Tô sáng câu đang đọc</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={highlightEnabled}
                      onChange={(e) => onToggleHighlight(e.target.checked)}
                    />
                    <span className="slider round" />
                  </label>
                </div>
              )}
            </div>

            <div className="readera-tts-modal-footer">
              <button
                className="btn-primary"
                style={{ width: '100%' }}
                onClick={() => setShowSettingsModal(false)}
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
