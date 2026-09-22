import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

/**
 * Global audio player context.
 * A single <audio> element is mounted at the app level so playback
 * continues even when the user navigates away from EvaluationFormPage.
 */
const AudioPlayerContext = createContext(null);

export function AudioPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const pendingSeekTimeRef = useRef(null);

  // Currently loaded recording object ({ location, filename, tsr, ... })
  const [currentRec, setCurrentRec] = useState(null);
  // Extra context shown in the mini-player (e.g. phone number)
  const [callInfo, setCallInfo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // ── Load a recording and start playing (optionally at a specific offset) ──
  const play = useCallback((rec, info = null, startTime = null) => {
    if (!audioRef.current) return;

    const initialTime = startTime !== null && !isNaN(startTime) ? Math.max(0, parseFloat(startTime)) : null;

    if (currentRec?.location === rec.location) {
      // Same track — just seek if requested and resume
      if (initialTime !== null) {
        try {
          audioRef.current.currentTime = initialTime;
          setCurrentTime(initialTime);
        } catch {
          pendingSeekTimeRef.current = initialTime;
        }
      }
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      return;
    }

    // New track
    setCurrentRec(rec);
    setCallInfo(info);
    const startOffset = initialTime !== null ? initialTime : 0;
    setCurrentTime(startOffset);
    setDuration(rec.length ? parseFloat(rec.length) : 0);
    
    audioRef.current.src = rec.location;
    audioRef.current.defaultPlaybackRate = playbackRate;
    audioRef.current.load();
    audioRef.current.playbackRate = playbackRate;
    
    if (startOffset > 0) {
      pendingSeekTimeRef.current = startOffset;
      try {
        audioRef.current.currentTime = startOffset;
      } catch {
        // Handled in handleLoadedMetadata / onPlay
      }
    }

    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
  }, [currentRec, playbackRate]);

  // ── Pause without clearing state ──────────────────────────────────
  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  // ── Toggle play/pause ─────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (!audioRef.current || !currentRec) return;
    if (isPlaying) {
      pause();
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying, currentRec, pause, playbackRate]);

  // ── Stop and clear everything ─────────────────────────────────────
  const stop = useCallback(() => {
    pendingSeekTimeRef.current = null;
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

  // ── Seek to absolute time (seconds) ───────────────────────────────
  const seek = useCallback((time) => {
    if (!audioRef.current) return;
    const target = Math.max(0, Number(time) || 0);
    setCurrentTime(target);
    try {
      if (audioRef.current.readyState >= 1) { // HAVE_METADATA or higher
        audioRef.current.currentTime = target;
      } else {
        pendingSeekTimeRef.current = target;
      }
    } catch {
      pendingSeekTimeRef.current = target;
    }
  }, []);

  // ── Playback speed ────────────────────────────────────────────────
  const setPlaybackRate = useCallback((rate) => {
    const r = parseFloat(rate) || 1;
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = r;
      audioRef.current.playbackRate = r;
    }
    setPlaybackRateState(r);
  }, []);

  // ── Audio element event handlers ──────────────────────────────────
  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current?.currentTime || 0);
  };

  const handleLoadedMetadata = () => {
    const d = audioRef.current?.duration;
    if (d && isFinite(d)) setDuration(d);
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      if (pendingSeekTimeRef.current !== null) {
        try {
          audioRef.current.currentTime = pendingSeekTimeRef.current;
          setCurrentTime(pendingSeekTimeRef.current);
          pendingSeekTimeRef.current = null;
        } catch {
          // ignore
        }
      }
    }
  };

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      if (pendingSeekTimeRef.current !== null) {
        try {
          audioRef.current.currentTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;
        } catch {
          // ignore
        }
      }
    }
    setIsPlaying(true);
  };

  const handleEnded = () => setIsPlaying(false);

  // Keep playbackRate in sync if the element is reused or state updates
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = playbackRate;
      audioRef.current.playbackRate = playbackRate;
    }
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
        onPlay={handlePlay}
        onPause={() => setIsPlaying(false)}
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
