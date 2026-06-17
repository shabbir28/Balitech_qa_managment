import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ClipboardCheck, Play, Pause, SkipBack, SkipForward, Volume2, X, Check, Eye } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Call Recording</p>
              <p className="text-sm text-slate-400 font-medium mt-1">{phone}</p>
            </div>
          </div>
          <button onClick={() => { audioRef.current?.pause(); onClose(); }} className="w-8 h-8 rounded-lg border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <audio ref={audioRef} src={url}
            onTimeUpdate={() => setCur(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)}
            onEnded={() => setPlaying(false)} preload="metadata" />
          <div className="relative h-2 bg-slate-950 border border-slate-800 rounded-full cursor-pointer overflow-hidden"
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * (dur || 0); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }}>
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500 font-medium">
            <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => { const t = Math.max(0, cur - 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-3 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
              <SkipBack className="w-5 h-5" /><span className="text-[10px] font-semibold mt-1">10s</span>
            </button>
            <button onClick={toggle} className="w-14 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg transition-all hover:scale-105">
              {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <button onClick={() => { const t = Math.min(dur, cur + 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-3 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
              <SkipForward className="w-5 h-5" /><span className="text-[10px] font-semibold mt-1">10s</span>
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
    pending: 'bg-amber-500/10 border border-amber-500/30 text-amber-400',
    accepted: 'bg-primary-500/10 border border-primary-500/30 text-primary-400',
    rejected: 'bg-rose-500/10 border border-rose-500/30 text-rose-400',
    completed: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400',
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${map[status] || ''}`}>
      {status}
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
  const navigate = useNavigate();

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
      toast.success('Assignment accepted!');
      fetchAssignments();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const reject = async (id) => {
    try {
      await api.patch(`/assignments/${id}/reject`);
      toast.success('Assignment rejected!');
      fetchAssignments();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reject.'); }
  };

  const acceptAll = async () => {
    try {
      setLoading(true);
      const res = await api.patch('/assignments/accept-all');
      toast.success(res.data.message || 'All pending assignments accepted!');
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Assignments</h1>
          <p className="page-subtitle">Leads assigned to you by your manager — accept and evaluate them</p>
        </div>
        {stats.pending > 0 && (
          <button onClick={acceptAll} disabled={loading} className="btn-primary">
            <Check className="w-4 h-4 mr-2" />
            Accept All Pending ({stats.pending})
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', key: 'all', color: 'text-white', bg: 'border-slate-800' },
          { label: 'Pending', key: 'pending', color: 'text-amber-400', bg: 'border-amber-500/20 bg-amber-500/5' },
          { label: 'Accepted', key: 'accepted', color: 'text-indigo-400', bg: 'border-indigo-500/20 bg-indigo-500/5' },
          { label: 'Rejected', key: 'rejected', color: 'text-rose-400', bg: 'border-rose-500/20 bg-rose-500/5' },
          { label: 'Completed', key: 'completed', color: 'text-emerald-400', bg: 'border-emerald-500/20 bg-emerald-500/5' },
        ].map(s => (
          <button key={s.key} onClick={() => { setFilter(s.key); setPage(1); }}
            className={`card p-5 text-left transition-all hover:border-slate-600 ${filter === s.key ? s.bg + ' ring-1 ring-inset ring-current/20' : ''}`}>
            <p className={`text-3xl font-bold mb-1 ${s.color}`}>{counts[s.key]}</p>
            <p className="text-sm text-slate-400 font-medium">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Assignments List */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardCheck className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-white font-bold mb-1">No assignments yet</p>
          <p className="text-slate-500 text-sm">Your manager hasn't assigned any leads to you yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">Phone</th>
                  <th className="th">Campaign</th>
                  <th className="th">Agent</th>
                  <th className="th">Date</th>
                  <th className="th">Disposition</th>
                  <th className="th">Recording</th>
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id} className="tr">
                    <td className="td font-mono text-xs font-bold text-white">{a.customer_phone}</td>
                    <td className="td text-xs text-primary-400 font-semibold">{a.campaign_name}</td>
                    <td className="td">
                      <p className="text-xs font-semibold text-white">{a.agent_name}</p>
                    </td>
                    <td className="td text-xs text-slate-400">
                      {a.call_date ? format(new Date(a.call_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="td">
                      {a.disposition ? <span className="badge-blue">{a.disposition}</span> : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="td">
                      {a.recording_url ? (
                        <button
                          onClick={() => setAudioAssignment(a)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold transition-all group"
                        >
                          <Play className="w-3 h-3 group-hover:scale-110 transition-transform" /> Play
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs font-semibold">No Audio</span>
                      )}
                    </td>
                    <td className="td"><StatusBadge status={a.status} /></td>
                    <td className="td">
                      <div className="flex items-center gap-1.5">
                        {a.status === 'pending' && (
                          <>
                            <button
                              onClick={() => accept(a.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold transition-all"
                            >
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button
                              onClick={() => reject(a.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-semibold transition-all"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {a.status === 'accepted' && (
                          <button
                            onClick={() => navigate(`/evaluations/new?call_id=${a.call_lead_id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-semibold transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> Evaluate
                          </button>
                        )}
                        {a.status === 'completed' && (
                          <span className="text-xs text-emerald-400 font-semibold">✓ Done</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex justify-between items-center">
              <button 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)}
                className="btn-secondary px-4 py-2"
              >
                Previous
              </button>
              <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
              <button 
                disabled={page === totalPages} 
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary px-4 py-2"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

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
