import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  X, Check, Eye, Folder, CheckCircle2, Clock, XCircle, Inbox,
  ChevronDown, ChevronRight, Search, RefreshCw, History, ShieldCheck
} from 'lucide-react';
import DateRangeDropdown from '../components/common/DateRangeDropdown';
import { getEstDateString, getEstDateTimeString } from '../utils/dateUtils';

/* ── Audio Modal ──────────────────────────────────────────────────── */
const AudioModal = ({ url, phone, onClose }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const fmt = s => !s || isNaN(s) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const pct = dur ? (cur / dur) * 100 : 0;
  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => toast.error('Cannot play audio.')); setPlaying(true); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4" onClick={() => { audioRef.current?.pause(); onClose(); }}>
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Call recording</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{phone}</p>
            </div>
          </div>
          <button onClick={() => { audioRef.current?.pause(); onClose(); }} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <audio ref={audioRef} src={url} onTimeUpdate={() => setCur(audioRef.current?.currentTime || 0)} onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)} onEnded={() => setPlaying(false)} preload="metadata" />
          <div className="relative h-2 bg-white/5 rounded-full cursor-pointer overflow-hidden" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * (dur || 0); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }}>
            <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
          </div>
          <div className="flex items-center justify-center gap-5">
            <button onClick={() => { const t = Math.max(0, cur - 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
              <SkipBack className="w-5 h-5" /><span className="text-[9px] font-semibold mt-1">10s</span>
            </button>
            <button onClick={toggle} className="w-14 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-all" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button onClick={() => { const t = Math.min(dur, cur + 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
              <SkipForward className="w-5 h-5" /><span className="text-[9px] font-semibold mt-1">10s</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Status badge ─────────────────────────────────────────────────── */
const STATUS_META = {
  pending:   { icon: Clock,        cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300',     label: 'Pending' },
  accepted:  { icon: ShieldCheck,  cls: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',  label: 'In progress' },
  rejected:  { icon: XCircle,      cls: 'bg-rose-500/10 border-rose-500/30 text-rose-300',        label: 'Rejected' },
  completed: { icon: CheckCircle2, cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300', label: 'Completed' },
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap ${m.cls}`}>
      <Icon className="w-3 h-3" />{m.label}
    </span>
  );
};

/* ── Summary tile ─────────────────────────────────────────────────── */
const SummaryTile = ({ label, value, tone = 'text-white' }) => (
  <div className="rounded-xl bg-[#0d1117] border border-white/[0.06] px-4 py-3">
    <p className={`text-2xl font-semibold tracking-tight leading-none ${tone}`}>{value ?? 0}</p>
    <p className="text-[11px] text-slate-500 mt-1.5">{label}</p>
  </div>
);

/* ── Main page ────────────────────────────────────────────────────── */
export default function MyAssignmentsPage() {
  const today = getEstDateString(new Date());

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioAssignment, setAudioAssignment] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [collapsed, setCollapsed] = useState({});
  const navigate = useNavigate();

  const isToday = startDate === today && endDate === today;
  // Bulk accept is limited to one day so a wide range can't be claimed at once.
  const isSingleDay = startDate === endDate;

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/assignments', {
        params: {
          page,
          limit: 50,
          status: filter === 'all' ? '' : filter,
          start_date: startDate,
          end_date: endDate,
        },
      });
      setAssignments(res.data.data || []);
      setStats(res.data.stats || {});
      setTotalPages(res.data.pagination?.pages || 1);
    } catch { toast.error('Failed to load assignments.'); }
    finally { setLoading(false); }
  }, [page, filter, startDate, endDate]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const changeRange = (start, end) => {
    setStartDate(start || today);
    setEndDate(end || start || today);
    setPage(1);
  };

  const accept = async id => {
    try { await api.patch(`/assignments/${id}/accept`); toast.success('Lead accepted.'); fetchAssignments(); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed.'); }
  };
  const reject = async id => {
    try { await api.patch(`/assignments/${id}/reject`); toast.success('Lead rejected.'); fetchAssignments(); }
    catch (e) { toast.error(e.response?.data?.message || 'Failed.'); }
  };
  const acceptAll = async () => {
    try {
      const res = await api.patch('/assignments/accept-all', { date: startDate });
      toast.success(res.data.message || 'Pending leads accepted.');
      setFilter('accepted'); setPage(1);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter(a =>
      [a.customer_phone, a.agent_name, a.campaign_name, a.file_name, a.batch_name]
        .some(v => (v || '').toLowerCase().includes(q))
    );
  }, [assignments, search]);

  const groups = useMemo(() => Object.values(visible.reduce((acc, a) => {
    const key = a.file_name || a.batch_name || 'Manual assignments';
    if (!acc[key]) acc[key] = { name: key, leads: [] };
    acc[key].leads.push(a);
    return acc;
  }, {})), [visible]);

  const tabs = [
    { key: 'all',       label: 'All',         val: stats.total },
    { key: 'pending',   label: 'Pending',     val: stats.pending },
    { key: 'accepted',  label: 'In progress', val: stats.accepted },
    { key: 'completed', label: 'Completed',   val: stats.completed },
    { key: 'rejected',  label: 'Rejected',    val: stats.rejected },
  ];

  const rangeLabel = startDate === endDate ? startDate : `${startDate} → ${endDate}`;

  return (
    <div className="space-y-5 pb-10">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">My assignments</h1>
          <p className="text-slate-400 text-xs mt-1">
            Leads assigned to you, by day. Times follow US Eastern (America/New_York).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangeDropdown startDate={startDate} endDate={endDate} onChange={changeRange} />
          <button
            onClick={fetchAssignments}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 bg-[#0d1117] border border-white/10 text-slate-300 rounded-xl text-xs font-medium hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {isSingleDay && stats.pending > 0 && (
            <button
              onClick={acceptAll}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-semibold transition-colors"
            >
              <Check className="w-4 h-4" /> Accept all pending ({stats.pending})
            </button>
          )}
        </div>
      </div>

      {/* ── Earlier-day notice ───────────────────────────────── */}
      {!isToday && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 px-4 py-3">
          <History className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Showing <span className="font-semibold">{rangeLabel}</span>. These leads left your daily
            queue at midnight Eastern, but you can still accept and evaluate them from here — a lead
            you pick up stays in your queue for the rest of today.
          </p>
        </div>
      )}

      {/* ── Summary ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryTile label="Total assigned" value={stats.total} />
        <SummaryTile label="Pending" value={stats.pending} tone="text-amber-400" />
        <SummaryTile label="In progress" value={stats.accepted} tone="text-indigo-400" />
        <SummaryTile label="Completed" value={stats.completed} tone="text-emerald-400" />
        <SummaryTile label="Eval passed" value={stats.eval_accepted} tone="text-teal-400" />
        <SummaryTile label="Eval failed" value={stats.eval_rejected} tone="text-pink-400" />
      </div>

      {/* ── Workspace ────────────────────────────────────────── */}
      <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-white/5 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex flex-wrap gap-1.5 flex-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => { setFilter(t.key); setPage(1); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                  filter === t.key
                    ? 'bg-white/[0.07] border-white/15 text-white font-medium'
                    : 'bg-transparent border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
                }`}
              >
                {t.label}
                <span className={`text-[11px] font-semibold ${filter === t.key ? 'text-white' : 'text-slate-500'}`}>
                  {t.val ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="relative lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search phone, agent or campaign"
              className="w-full bg-[#080B12] border border-white/10 text-slate-200 text-xs rounded-lg pl-9 pr-8 py-2 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {loading ? (
            <div className="h-56 flex flex-col items-center justify-center gap-3">
              <div className="w-7 h-7 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Loading your queue…</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                <Inbox className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  {search ? 'No matching leads' : 'Nothing here for this day'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  {search
                    ? 'Try a different phone number, agent or campaign.'
                    : isToday
                      ? 'No leads have been assigned to you today yet. Your manager will assign them shortly.'
                      : `No assignments were recorded for ${rangeLabel}. Pick another day from the date picker.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {groups.map(group => {
                const isOpen = collapsed[group.name] !== true;
                return (
                  <div key={group.name} className="border border-white/5 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setCollapsed(p => ({ ...p, [group.name]: p[group.name] !== true }))}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                          <Folder className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <div className="text-left min-w-0">
                          <h3 className="text-sm font-medium text-white truncate">{group.name}</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">{group.leads.length} lead{group.leads.length === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/5 overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[880px]">
                          <thead>
                            <tr className="bg-white/[0.02]">
                              {['Phone', 'Campaign', 'Call agent', 'Assigned', 'Audio', 'Status', 'Evaluation', ''].map((h, i) => (
                                <th key={h || i} className={`py-2.5 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-white/5 ${i === 7 ? 'text-right' : ''}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {group.leads.map(a => {
                              const status = a.effective_status || a.status;
                              // Left the daily queue at midnight, but still workable.
                              const carriedOver = a.is_expired;
                              const dialer = (a.dialer_campaign || a.campaign_name || '').toLowerCase().includes('pharmacy') ? 'pharmacy' : 'medicare';
                              return (
                                <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="py-3 px-4 font-mono text-xs text-slate-100 whitespace-nowrap">{a.customer_phone}</td>
                                  <td className="py-3 px-4 text-xs text-indigo-300 whitespace-nowrap">{a.campaign_name || '—'}</td>
                                  <td className="py-3 px-4 text-xs text-slate-300">{a.agent_name || '—'}</td>
                                  <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                                    {a.assigned_at ? getEstDateTimeString(a.assigned_at) : '—'}
                                  </td>
                                  <td className="py-3 px-4">
                                    {a.recording_url ? (
                                      <button onClick={() => setAudioAssignment(a)} className="w-8 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center justify-center transition-colors" title="Play recording">
                                        <Play className="w-3.5 h-3.5 ml-0.5" />
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-600">No audio</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-1.5">
                                      <StatusBadge status={status} />
                                      {carriedOver && (
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] text-slate-500"
                                          title="Left the daily queue at midnight Eastern. You can still work on it."
                                        >
                                          <History className="w-3 h-3" /> earlier day
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-xs whitespace-nowrap">
                                    {a.evaluation_status
                                      ? <span className="text-slate-200">{a.evaluation_status}</span>
                                      : <span className="text-slate-600">—</span>}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center justify-end gap-2">
                                      {status === 'pending' && (
                                        <>
                                          <button onClick={() => accept(a.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 rounded-lg text-[11px] font-medium transition-colors">
                                            <Check className="w-3 h-3" /> Accept
                                          </button>
                                          <button onClick={() => reject(a.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 rounded-lg text-[11px] font-medium transition-colors">
                                            <X className="w-3 h-3" /> Reject
                                          </button>
                                        </>
                                      )}
                                      {status === 'accepted' && (
                                        <button
                                          onClick={() => navigate(`/dialer?phone=${encodeURIComponent(a.customer_phone)}&assignment_id=${a.call_lead_id}&dialer=${dialer}`)}
                                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-[11px] font-semibold transition-colors"
                                        >
                                          <Eye className="w-3.5 h-3.5" /> Evaluate
                                        </button>
                                      )}
                                      {a.evaluation_id && (
                                        <button
                                          onClick={() => navigate(`/evaluations/view/${a.evaluation_id}`)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 rounded-lg border border-white/10 text-[11px] font-medium transition-colors"
                                        >
                                          <Eye className="w-3 h-3" /> View form
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/5 flex justify-between items-center">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3.5 py-2 bg-white/[0.03] border border-white/5 text-slate-300 rounded-lg text-xs font-medium hover:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3.5 py-2 bg-white/[0.03] border border-white/5 text-slate-300 rounded-lg text-xs font-medium hover:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        )}
      </div>

      {audioAssignment && (
        <AudioModal
          url={audioAssignment.recording_url}
          phone={audioAssignment.customer_phone}
          onClose={() => setAudioAssignment(null)}
        />
      )}
    </div>
  );
}
