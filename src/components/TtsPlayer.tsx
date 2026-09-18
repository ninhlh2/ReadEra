import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, X, FastForward } from 'lucide-react';

interface TtsPlayerProps {
  textToRead: string;
  onClose: () => void;
  onNextChunk?: () => void;
}

export const TtsPlayer: React.FC<TtsPlayerProps> = ({
  textToRead,
  onClose,
  onNextChunk,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1.0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt này không hỗ trợ SpeechSynthesis (Đọc văn bản).');
      onClose();
      return;
    }

    startSpeaking(textToRead);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [textToRead]);

  const startSpeaking = (text: string) => {
    window.speechSynthesis.cancel();
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;

    // Pick a voice: try Vietnamese first, otherwise default
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.startsWith('vi'));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => {
      setIsPlaying(false);
      if (onNextChunk) onNextChunk();
    };
    utterance.onerror = () => setIsPlaying(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        startSpeaking(textToRead);
      }
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const handleChangeRate = () => {
    const rates = [0.8, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(rate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setRate(nextRate);
    if (isPlaying) {
      startSpeaking(textToRead);
    }
  };

  return (
    <div className="tts-player-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Volume2 size={18} color="var(--color-primary)" />
        <span className="tts-pulse" style={{ opacity: isPlaying ? 1 : 0.3 }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {isPlaying ? 'Đang đọc...' : 'Tạm dừng'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          className="btn-icon"
          style={{ width: 32, height: 32 }}
          onClick={handleTogglePlay}
          title={isPlaying ? 'Tạm dừng' : 'Tiếp tục'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          className="btn-icon"
          style={{ width: 32, height: 32 }}
          onClick={handleStop}
          title="Dừng hẳn"
        >
          <Square size={14} />
        </button>

        <button
          className="btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 20 }}
          onClick={handleChangeRate}
          title="Tốc độ đọc"
        >
          <FastForward size={12} />
          <span>{rate}x</span>
        </button>
      </div>

      <button
        className="btn-icon"
        style={{ width: 28, height: 28 }}
        onClick={() => {
          handleStop();
          onClose();
        }}
        title="Tắt đọc sách"
      >
        <X size={15} />
      </button>
    </div>
  );
};
