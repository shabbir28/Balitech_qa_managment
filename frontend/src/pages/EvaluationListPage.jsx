import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { LoadingPage, EmptyState, DateRangeDropdown } from '../components/ui';
import { ClipboardCheck, Users, X, Play, Pause, Volume2, SkipBack, SkipForward, Search, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
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
    </div>,
    document.body
  );
};


const EvaluationListPage = () => {
  const [managedUsers, setManagedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Filters
  const [filters, setFilters] = useState({ search: '', campaign: '', from_date: '', to_date: '' });
  const [campaigns, setCampaigns] = useState([]);

  // Detail Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAssignments, setUserAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // all, pending, accepted, rejected
  
  // Sub-modals
  const [audioAssignment, setAudioAssignment] = useState(null);

  const { hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/campaigns').then(res => setCampaigns(res.data.data)).catch(() => {});
  }, []);

  const fetchManagedUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users/managed-stats', { params: filters });
      setManagedUsers(res.data.data || []);
    } catch {
      toast.error('Failed to load QA users.');
    } finally {
      setLoadingUsers(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchManagedUsers();
  }, [fetchManagedUsers]);

  const openUserActivity = async (u, defaultFilter = 'all') => {
    setSelectedUser(u);
    setAssignmentFilter(defaultFilter);
    setLoadingAssignments(true);
    try {
      const res = await api.get('/assignments', { params: { user_id: u.id, limit: 1000 } });
      const enriched = res.data.data.map(a => {
        let displayStatus = 'pending';
        if (a.status === 'completed' || a.evaluation_status) {
            const evalStatus = (a.evaluation_status || '').toLowerCase();
            if (evalStatus === 'pass' || evalStatus === 'accepted') displayStatus = 'accepted';
            else if (evalStatus === 'fail' || evalStatus === 'rejected') displayStatus = 'rejected';
            else if (evalStatus === 'flagged') displayStatus = 'flagged';
            else if (evalStatus === 'decline') displayStatus = 'decline';
            else if (evalStatus.includes('not billable') || evalStatus.includes('not bilable')) displayStatus = 'not_billable';
            else displayStatus = 'completed';
        } else if (a.status === 'rejected') {
            displayStatus = 'rejected (declined task)'; 
        }
        return { ...a, displayStatus };
      });
      setUserAssignments(enriched);
    } catch {
      toast.error('Failed to load user assignments.');
    } finally {
      setLoadingAssignments(false);
    }
  };



  if (!hasRole('Super Admin', 'QA Admin', 'Manager')) {
    return <div className="p-10 text-center text-slate-500">You do not have access to this page.</div>;
  }

  const filteredAssignments = userAssignments.filter(a => {
    if (assignmentFilter === 'all') return true;
    if (assignmentFilter === 'rejected') return a.displayStatus === 'rejected' || a.displayStatus === 'rejected (declined task)';
    return a.displayStatus === assignmentFilter;
  });

  return (
    <div>
      <div className="page-header flex-wrap gap-3 mb-6">
        <div>
          <h1 className="page-title">QA Performance</h1>
          <p className="page-subtitle">Track your QA evaluators' performance and listen to their accepted/rejected calls</p>
        </div>
      </div>

      {/* Main Filters */}
      <div className="card p-4 mb-8 !overflow-visible z-50">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input className="input pl-9" placeholder="Search QA user name..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <select className="input w-48" value={filters.campaign} onChange={e => setFilters(f => ({ ...f, campaign: e.target.value }))}>
            <option value="">All Campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <DateRangeDropdown
            startDate={filters.from_date}
            endDate={filters.to_date}
            onChange={(start, end) => setFilters(f => ({ ...f, from_date: start || '', to_date: end || '' }))}
          />
          {(filters.search || filters.campaign || filters.from_date || filters.to_date) && (
            <button onClick={() => setFilters({ search: '', campaign: '', from_date: '', to_date: '' })} className="btn-ghost text-sm">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingUsers ? (
            <div className="col-span-full h-48 flex items-center justify-center">
              <LoadingPage />
            </div>
          ) : managedUsers.length === 0 ? (
            <div className="col-span-full">
              <EmptyState icon={Users} title="No QA team members" description="No users match your filters or you have not assigned any leads." />
            </div>
          ) : (
            managedUsers.map(u => (
              <div key={u.id} 
                onClick={() => openUserActivity(u)}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all cursor-pointer group relative overflow-hidden shadow-lg"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ClipboardCheck size={80} />
                </div>
                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">{u.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{u.role}</p>
                      <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{u.user_campaign_name || 'ALL CAMPAIGNS'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 relative z-10">
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 hover:border-slate-600 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserActivity(u, 'all'); }}>
                    <p className="text-[11px] text-slate-500 mb-0.5">Total Assigned</p>
                    <p className="text-lg font-bold text-white">{u.total_assigned}</p>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 hover:border-amber-500/50 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserActivity(u, 'pending'); }}>
                    <p className="text-[11px] text-amber-500/70 mb-0.5">Pending</p>
                    <p className="text-lg font-bold text-amber-400">{u.pending}</p>
                  </div>
                  <div className="bg-emerald-500/10 rounded-xl p-2.5 border border-emerald-500/20 hover:border-emerald-500/50 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserActivity(u, 'accepted'); }}>
                    <p className="text-[11px] text-emerald-400 mb-0.5">Accepted</p>
                    <p className="text-lg font-bold text-emerald-400">{u.accepted}</p>
                  </div>
                  <div className="bg-rose-500/10 rounded-xl p-2.5 border border-rose-500/20 hover:border-rose-500/50 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserActivity(u, 'rejected'); }}>
                    <p className="text-[11px] text-rose-400 mb-0.5">Rejected</p>
                    <p className="text-lg font-bold text-rose-400">{u.rejected}</p>
                  </div>
                  <div className="bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/20 hover:border-amber-500/50 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserActivity(u, 'flagged'); }}>
                    <p className="text-[11px] text-amber-400 mb-0.5">Flagged</p>
                    <p className="text-lg font-bold text-amber-400">{u.flagged || 0}</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-xl p-2.5 border border-purple-500/20 hover:border-purple-500/50 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserActivity(u, 'decline'); }}>
                    <p className="text-[11px] text-purple-400 mb-0.5">Decline</p>
                    <p className="text-lg font-bold text-purple-400">{u.decline || 0}</p>
                  </div>
                  <div className="bg-cyan-500/10 rounded-xl p-2.5 border border-cyan-500/20 hover:border-cyan-500/50 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserActivity(u, 'not_billable'); }}>
                    <p className="text-[11px] text-cyan-400 mb-0.5">Not Billable</p>
                    <p className="text-lg font-bold text-cyan-400">{u.not_billable || 0}</p>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 transition-colors">
                    <p className="text-[11px] text-slate-400 mb-0.5">Under Buffer</p>
                    <p className="text-lg font-bold text-white">{u.under_buffer || 0}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Activity Modal for QA Performance */}
      {selectedUser && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500" />
            
            <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ClipboardCheck className="w-6 h-6 text-indigo-400" />
                  Performance Data for {selectedUser.name}
                </h3>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All Assignments' },
                { id: 'pending', label: 'Pending' },
                { id: 'accepted', label: 'Accepted' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'flagged', label: 'Flagged' },
                { id: 'decline', label: 'Decline' },
                { id: 'not_billable', label: 'Not Billable' }
              ].map(tab => {
                const count = tab.id === 'all' 
                  ? userAssignments.length 
                  : userAssignments.filter(a => a.displayStatus === tab.id).length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAssignmentFilter(tab.id)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      assignmentFilter === tab.id 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400' 
                        : 'text-slate-400 bg-slate-950/60 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      assignmentFilter === tab.id ? 'bg-indigo-700/80 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {loadingAssignments ? (
                <div className="p-10 text-center text-slate-500">Loading assignments...</div>
              ) : filteredAssignments.length === 0 ? (
                <div className="p-10 text-center text-slate-500 card border-slate-800">No leads found for this filter.</div>
              ) : (
                <div className="card overflow-hidden border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead className="thead">
                        <tr>
                          <th className="th">Phone</th>
                          <th className="th">Campaign</th>
                          <th className="th">Assigned Date</th>
                          <th className="th">Status</th>
                          <th className="th">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredAssignments.map(a => (
                          <tr key={a.id} className="tr">
                            <td className="td font-mono text-sm font-bold text-white">{a.customer_phone}</td>
                            <td className="td text-sm text-slate-300">{a.campaign_name}</td>
                            <td className="td text-sm text-slate-400">
                              {a.assigned_at ? format(new Date(a.assigned_at), 'MMM d, yyyy') : '—'}
                            </td>
                            <td className="td">
                              <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                a.displayStatus === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                a.displayStatus === 'rejected' || a.displayStatus === 'rejected (declined task)' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                                a.displayStatus === 'flagged' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                a.displayStatus === 'decline' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                                a.displayStatus === 'not_billable' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
                                a.displayStatus === 'pending' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/30' :
                                'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              }`}>
                                {a.displayStatus === 'accepted' ? 'Accepted' : a.displayStatus === 'rejected' ? 'Rejected' : a.displayStatus === 'flagged' ? 'Flagged' : a.displayStatus === 'decline' ? 'Decline' : a.displayStatus === 'not_billable' ? 'Not Billable' : a.displayStatus === 'pending' ? 'Pending' : 'Completed'}
                              </span>
                            </td>
                            <td className="td">
                              <div className="flex gap-2">
                                {a.evaluation_id && (
                                  <button
                                    onClick={() => navigate(`/evaluations/view/${a.evaluation_id}`)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all group"
                                  >
                                    <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> View Form
                                  </button>
                                )}
                                {a.recording_url && a.displayStatus !== 'pending' && (
                                  <button
                                    onClick={() => setAudioAssignment(a)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-semibold transition-all group"
                                  >
                                    <Play className="w-3 h-3 group-hover:scale-110 transition-transform" /> Listen
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* Audio Player */}
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

export default EvaluationListPage;
