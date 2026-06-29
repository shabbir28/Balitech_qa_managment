import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  ClipboardCheck, Play, Pause, SkipBack, SkipForward, Volume2,
  X, Check, Eye, Folder, Activity, ShieldCheck, CheckCircle2,
  Clock, XCircle, Inbox, ChevronDown, ChevronRight, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Audio Playback</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{phone}</p>
            </div>
          </div>
          <button onClick={() => { audioRef.current?.pause(); onClose(); }} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <audio ref={audioRef} src={url} onTimeUpdate={() => setCur(audioRef.current?.currentTime || 0)} onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)} onEnded={() => setPlaying(false)} preload="metadata" />
          <div className="relative h-2 bg-white/5 rounded-full cursor-pointer overflow-hidden" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * (dur || 0); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-bold font-mono">
            <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
          </div>
          <div className="flex items-center justify-center gap-6">
            <button onClick={() => { const t = Math.max(0, cur - 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-2.5 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
              <SkipBack className="w-5 h-5" /><span className="text-[9px] font-bold mt-1">10s</span>
            </button>
            <button onClick={toggle} className="w-14 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-105">
              {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
            </button>
            <button onClick={() => { const t = Math.min(dur, cur + 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-2.5 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
              <SkipForward className="w-5 h-5" /><span className="text-[9px] font-bold mt-1">10s</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Status Badge ─────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    pending:   { icon: Clock,        cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400',   label: 'Pending' },
    accepted:  { icon: ShieldCheck,  cls: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400', label: 'In Progress' },
    rejected:  { icon: XCircle,      cls: 'bg-rose-500/10 border-rose-500/30 text-rose-400',       label: 'Rejected' },
    completed: { icon: CheckCircle2, cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', label: 'Completed' },
  };
  const m = map[status] || map.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${m.cls}`}>
      <Icon className="w-3 h-3" />{m.label}
    </span>
  );
};

/* ── Stat Mini Card ───────────────────────────────────────────────── */
const StatMini = ({ label, value, color, accent }) => (
  <div className="relative overflow-hidden rounded-2xl bg-[#0d1117] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 group">
    <div className={`absolute top-0 left-0 right-0 h-[2px] ${accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
    <div className="p-5">
      <p className={`text-3xl font-black tracking-tight leading-none mb-2 ${color}`}>{value}</p>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
    </div>
  </div>
);

/* ── Main Page ────────────────────────────────────────────────────── */
export default function MyAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioAssignment, setAudioAssignment] = useState(null);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState({});
  const navigate = useNavigate();

  const toggleGroup = key => setExpandedGroups(p => ({ ...p, [key]: !p[key] }));

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/assignments', { params: { page, limit: 50, status: filter === 'all' ? '' : filter } });
      setAssignments(res.data.data || []);
      setStats(res.data.stats || { total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 });
      setTotalPages(res.data.pagination?.pages || 1);
    } catch { toast.error('Failed to load assignments.'); }
    finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const accept = async id => { try { await api.patch(`/assignments/${id}/accept`); toast.success('Lead accepted!'); fetchAssignments(); } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); } };
  const reject = async id => { try { await api.patch(`/assignments/${id}/reject`); toast.success('Lead rejected.'); fetchAssignments(); } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); } };
  const acceptAll = async () => {
    try {
      setLoading(true);
      const res = await api.patch('/assignments/accept-all');
      toast.success(res.data.message || 'All pending leads accepted!');
      setFilter('accepted'); setPage(1); fetchAssignments();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); setLoading(false); }
  };

  const groups = assignments.reduce((acc, a) => {
    const key = a.file_name || a.batch_name || 'Manual Assignments';
    if (!acc[key]) acc[key] = { name: key, leads: [] };
    acc[key].leads.push(a);
    return acc;
  }, {});

  const filterTabs = [
    { key: 'all',       label: 'All',        val: stats.total,     color: 'text-white',     active: 'bg-slate-800 border-slate-600' },
    { key: 'pending',   label: 'Pending',    val: stats.pending,   color: 'text-amber-400', active: 'bg-amber-500/10 border-amber-500/30' },
    { key: 'accepted',  label: 'In Progress',val: stats.accepted,  color: 'text-indigo-400',active: 'bg-indigo-500/10 border-indigo-500/30' },
    { key: 'rejected',  label: 'Rejected',   val: stats.rejected,  color: 'text-rose-400',  active: 'bg-rose-500/10 border-rose-500/30' },
    { key: 'completed', label: 'Completed',  val: stats.completed, color: 'text-emerald-400',active: 'bg-emerald-500/10 border-emerald-500/30' },
  ];

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-3">
            <Activity className="w-3 h-3" /> QA Workspace
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">My Assignments</h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">Accept and evaluate leads assigned by your manager.</p>
        </div>
        {stats.pending > 0 && (
          <button onClick={acceptAll} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50">
            <Check className="w-4 h-4" /> Accept All Pending ({stats.pending})
          </button>
        )}
      </div>

      {/* ── Stats Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatMini label="Total Queue"  value={stats.total}     color="text-white"        accent="bg-gradient-to-r from-slate-400 to-slate-500" />
        <StatMini label="Pending"      value={stats.pending}   color="text-amber-400"    accent="bg-gradient-to-r from-amber-500 to-yellow-400" />
        <StatMini label="In Progress"  value={stats.accepted}  color="text-indigo-400"   accent="bg-gradient-to-r from-indigo-500 to-violet-400" />
        <StatMini label="Completed"    value={stats.completed} color="text-emerald-400"  accent="bg-gradient-to-r from-emerald-500 to-teal-400" />
        <StatMini label="Rejected"     value={stats.rejected}  color="text-rose-400"     accent="bg-gradient-to-r from-rose-500 to-rose-400" />
      </div>

      {/* Completion Progress Bar */}
      <div className="bg-[#0d1117] border border-white/5 rounded-2xl px-6 py-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-300">Completion Rate</span>
        </div>
        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }} />
        </div>
        <span className="text-sm font-black text-white w-10 text-right">{completionRate}%</span>
      </div>

      {/* ── Filter Tabs ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => { setFilter(t.key); setPage(1); }}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${filter === t.key ? `${t.active} ${t.color}` : 'bg-[#0d1117] border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200'}`}>
            <span className={`text-base font-black ${filter === t.key ? t.color : 'text-slate-500'}`}>{t.val}</span>
            <span className="uppercase tracking-widest">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Main Workspace ─────────────────────────────────── */}
      <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-indigo-400" /> Evaluation Queue
          </h2>
          <div className="text-[10px] font-bold text-slate-500 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/5">
            {assignments.length} Records
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Syncing Queue...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                <Inbox className="w-9 h-9 text-slate-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Queue is Empty</h3>
                <p className="text-xs text-slate-500 max-w-xs">No tasks pending evaluation for the current filter state.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groups).map(([batchName, group]) => (
                <div key={batchName} className="border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all">
                  {/* Batch Header */}
                  <button onClick={() => toggleGroup(batchName)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <Folder className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-bold text-white">{batchName}</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                          <span className="text-indigo-400">{group.leads.length}</span> Records Allocated
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${expandedGroups[batchName] ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                      {expandedGroups[batchName] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {expandedGroups[batchName] ? 'Collapse' : 'Expand'}
                    </div>
                  </button>

                  {/* Table */}
                  {expandedGroups[batchName] && (
                    <div className="border-t border-white/5 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/[0.02]">
                            {['Customer Phone', 'Campaign', 'Agent Name', 'Call Date', 'Audio', 'Status', 'Actions'].map((h, i) => (
                              <th key={h} className={`py-3 px-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {group.leads.map(a => (
                            <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-200">{a.customer_phone}</td>
                              <td className="py-3.5 px-4 text-[10px] font-bold text-indigo-400 tracking-wide">{a.campaign_name}</td>
                              <td className="py-3.5 px-4 text-xs text-slate-300 font-semibold">{a.agent_name}</td>
                              <td className="py-3.5 px-4 text-[10px] text-slate-500 font-medium">{a.call_date ? format(new Date(a.call_date), 'MMM d, yyyy') : '—'}</td>
                              <td className="py-3.5 px-4">
                                {a.recording_url ? (
                                  <button onClick={() => setAudioAssignment(a)} className="w-8 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40 flex items-center justify-center transition-all" title="Play Audio">
                                    <Play className="w-3.5 h-3.5 ml-0.5" />
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest bg-white/[0.02] px-2 py-1 rounded-md border border-white/5">No Audio</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4"><StatusBadge status={a.status} /></td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-end gap-2">
                                  {a.status === 'pending' && (
                                    <>
                                      <button onClick={() => accept(a.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-all">
                                        <Check className="w-3 h-3" /> Accept
                                      </button>
                                      <button onClick={() => reject(a.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold transition-all">
                                        <X className="w-3 h-3" /> Reject
                                      </button>
                                    </>
                                  )}
                                  {a.status === 'accepted' && (
                                    <button onClick={() => navigate(`/evaluations/new?call_id=${a.call_lead_id}`)} className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                                      <Eye className="w-3.5 h-3.5" /> Evaluate
                                    </button>
                                  )}
                                  {a.status === 'completed' && (
                                    <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-[9px] font-bold uppercase tracking-widest">
                                      <CheckCircle2 className="w-3 h-3" /> Scored
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-white/5 flex justify-between items-center">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-white/[0.03] border border-white/5 text-slate-300 rounded-lg text-xs font-bold hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              ← Previous
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              Page <span className="w-7 h-7 flex items-center justify-center bg-indigo-500/15 text-indigo-400 font-black rounded-lg border border-indigo-500/25">{page}</span> of {totalPages}
            </div>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-white/[0.03] border border-white/5 text-slate-300 rounded-lg text-xs font-bold hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              Next →
            </button>
          </div>
        )}
      </div>

      {audioAssignment && <AudioModal url={audioAssignment.recording_url} phone={audioAssignment.customer_phone} onClose={() => setAudioAssignment(null)} />}
    </div>
  );
}
