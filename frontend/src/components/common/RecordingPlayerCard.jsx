import { useState, useEffect } from 'react';
import { Play, Pause, Download, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { downloadRecording } from '../../utils/recordingDownload';

export default function RecordingPlayerCard({ rec, index, total = 1, callPhone = '' }) {
  const {
    currentRec,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    play,
    pause,
    seek,
    setPlaybackRate,
  } = useAudioPlayer();

  const isThisTrack = currentRec?.location === rec?.location;
  const isThisPlaying = isPlaying && isThisTrack;
  const [downloading, setDownloading] = useState(false);
  const [localRate, setLocalRate] = useState(playbackRate || 1);

  // Keep local rate synced with global player when active
  useEffect(() => {
    if (isThisTrack) {
      setLocalRate(playbackRate);
    }
  }, [isThisTrack, playbackRate]);

  // The dialer reports the exact call length in seconds
  const reportedLength =
    rec?.length !== undefined && rec?.length !== null && String(rec.length).trim() !== ''
      ? Math.round(parseFloat(rec.length))
      : null;

  // Active duration: use audio element duration when loaded, fallback to dialer reportedLength
  const activeDuration = isThisTrack && duration && isFinite(duration) && duration > 0
    ? duration
    : (reportedLength || 0);

  const displayDuration = reportedLength != null && !isNaN(reportedLength) && reportedLength > 0
    ? reportedLength
    : Math.round(activeDuration);

  // Keep current time visible even when paused
  const displayCurrentTime = isThisTrack ? Math.round(currentTime) : 0;

  // Total seconds used for the seek slider
  const totalSec = activeDuration > 0 ? activeDuration : (displayDuration > 0 ? displayDuration : 100);
  const progressPct = isThisTrack && totalSec > 0
    ? Math.min(Math.max((currentTime / totalSec) * 100, 0), 100)
    : 0;

  const handleToggle = () => {
    if (isThisPlaying) {
      pause();
    } else {
      play(rec, { phone: callPhone });
      if (localRate !== playbackRate) {
        setPlaybackRate(localRate);
      }
    }
  };

  const handleRateChange = (newRate) => {
    setLocalRate(newRate);
    setPlaybackRate(newRate);
  };

  const handleSeek = (targetSec) => {
    const clamped = Math.max(0, Math.min(targetSec, totalSec));
    if (isThisTrack) {
      seek(clamped);
    } else {
      play(rec, { phone: callPhone }, clamped);
      if (localRate !== playbackRate) {
        setPlaybackRate(localRate);
      }
    }
  };

  const handleSkip = (deltaSec) => {
    if (isThisTrack) {
      const nextTime = Math.max(0, Math.min(currentTime + deltaSec, totalSec));
      seek(nextTime);
    } else {
      const startAt = Math.max(0, deltaSec > 0 ? deltaSec : 0);
      play(rec, { phone: callPhone }, startAt);
      if (localRate !== playbackRate) {
        setPlaybackRate(localRate);
      }
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadRecording(rec, index);
      toast.success('Download started');
    } catch (err) {
      toast.error(err.message || 'Failed to download recording.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`bg-slate-900/90 backdrop-blur-md border rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center relative overflow-hidden transition-all ${
        isThisPlaying
          ? 'border-indigo-500/60 ring-1 ring-indigo-500/30 bg-slate-900'
          : isThisTrack
          ? 'border-indigo-500/40 bg-slate-900'
          : 'border-slate-800 hover:border-slate-750'
      }`}
    >
      {/* Accent side bar */}
      <div
        className={`absolute top-0 left-0 w-1.5 h-full ${
          index === 0
            ? 'bg-gradient-to-b from-indigo-500 to-purple-500'
            : 'bg-gradient-to-b from-emerald-500 to-teal-500'
        }`}
      />

      {/* Main Play / Pause Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isThisPlaying ? 'Pause recording' : 'Play recording'}
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg transition-all hover:scale-105 active:scale-95 ${
          index === 0
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
        }`}
      >
        {isThisPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 w-full">
        {/* Top Info & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          {/* Metadata badges & filename */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                index === 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              Recording {index + 1}{total > 1 ? ` of ${total}` : ''}
            </span>
            {rec?.tsr && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 shrink-0"
                title="Agent (TSR) that took this call"
              >
                TSR {rec.tsr}
              </span>
            )}
            <span
              className="text-xs font-mono text-slate-300 truncate max-w-[240px] sm:max-w-[420px]"
              title={rec?.filename}
            >
              {rec?.filename || `Recording ${index + 1}`}
            </span>
            {rec?.date && (
              <span className="text-[10px] text-slate-500 hidden md:inline shrink-0">
                ({rec.date})
              </span>
            )}
          </div>

          {/* Controls: Skip buttons, Timer, Speed Select, Download */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Quick Skip Backward 10s */}
            <button
              type="button"
              onClick={() => handleSkip(-10)}
              title="Rewind 10s"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Quick Skip Forward 10s */}
            <button
              type="button"
              onClick={() => handleSkip(10)}
              title="Forward 10s"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Time Display */}
            <div className="flex items-center gap-1 font-mono text-xs">
              <span className="font-bold text-indigo-400">{displayCurrentTime}s</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">{displayDuration}s</span>
            </div>

            {/* Speed Selector (0.5x - 2x) */}
            <select
              value={isThisTrack ? playbackRate : localRate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="bg-slate-800 text-white text-[11px] font-medium rounded-lg px-2 py-1 outline-none border border-slate-700 hover:border-slate-600 ml-1 cursor-pointer transition-colors shadow-sm"
              title="Change playback speed"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Download this recording"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="text-[11px]">Download</span>
            </button>
          </div>
        </div>

        {/* Interactive Progress / Scrubber Bar ("voice agy peachy") */}
        <div
          className="relative w-full h-3.5 flex items-center cursor-pointer group py-1"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            handleSeek(clickPct * totalSec);
          }}
        >
          {/* Background Track */}
          <div className="w-full h-2 bg-slate-800 group-hover:bg-slate-750 rounded-full overflow-hidden relative transition-colors">
            {/* Progress Fill */}
            <div
              className={`h-full transition-all duration-75 ease-linear ${
                index === 0
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Visual Scrubber Knob (appears on hover / active) */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg pointer-events-none transition-transform duration-75 ${
              index === 0 ? 'ring-2 ring-indigo-500' : 'ring-2 ring-emerald-500'
            } opacity-0 group-hover:opacity-100 group-active:opacity-100 group-hover:scale-110`}
            style={{ left: `calc(${progressPct}% - 7px)` }}
          />

          {/* HTML5 Range Slider for accessible drag / click scrubbing */}
          <input
            type="range"
            min={0}
            max={totalSec || 100}
            step="0.5"
            value={isThisTrack ? currentTime : 0}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={`Scrub recording ${index + 1}`}
          />
        </div>
      </div>
    </div>
  );
}
