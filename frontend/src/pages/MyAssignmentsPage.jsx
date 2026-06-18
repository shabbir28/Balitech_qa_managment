import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  ClipboardCheck, Play, Pause, SkipBack, SkipForward, Volume2, 
  X, Check, Eye, Folder, Inbox, Activity, ShieldCheck, CheckCircle2,
  Clock, XCircle
} from 'lucide-react';
import { format } from 'date-fns';

/* ─── Mini Audio Player Modal ───────────────────────────────────────── */
const AudioModal = ({ url, phone, onClose }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  const fmt = s => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
  const pct = dur ? (cur / dur) * 100 : 0;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => toast.error('Cannot play audio.')); setPlaying(true); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-inner">
              <Volume2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-wide">Secure Audio Playback</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5 font-mono">{phone}</p>
            </div>
          </div>
          <button onClick={() => { audioRef.current?.pause(); onClose(); }} className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <audio ref={audioRef} src={url}
            onTimeUpdate={() => setCur(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)}
            onEnded={() => setPlaying(false)} preload="metadata" />
          
          <div className="relative h-3 bg-slate-950 border border-slate-800 rounded-full cursor-pointer overflow-hidden shadow-inner"
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * (dur || 0); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400 font-bold font-mono tracking-wider">
            <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
          </div>
          
          <div className="flex items-center justify-center gap-6 pt-2">
            <button onClick={() => { const t = Math.max(0, cur - 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-3 rounded-2xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
              <SkipBack className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">10s</span>
            </button>
            <button onClick={toggle} className="w-16 h-16 rounded-[24px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-105 active:scale-95">
              {playing ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
            <button onClick={() => { const t = Math.min(dur, cur + 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-3 rounded-2xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
              <SkipForward className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">10s</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Status Badge ──────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    pending: { icon: Clock, style: 'bg-amber-500/10 border-amber-500/30 text-amber-400', label: 'Pending' },
    accepted: { icon: ShieldCheck, style: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400', label: 'Processing' },
    rejected: { icon: XCircle, style: 'bg-rose-500/10 border-rose-500/30 text-rose-400', label: 'Rejected' },
    completed: { icon: CheckCircle2, style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', label: 'Completed' },
  };
  
  const Icon = map[status]?.icon || Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${map[status]?.style || ''}`}>
      <Icon className="w-3.5 h-3.5" />
      {map[status]?.label || status}
    </span>
  );
};

/* ─── Main Page ────────────────────────────────────────────────────── */
const MyAssignmentsPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioAssignment, setAudioAssignment] = useState(null);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState({});
  const navigate = useNavigate();

  const toggleGroup = (batchName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [batchName]: !prev[batchName]
    }));
  };

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

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const accept = async (id) => {
    try {
      await api.patch(`/assignments/${id}/accept`);
      toast.success('Lead secured in your queue!');
      fetchAssignments();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const reject = async (id) => {
    try {
      await api.patch(`/assignments/${id}/reject`);
      toast.success('Lead rejected.');
      fetchAssignments();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reject.'); }
  };

  const acceptAll = async () => {
    try {
      setLoading(true);
      const res = await api.patch('/assignments/accept-all');
      toast.success(res.data.message || 'All pending leads secured!');
      setFilter('accepted');
      setPage(1);
      fetchAssignments();
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Failed to accept all.'); 
      setLoading(false);
    }
  };

  const counts = {
    all: stats.total || 0,
    pending: stats.pending || 0,
    accepted: stats.accepted || 0,
    rejected: stats.rejected || 0,
    completed: stats.completed || 0,
  };

  const groupedAssignments = assignments.reduce((acc, curr) => {
    const key = curr.file_name || curr.batch_name || 'Manual Assignments';
    if (!acc[key]) acc[key] = { name: key, leads: [] };
    acc[key].leads.push(curr);
    return acc;
  }, {});

  const filters = [
    { label: 'Entire Queue', key: 'all', color: 'text-white', activeBg: 'bg-slate-800 border-slate-600 shadow-lg' },
    { label: 'Pending Action', key: 'pending', color: 'text-amber-400', activeBg: 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]' },
    { label: 'In Progress', key: 'accepted', color: 'text-indigo-400', activeBg: 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]' },
    { label: 'Rejected', key: 'rejected', color: 'text-rose-400', activeBg: 'bg-rose-500/10 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]' },
    { label: 'Completed', key: 'completed', color: 'text-emerald-400', activeBg: 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-3 shadow-inner">
            <Activity className="w-3.5 h-3.5" /> Workspace Queue
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-sm">
            My Assignments
          </h1>
          <p className="text-slate-400 mt-2 font-medium text-lg">Accept and evaluate targeted leads deployed by management.</p>
        </div>
        
        {stats.pending > 0 && (
          <button 
            onClick={acceptAll} 
            disabled={loading} 
            className="group relative overflow-hidden bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-3.5 rounded-2xl text-sm font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <div className="absolute inset-0 bg-white/20 w-1/2 -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <Check className="w-5 h-5 relative z-10" /> 
            <span className="relative z-10">Secure All Pending ({stats.pending})</span>
          </button>
        )}
      </div>

      {/* Filter Navigation Row */}
      <div className="flex flex-wrap items-center gap-3">
        {filters.map(s => (
          <button 
            key={s.key} 
            onClick={() => { setFilter(s.key); setPage(1); }}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all ${
              filter === s.key 
                ? s.activeBg 
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-400'
            }`}
          >
            <span className={`text-xl font-black ${filter === s.key ? s.color : 'text-slate-500'}`}>{counts[s.key]}</span>
            <span className="text-xs font-bold uppercase tracking-widest">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Workspace Area */}
      <div className="card !p-0 overflow-hidden flex flex-col min-h-[500px]">
        {/* Header Bar */}
        <div className="p-5 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-400" /> Evaluation Queue
          </h2>
          <div className="text-xs font-bold text-slate-500 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800">
            {assignments.length} Records Loaded
          </div>
        </div>

        <div className="flex-1 bg-slate-950/20 p-6">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Syncing Queue...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-slate-900/80 rounded-[32px] flex items-center justify-center mb-6 border border-slate-800 shadow-inner">
                <Inbox className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Queue is Empty</h3>
              <p className="text-slate-500 max-w-sm font-medium">You have no tasks pending evaluation matching the current filter state.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAssignments).map(([batchName, group]) => (
                <div key={batchName} className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden transition-all shadow-sm hover:border-slate-700">
                  
                  {/* Batch Header */}
                  <button 
                    onClick={() => toggleGroup(batchName)}
                    className="w-full flex items-center justify-between p-5 bg-transparent hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                        <Folder className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-base font-bold text-white">{batchName}</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          <span className="text-indigo-400">{group.leads.length}</span> Allocated Records
                        </p>
                      </div>
                    </div>
                    <div className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl border transition-colors ${
                      expandedGroups[batchName] 
                        ? 'bg-slate-800 text-slate-300 border-slate-700' 
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
                    }`}>
                      {expandedGroups[batchName] ? 'Collapse List' : 'Expand Leads'}
                    </div>
                  </button>
                  
                  {/* Batch Content (Table) */}
                  {expandedGroups[batchName] && (
                    <div className="border-t border-slate-800/60 bg-slate-950/30 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/80 backdrop-blur-md">
                          <tr>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">Target Node</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">Campaign</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">Operator</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">Timestamp</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">Media</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">State</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {group.leads.map(a => (
                            <tr key={a.id} className="hover:bg-slate-800/40 transition-colors group/row">
                              <td className="py-4 px-6 font-mono text-sm font-bold text-slate-200">{a.customer_phone}</td>
                              <td className="py-4 px-6 text-xs text-indigo-400 font-bold tracking-wide">{a.campaign_name}</td>
                              <td className="py-4 px-6">
                                <p className="text-xs font-bold text-slate-300">{a.agent_name}</p>
                              </td>
                              <td className="py-4 px-6 text-xs text-slate-500 font-medium">
                                {a.call_date ? format(new Date(a.call_date), 'MMM d, yyyy') : '—'}
                              </td>
                              <td className="py-4 px-6">
                                {a.recording_url ? (
                                  <button
                                    onClick={() => setAudioAssignment(a)}
                                    className="flex items-center justify-center w-9 h-9 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all border border-emerald-500/20 hover:border-emerald-500/40"
                                    title="Play Audio"
                                  >
                                    <Play className="w-4 h-4 ml-0.5" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest bg-slate-900 px-2 py-1 rounded-md border border-slate-800">No Audio</span>
                                )}
                              </td>
                              <td className="py-4 px-6"><StatusBadge status={a.status} /></td>
                              <td className="py-4 px-6">
                                <div className="flex items-center justify-end gap-2">
                                  {a.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => accept(a.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold transition-all shadow-inner"
                                        title="Accept Task"
                                      >
                                        <Check className="w-4 h-4" /> Accept
                                      </button>
                                      <button
                                        onClick={() => reject(a.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-bold transition-all shadow-inner"
                                        title="Reject Task"
                                      >
                                        <X className="w-4 h-4" /> Reject
                                      </button>
                                    </>
                                  )}
                                  {a.status === 'accepted' && (
                                    <button
                                      onClick={() => navigate(`/evaluations/new?call_id=${a.call_lead_id}`)}
                                      className="flex items-center gap-2 px-5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(99,102,241,0.2)] hover:shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                                    >
                                      <Eye className="w-4 h-4" /> Evaluate
                                    </button>
                                  )}
                                  {a.status === 'completed' && (
                                    <button 
                                      disabled
                                      className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 border border-slate-700 text-emerald-500 rounded-lg text-[10px] font-bold uppercase tracking-widest opacity-70"
                                    >
                                      <CheckCircle2 className="w-3 h-3" /> Scored
                                    </button>
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

        {/* Footer Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800/60 bg-slate-900/40 flex justify-between items-center">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-5 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              Previous Page
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Page</span>
              <span className="w-8 h-8 flex items-center justify-center bg-indigo-500/20 text-indigo-400 font-bold rounded-lg border border-indigo-500/30">
                {page}
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">of {totalPages}</span>
            </div>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="px-5 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              Next Page
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
};

export default MyAssignmentsPage;
