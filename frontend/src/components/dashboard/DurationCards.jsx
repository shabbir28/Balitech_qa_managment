import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Headphones, ArrowUpRight, X, Loader2, Play, Pause } from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import LAPlaybackPanel from './LAPlaybackPanel';

const BANDS = { 800: '800–999', 1000: '1000–1499', 1500: '1500+' };
const ACCENTS = { 800: 'text-sky-400 border-sky-400/30 bg-sky-400/10', 1000: 'text-violet-400 border-violet-400/30 bg-violet-400/10', 1500: 'text-amber-400 border-amber-400/30 bg-amber-400/10' };

export default function DurationCards({ startDate, endDate, dialer }) {
  const { user } = useAuth();
  const { play, pause, currentRec, isPlaying } = useAudioPlayer();
  const [counts, setCounts] = useState(null);
  const [threshold, setThreshold] = useState(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const triggerRef = useRef(null);

  useEffect(() => {
    if (user?.role !== 'Super Admin') return;
    let cancelled = false;
    let timer;
    setCounts(null);
    setThreshold(null);
    setError('');
    const load = async () => {
      try {
        const { data } = await api.get('/dashboard/duration-sales', { params: { startDate, endDate, dialer } });
        if (cancelled) return;
        setCounts(data.data);
        setError('');
        timer = setTimeout(load, data.data.pending || data.data.failed || data.data.didRefreshing || data.data.didSyncFailed ? 5000 : 60000);
      } catch {
        if (!cancelled) {
          setError('Could not refresh LA counts. Retrying automatically…');
          timer = setTimeout(load, 10000);
        }
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [startDate, endDate, dialer, user?.role]);

  useEffect(() => {
    if (threshold === null || user?.role !== 'Super Admin') return;
    let cancelled = false;
    let timer;
    setResult(null);
    setListError('');
    const load = async () => {
      try {
        const { data } = await api.get('/dashboard/duration-sales', {
          params: { startDate, endDate, dialer, minDuration: threshold, page },
        });
        if (cancelled) return;
        setListError('');
        if (data.page !== page) setPage(data.page);
        setResult(data);
        timer = setTimeout(load, data.pending || data.failed || data.didRefreshing || data.didSyncFailed ? 5000 : 60000);
      } catch {
        if (!cancelled) {
          setListError('Could not refresh recordings. Retrying automatically…');
          timer = setTimeout(load, 10000);
        }
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [threshold, page, startDate, endDate, dialer, user?.role]);

  useEffect(() => {
    if (threshold === null) return;
    const previouslyFocused = triggerRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') setThreshold(null); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [threshold]);

  if (user?.role !== 'Super Admin') {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-[#0D111D] p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-slate-100">LA Transfer Calls</h2>
          <span className="text-[9px] font-semibold text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">LA ONLY</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500" aria-live="polite">
          {counts?.didRefreshing ? <><Loader2 className="w-3 h-3 animate-spin" />Syncing dialer DIDs…</> : counts?.pending > 0 ? <><Loader2 className="w-3 h-3 animate-spin" />Checking {counts.pending} leads · counts updating</> : 'DIDs auto-synced · separate ranges'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {[800, 1000, 1500].map(seconds => (
          <button key={seconds} type="button" disabled={!counts}
            onClick={event => { triggerRef.current = event.currentTarget; setPage(1); setThreshold(seconds); }}
            className="group flex items-center gap-3 text-left bg-[#090D16] border border-slate-800 rounded-xl px-3.5 py-3 hover:bg-slate-800/40 hover:border-slate-600 focus-visible:outline focus-visible:outline-amber-400 transition-colors disabled:opacity-60"
            aria-label={`View LA recordings lasting ${BANDS[seconds]} seconds`}>
            <span className={`flex items-center justify-center w-9 h-9 rounded-lg border shrink-0 ${ACCENTS[seconds]}`}><Headphones className="w-4 h-4" /></span>
            <span className="flex-1">
              <span className="block text-[10px] font-semibold tracking-wide text-slate-400">{BANDS[seconds]} SEC</span>
              <span className="block text-2xl leading-8 font-bold tabular-nums text-white">{counts?.didReady && (counts.known > 0 || (!counts.pending && !counts.failed)) ? counts[seconds].toLocaleString() : '—'}</span>
            </span>
            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-200 transition-colors" />
          </button>
        ))}
      </div>
      {counts?.failed > 0 && <p role="status" className="text-[11px] text-amber-400">Partial counts: {counts.failed} leads could not be checked. Retrying automatically.</p>}
      {counts?.didSyncFailed && <p role="status" className="text-[11px] text-amber-400">{counts.didReady ? 'Using the last saved DID list.' : 'Dialer DID list unavailable.'} Retrying automatically.</p>}
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      {threshold !== null && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4" onClick={() => setThreshold(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="duration-title"
            className="bg-[#0D111D] border border-slate-700 rounded-2xl p-5 w-full max-w-4xl max-h-[85vh] overflow-auto"
            onKeyDown={event => {
              if (event.key !== 'Tab') return;
              const elements = event.currentTarget.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)');
              const first = elements[0];
              const last = elements[elements.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
            onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 id="duration-title" className="text-lg font-bold text-white">LA recordings · {BANDS[threshold]} sec {result && `(${result.total})`}</h2>
                <p className="text-xs text-slate-400">{startDate} → {endDate} · {dialer}</p>
              </div>
              <button autoFocus type="button" aria-label="Close LA recordings" onClick={() => setThreshold(null)} className="p-2 text-slate-300"><X /></button>
            </div>
            {(result?.pending > 0 || result?.failed > 0 || result?.didRefreshing || result?.didSyncFailed) && <p className="text-xs text-amber-400 mb-3">LA recordings and dialer DIDs are being checked. This list updates automatically.</p>}
            <div className="sticky top-0 z-10 bg-[#0D111D] pb-3"><LAPlaybackPanel /></div>
            {listError && <p role="alert" className="text-rose-400 text-xs mb-3">{listError}</p>}
            {!result ? <p className="text-slate-400">Loading LA recordings...</p> : result.total === 0 ? <p className="text-slate-400">{result.pending || result.failed || !result.didReady || result.didRefreshing ? 'Checking LA recordings and DIDs. Matching calls will appear here automatically.' : 'No LA recordings found in this range.'}</p> : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="text-slate-500"><tr>{['Phone / Lead', 'LA Destination', 'Recorded', 'Duration', 'Recording'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
                    <tbody>{result.data.map(row => (
                      <tr key={row.id} className={`border-t border-slate-800 ${currentRec?.location === row.location ? 'bg-sky-400/10' : ''}`}>
                        <td className="p-2"><span className="block text-slate-200">{row.phone || row.lead_id}</span><span className="text-[10px] text-slate-500">{row.dialer} · {row.agent || '—'}</span></td>
                        <td className="p-2"><span className="block text-sky-400 font-semibold">{row.disposition}</span><span className="text-xs text-slate-500 font-mono">{row.did}</span></td>
                        <td className="p-2 whitespace-nowrap text-xs">{row.date}</td>
                        <td className="p-2 whitespace-nowrap font-semibold tabular-nums">{row.call_duration_seconds} sec</td>
                        <td className="p-2"><button type="button" onClick={() => currentRec?.location === row.location && isPlaying ? pause() : play(row, { phone: row.phone })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs text-sky-300 hover:bg-sky-400/20">
                          {currentRec?.location === row.location && isPlaying ? <><Pause className="w-3 h-3" />Pause</> : <><Play className="w-3 h-3" />Play LA</>}
                        </button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="flex justify-end items-center gap-4 mt-4 text-sm text-slate-300">
                  <button disabled={page === 1} className="disabled:opacity-30" onClick={() => setPage(p => p - 1)}>Previous</button>
                  <span>Page {page} / {Math.ceil(result.total / 50)}</span>
                  <button disabled={page * 50 >= result.total} className="disabled:opacity-30" onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              </>
            )}
          </div>
        </div>, document.body
      )}
    </section>
  );
}
