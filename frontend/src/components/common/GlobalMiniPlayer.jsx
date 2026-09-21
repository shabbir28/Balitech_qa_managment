import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { Play, Pause, Square, Music } from 'lucide-react';

/**
 * Floating mini-player bar that appears at the bottom of the screen whenever
 * a recording is loaded in the global AudioPlayerContext.
 * It persists across page navigations so the user can keep listening while
 * filling in other forms or browsing other sections.
 */
export default function GlobalMiniPlayer() {
  const {
    currentRec,
    callInfo,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    toggle,
    stop,
    seek,
    setPlaybackRate,
  } = useAudioPlayer();

  if (!currentRec) return null;

  const pct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const fmt = (s) =>
    !s || isNaN(s)
      ? '0:00'
      : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const label = currentRec.filename
    ? currentRec.filename.replace(/\.[^/.]+$/, '').slice(0, 50)
    : 'Recording';

  return (
    /* Slide-up bar fixed at the bottom */
    <div
      style={{ zIndex: 9999 }}
      className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-indigo-500/30 shadow-2xl shadow-black/60 animate-slide-up-mini"
    >
      {/* Thin progress bar at the very top of the mini-player */}
      <div className="relative h-1 w-full bg-slate-800 cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - rect.left) / rect.width) * (duration || 0));
        }}
      >
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-100 ease-linear"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 100}
          step="0.5"
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-2.5 max-w-screen-xl mx-auto">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Music className="w-3.5 h-3.5 text-indigo-400" />
        </div>

        {/* Track info */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-white truncate leading-tight">
            {label}
          </span>
          {callInfo?.phone && (
            <span className="text-[10px] text-slate-500 font-mono leading-tight">
              {callInfo.phone}
            </span>
          )}
        </div>

        {/* Times */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 shrink-0">
          <span className="text-indigo-300">{fmt(currentTime)}</span>
          <span className="text-slate-600">/</span>
          <span>{fmt(duration)}</span>
        </div>

        {/* Speed */}
        <select
          value={playbackRate}
          onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
          className="hidden sm:block bg-slate-800 text-white text-[10px] rounded px-2 py-1 outline-none border border-slate-700 cursor-pointer shrink-0"
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
            <option key={r} value={r}>{r}x</option>
          ))}
        </select>

        {/* Play / Pause */}
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 shadow-lg shadow-indigo-500/30"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying
            ? <Pause className="w-4 h-4" />
            : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Stop / Dismiss */}
        <button
          onClick={stop}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0"
          aria-label="Stop playback"
          title="Stop & dismiss"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
