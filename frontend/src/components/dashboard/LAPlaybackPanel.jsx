import { useState } from 'react';
import { Headphones, Play, Pause, RotateCcw, RotateCw, Download, X, Loader2 } from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { downloadRecording } from '../../utils/recordingDownload';
import toast from 'react-hot-toast';

const formatTime = value => {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function LAPlaybackPanel() {
  const { currentRec, callInfo, isPlaying, isBuffering, playbackError, currentTime,
    duration, playbackRate, toggle, stop, seek, setPlaybackRate } = useAudioPlayer();
  const [downloading, setDownloading] = useState(false);
  if (!currentRec?.did) return null;
  const total = Number.isFinite(duration) && duration > 0 ? duration : Number(currentRec.length) || 0;
  const elapsed = Math.min(currentTime, total);
  const download = async () => {
    setDownloading(true);
    try { await downloadRecording(currentRec); }
    catch { toast.error('Could not download this recording. Please retry.'); }
    finally { setDownloading(false); }
  };

  return (
    <div className="rounded-xl border border-sky-400/25 bg-[#101b2b] p-3 sm:p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="rounded-lg bg-sky-400/10 p-2 text-sky-300"><Headphones className="w-4 h-4" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{callInfo?.phone || currentRec.phone || 'LA recording'}</p>
            <p className="text-[11px] text-slate-400">{currentRec.disposition} · DID {currentRec.did}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span role="status" className="hidden sm:block text-[10px] text-sky-300">{playbackError ? 'Unable to play' : isBuffering ? 'Loading audio…' : isPlaying ? 'Now playing' : elapsed >= total && total > 0 ? 'Finished' : 'Paused'}</span>
          <button type="button" onClick={stop} className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Stop and close player"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => seek(Math.max(0, currentTime - 10))} aria-label="Rewind 10 seconds" title="Back 10 seconds" className="p-2 text-slate-300 hover:text-white"><RotateCcw className="w-4 h-4" /><span className="block text-[9px]">10s</span></button>
          <button type="button" onClick={toggle} aria-label={isPlaying || isBuffering ? 'Pause LA recording' : playbackError ? 'Retry LA recording' : 'Play LA recording'}
            className="w-11 h-11 rounded-full bg-sky-400 text-slate-950 hover:bg-sky-300 flex items-center justify-center shadow-lg shadow-sky-500/10">
            {isBuffering ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button type="button" onClick={() => seek(Math.min(total, currentTime + 10))} aria-label="Forward 10 seconds" title="Forward 10 seconds" className="p-2 text-slate-300 hover:text-white"><RotateCw className="w-4 h-4" /><span className="block text-[9px]">10s</span></button>
        </div>
        <div className="order-last sm:order-none flex-1 min-w-[160px] basis-full sm:basis-0">
          <input aria-label="LA recording position" aria-valuetext={`${formatTime(elapsed)} of ${formatTime(total)}`}
            type="range" min={0} max={total || 1} step="0.1" value={elapsed} disabled={!total}
            onChange={event => seek(Number(event.target.value))}
            className="w-full h-2 accent-sky-400 cursor-pointer" />
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1"><span className="text-sky-300">{formatTime(elapsed)}</span><span>{formatTime(total)}</span></div>
        </div>
        <select aria-label="LA playback speed" value={playbackRate} onChange={event => setPlaybackRate(Number(event.target.value))}
          className="rounded-lg border border-slate-600 bg-slate-900 text-xs text-slate-200 py-2 pl-2 pr-7">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
        </select>
        <button type="button" onClick={download} disabled={downloading} aria-label="Download LA recording" title="Download recording"
          className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50">{downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}</button>
      </div>
      {playbackError && <p role="alert" className="text-xs text-rose-300 mt-2">{playbackError}</p>}
    </div>
  );
}
