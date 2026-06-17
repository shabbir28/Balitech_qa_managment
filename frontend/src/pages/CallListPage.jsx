import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { LoadingPage, EmptyState, Pagination, ConfirmModal } from '../components/ui';
import {
  Phone, Search, Trash2, Eye, Upload, X,
  Play, Pause, Volume2, SkipBack, SkipForward
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

/* ─── Inline Audio Player Modal ─────────────────────────── */
const AudioPlayerModal = ({ call, onClose }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const fmt = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => toast.error('Could not play audio. Check the URL or CORS settings.'));
      setIsPlaying(true);
    }
  };

  const seek = (delta) => {
    if (!audioRef.current) return;
    const t = Math.max(0, Math.min(duration, currentTime + delta));
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleClose = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setIsPlaying(false);
    onClose();
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Call Recording</p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {call.agent_name} · {call.customer_phone}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player Body */}
        <div className="p-6 space-y-6">
          {/* Info strip */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Campaign', value: call.campaign_name || '—' },
              { label: 'Duration', value: call.call_duration || '—' },
              { label: 'Date', value: call.call_date ? format(new Date(call.call_date), 'MMM d') : '—' },
            ].map(f => (
              <div key={f.label} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{f.label}</p>
                <p className="text-sm text-slate-200 font-medium truncate">{f.value}</p>
              </div>
            ))}
          </div>

          <audio
            ref={audioRef}
            src={call.recording_url}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
            onEnded={() => setIsPlaying(false)}
            preload="metadata"
          />

          {/* Progress */}
          <div>
            <div className="relative h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                const t = ratio * (duration || 0);
                if (audioRef.current) audioRef.current.currentTime = t;
                setCurrentTime(t);
              }}
            >
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg border-2 border-emerald-500 transition-all"
                style={{ left: `calc(${pct}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-medium mt-2">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => seek(-10)}
              className="flex flex-col items-center gap-1 px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <SkipBack className="w-5 h-5" />
              <span className="text-[10px] font-semibold">10s</span>
            </button>

            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
            </button>

            <button
              onClick={() => seek(10)}
              className="flex flex-col items-center gap-1 px-4 py-2 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <SkipForward className="w-5 h-5" />
              <span className="text-[10px] font-semibold">10s</span>
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
              }}
              className="flex-1 h-1.5 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* URL */}
          <p className="text-xs text-slate-600 break-all text-center leading-relaxed">{call.recording_url}</p>
        </div>
      </div>
    </div>
  );
};

/* ─── Main CallListPage ──────────────────────────────────── */
const CallListPage = () => {
  const [calls, setCalls] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [filters, setFilters] = useState({ campaign_name: '', from_date: '', to_date: '' });
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [playingCall, setPlayingCall] = useState(null);
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const fetchCalls = useCallback(async () => {
    try {
      const params = { page, limit: 20, search, phone: phoneSearch, ...filters };
      const res = await api.get('/calls', { params });
      setCalls(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load call records.');
    } finally {
      setLoading(false);
    }
  }, [page, search, phoneSearch, filters]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const handleDelete = async () => {
    try {
      await api.delete(`/calls/${deleteId}`);
      toast.success('Record deleted.');
      setDeleteId(null);
      fetchCalls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setPhoneSearch('');
    setFilters({ campaign_name: '', from_date: '', to_date: '' });
    setPage(1);
  };

  const hasActiveFilter = search || phoneSearch || filters.campaign_name || filters.from_date || filters.to_date;

  return (
    <div>
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Call / Lead Records</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} total records</p>
        </div>
        {hasRole('Manager') && (
          <button onClick={() => navigate('/calls/upload')} className="btn-primary">
            <Upload size={16} /> Upload File
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* General Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search agent, customer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Phone Number Search */}
          <div className="relative min-w-[200px]">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search by phone number..."
              value={phoneSearch}
              onChange={(e) => { setPhoneSearch(e.target.value); setPage(1); }}
            />
          </div>

          <input
            type="text"
            className="input w-40"
            placeholder="Campaign"
            value={filters.campaign_name}
            onChange={(e) => { setFilters(f => ({ ...f, campaign_name: e.target.value })); setPage(1); }}
          />
          <input
            type="date"
            className="input w-36"
            value={filters.from_date}
            onChange={(e) => { setFilters(f => ({ ...f, from_date: e.target.value })); setPage(1); }}
          />
          <input
            type="date"
            className="input w-36"
            value={filters.to_date}
            onChange={(e) => { setFilters(f => ({ ...f, to_date: e.target.value })); setPage(1); }}
          />
          {hasActiveFilter && (
            <button onClick={clearFilters} className="btn-ghost text-sm">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <LoadingPage />
        ) : calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No records found"
            description="Upload call records to get started or adjust your search filters."
            action={hasRole('Manager') && (
              <button onClick={() => navigate('/calls/upload')} className="btn-primary">
                <Upload size={16} /> Upload File
              </button>
            )}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Agent</th>
                    <th className="th">Campaign</th>
                    <th className="th">Customer</th>
                    <th className="th">Phone</th>
                    <th className="th">Call Date</th>
                    <th className="th">Disposition</th>
                    <th className="th">Recording</th>
                    <th className="th">Status</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="tr">
                      <td className="td">
                        <div>
                          <p className="font-semibold text-white text-xs">{call.agent_name}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{call.agent_id}</p>
                        </div>
                      </td>
                      <td className="td">
                        <span className="text-slate-300 text-xs">{call.campaign_name || '—'}</span>
                      </td>
                      <td className="td">
                        <p className="text-slate-200 text-xs font-medium">{call.customer_name || '—'}</p>
                      </td>
                      <td className="td font-mono text-xs text-slate-300">{call.customer_phone}</td>
                      <td className="td text-xs text-slate-400">
                        {call.call_date ? format(new Date(call.call_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="td">
                        {call.disposition ? (
                          <span className="badge-blue">{call.disposition}</span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>

                      {/* Recording Column */}
                      <td className="td">
                        {call.recording_url ? (
                          <button
                            onClick={() => setPlayingCall(call)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 rounded-lg text-xs font-semibold transition-all group"
                            title={call.recording_url}
                          >
                            <Play className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            Play
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs font-semibold">No Audio</span>
                        )}
                      </td>

                      <td className="td">
                        {call.is_evaluated ? (
                          <span className="badge-green">✓ Evaluated</span>
                        ) : (
                          <span className="badge-gray">Pending</span>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          {!call.is_evaluated && hasRole('Manager') && (
                            <button
                              onClick={() => navigate(`/evaluations/new?call_id=${call.id}`)}
                              className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all"
                              title="Evaluate"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                          {hasRole('Manager') && (
                            <button
                              onClick={() => setDeleteId(call.id)}
                              className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Audio Player Modal */}
      {playingCall && (
        <AudioPlayerModal call={playingCall} onClose={() => setPlayingCall(null)} />
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Delete Record"
        message="Are you sure you want to delete this call/lead record? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  );
};

export default CallListPage;
