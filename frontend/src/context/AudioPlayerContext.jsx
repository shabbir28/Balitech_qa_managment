import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

/**
 * Global audio player context.
 * A single <audio> element is mounted at the app level so playback
 * continues even when the user navigates away from EvaluationFormPage.
 */
const AudioPlayerContext = createContext(null);

export function AudioPlayerProvider({ children }) {
  const audioRef = useRef(null);

  // Currently loaded recording object ({ location, filename, tsr, ... })
  const [currentRec, setCurrentRec] = useState(null);
  // Extra context shown in the mini-player (e.g. phone number)
  const [callInfo, setCallInfo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // ── Load a new recording and start playing immediately ────────────
  const play = useCallback((rec, info = null) => {
    if (!audioRef.current) return;

    if (currentRec?.location === rec.location) {
      // Same track — just resume
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      return;
    }

    // New track
    setCurrentRec(rec);
    setCallInfo(info);
    setCurrentTime(0);
    setDuration(rec.length ? parseFloat(rec.length) : 0);
    audioRef.current.src = rec.location;
    audioRef.current.load();
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
  }, [currentRec]);

  // ── Pause without clearing state ──────────────────────────────────
  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  // ── Toggle play/pause ─────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (!audioRef.current || !currentRec) return;
    if (isPlaying) { pause(); } else { audioRef.current.play().catch(console.error); setIsPlaying(true); }
  }, [isPlaying, currentRec, pause]);

  // ── Stop and clear everything ─────────────────────────────────────
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPlaying(false);
    setCurrentRec(null);
    setCallInfo(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // ── Seek ──────────────────────────────────────────────────────────
  const seek = useCallback((time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  // ── Playback speed ────────────────────────────────────────────────
  const setPlaybackRate = useCallback((rate) => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  // ── Audio element event handlers ──────────────────────────────────
  const handleTimeUpdate = () => setCurrentTime(audioRef.current?.currentTime || 0);
  const handleLoadedMetadata = () => {
    const d = audioRef.current?.duration;
    if (d && isFinite(d)) setDuration(d);
  };
  const handleEnded = () => setIsPlaying(false);

  // Keep playbackRate in sync if the element is reused
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const value = {
    currentRec,
    callInfo,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    play,
    pause,
    toggle,
    stop,
    seek,
    setPlaybackRate,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {/* Single persistent audio element — never unmounted */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
        style={{ display: 'none' }}
      />
      {children}
    </AudioPlayerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer must be used inside <AudioPlayerProvider>');
  return ctx;
}
