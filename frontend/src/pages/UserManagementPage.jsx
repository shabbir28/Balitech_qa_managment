import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LoadingPage, Pagination, ConfirmModal } from '../components/ui';
import {
  Users, Search, Edit2, Trash2, X, Save, Key, ClipboardList, Clock,
  CheckCircle, XCircle, Play, Pause, Volume2, SkipBack, SkipForward, Shield,
  UserPlus, User, Mail, Phone as PhoneIcon, Activity,
  RefreshCw, ChevronDown
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-[#0D111D] border border-slate-700/60 rounded-2xl w-full max-w-md relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400" />
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white">Call Recording</p>
              <p className="text-sm text-slate-400 font-medium mt-0.5">📞 {phone}</p>
            </div>
          </div>
          <button onClick={() => { audioRef.current?.pause(); onClose(); }} className="w-8 h-8 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <audio ref={audioRef} src={url}
            onTimeUpdate={() => setCur(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)}
            onEnded={() => setPlaying(false)} preload="metadata" />
          <div className="relative h-2 bg-slate-900 border border-slate-800 rounded-full cursor-pointer overflow-hidden"
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * (dur || 0); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }}>
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500 font-medium">
            <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => { const t = Math.max(0, cur - 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="flex flex-col items-center p-3 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
              <SkipBack className="w-5 h-5" /><span className="text-[10px] font-semibold mt-1">10s</span>
            </button>
            <button onClick={toggle} className="w-14 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-105">
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

const UserManagementPage = () => {
  const { hasRole } = useAuth();
  const canManageUsers = hasRole('Super Admin');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [resetId, setResetId] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: 2, phone: '', campaign_id: '' });
  const [saving, setSaving] = useState(false);
  const [selectedUserActivity, setSelectedUserActivity] = useState(null);
  const [userAssignments, setUserAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [audioAssignment, setAudioAssignment] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, rolesRes, campaignsRes] = await Promise.all([
        api.get('/users', { params: { page, limit: 20, search } }),
        api.get('/roles'),
        api.get('/campaigns'),
      ]);
      setUsers(usersRes.data.data);
      setPagination(usersRes.data.pagination);
      setRoles(rolesRes.data.data);
      setCampaigns(campaignsRes.data.data);
    } catch {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', role_id: 2, phone: '', campaign_id: '' });
    setEditUser(null);
    setShowForm(true);
  };

  const openEdit = (user) => {
    setForm({ name: user.name, email: user.email, password: '', role_id: user.role_id, phone: user.phone || '', campaign_id: user.campaign_id || '' });
    setEditUser(user);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, { name: form.name, role_id: form.role_id, phone: form.phone, campaign_id: form.campaign_id || null });
        toast.success('User updated.');
      } else {
        if (!form.password) { toast.error('Password is required for new users.'); setSaving(false); return; }
        await api.post('/auth/register', { ...form, campaign_id: form.campaign_id || null });
        toast.success('User created.');
      }
      setShowForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${deleteId}`);
      toast.success('User deleted.');
      setDeleteId(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    }
  };

  const handleResetPw = async () => {
    if (!newPw || newPw.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    try {
      await api.put(`/users/${resetId}/reset-password`, { new_password: newPw });
      toast.success('Password reset successfully.');
      setResetId(null);
      setNewPw('');
    } catch {
      toast.error('Password reset failed.');
    }
  };

  const openActivity = async (user) => {
    setSelectedUserActivity(user);
    setLoadingAssignments(true);
    try {
      const res = await api.get('/assignments', { params: { user_id: user.id, limit: 1000 } });
      setUserAssignments(res.data.data || []);
    } catch {
      toast.error('Failed to load user activity.');
    } finally {
      setLoadingAssignments(false);
    }
  };

  const actStats = {
    total: userAssignments.length,
    pending: userAssignments.filter(a => a.status === 'pending').length,
    accepted: userAssignments.filter(a => a.status === 'accepted').length,
    rejected: userAssignments.filter(a => a.status === 'rejected').length,
  };

  const getRoleColor = (role) => {
    if (!role) return 'bg-slate-800 text-slate-300 border-slate-700';
    const r = role.toLowerCase();
    if (r.includes('super')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    if (r.includes('manager')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (r.includes('agent')) return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  const avatarColors = ['from-violet-500 to-purple-600', 'from-sky-500 to-blue-600', 'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-indigo-500 to-blue-600'];

  return (
    <div className="space-y-6 pb-10 max-w-[1440px] mx-auto font-sans">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-indigo-500/40 bg-indigo-500/5 text-indigo-400 text-[10px] font-bold tracking-wider uppercase mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>TEAM MANAGEMENT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">My Team</h1>
          <p className="text-slate-400 text-sm mt-1">Manage team members, roles, and activity tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2.5 rounded-xl bg-[#0D111D] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canManageUsers && (
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5">
              <UserPlus className="w-4 h-4" />
              Add Team Member
            </button>
          )}
        </div>
      </div>

      {/* ── SEARCH BAR ── */}
      <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              className="w-full bg-[#0A0E18] border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all text-sm placeholder:text-slate-600 font-medium"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium ml-auto">
            <Users className="w-3.5 h-3.5" />
            <span>{users.length} members</span>
          </div>
        </div>
      </div>

      {/* ── USERS TABLE ── */}
      <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        {loading ? <div className="py-16"><LoadingPage /></div> : users.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-indigo-400/50" />
            </div>
            <p className="text-white font-bold text-sm">No team members found</p>
            <p className="text-slate-500 text-xs mt-1">Try adjusting your search or add a new member.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#0A0E18] border-b border-slate-800">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campaign</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((user, idx) => (
                    <tr key={user.id} className="group hover:bg-slate-800/20 transition-all duration-150">
                      {/* Member */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white bg-gradient-to-br shrink-0 shadow-lg ${avatarColors[idx % avatarColors.length]}`}>
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{user.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">ID: #{user.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
                            <Mail className="w-3 h-3 text-slate-500" /> {user.email}
                          </span>
                          {user.phone && (
                            <span className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                              <PhoneIcon className="w-3 h-3 text-slate-500" /> {user.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${getRoleColor(user.role)}`}>
                          <Shield className="w-3 h-3" />
                          {user.role || 'Member'}
                        </span>
                      </td>

                      {/* Campaign */}
                      <td className="px-5 py-4">
                        {user.campaign_name ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold">
                            {user.campaign_name}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs italic">All campaigns</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-slate-600'}`} />
                          <span className={`text-xs font-bold ${user.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openActivity(user)}
                            className="p-2 rounded-lg text-indigo-400 hover:bg-indigo-500/15 border border-transparent hover:border-indigo-500/30 transition-all"
                            title="View Activity"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          {canManageUsers && (
                            <>
                              <button
                                onClick={() => openEdit(user)}
                                className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/15 border border-transparent hover:border-emerald-500/30 transition-all"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setResetId(user.id); setNewPw(''); }}
                                className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30 transition-all"
                                title="Reset Password"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteId(user.id)}
                                className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-all"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-800/60">
              <Pagination pagination={pagination} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* ── ACTIVITY DRAWER MODAL ── */}
      {selectedUserActivity && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-[#0D111D] border border-slate-700/60 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] flex flex-col relative overflow-hidden">
            {/* Top accent */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0`}>
                  {getInitials(selectedUserActivity.name)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedUserActivity.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Assignment Activity Log</p>
                </div>
              </div>
              <button onClick={() => setSelectedUserActivity(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats */}
            <div className="px-6 py-4 grid grid-cols-4 gap-3 border-b border-slate-800/60 flex-shrink-0">
              <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Total</p>
                <p className="text-xl font-black text-white">{actStats.total}</p>
              </div>
              <div className="bg-[#0A0E18] border border-amber-500/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-amber-500/60 uppercase mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</p>
                <p className="text-xl font-black text-amber-400">{actStats.pending}</p>
              </div>
              <div className="bg-[#0A0E18] border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-emerald-500/60 uppercase mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Done</p>
                <p className="text-xl font-black text-emerald-400">{actStats.accepted}</p>
              </div>
              <div className="bg-[#0A0E18] border border-rose-500/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-rose-500/60 uppercase mb-1 flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</p>
                <p className="text-xl font-black text-rose-400">{actStats.rejected}</p>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {loadingAssignments ? (
                <div className="flex items-center justify-center h-40 text-slate-500 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" /> Loading...
                </div>
              ) : userAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <ClipboardList className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm font-bold text-slate-300">No assignments found</p>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-[#0D111D] border-b border-slate-800 z-10">
                    <tr>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campaign</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recording</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {userAssignments.map(a => (
                      <tr key={a.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-3 font-mono text-sm font-bold text-white">{a.customer_phone}</td>
                        <td className="px-5 py-3 text-sm text-slate-300">{a.campaign_name}</td>
                        <td className="px-5 py-3 text-sm text-slate-400">
                          {a.assigned_at ? format(new Date(a.assigned_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            a.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            a.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                            a.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {a.recording_url && (a.status === 'accepted' || a.status === 'rejected') ? (
                            <button
                              onClick={() => setAudioAssignment(a)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-semibold transition-all group"
                            >
                              <Play className="w-3 h-3 group-hover:scale-110 transition-transform" /> Listen
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs italic">Not available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT USER MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="bg-[#0D111D] border border-slate-700/60 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 rounded-2xl flex flex-col shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500 opacity-80" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    {editUser ? 'Edit Team Member' : 'Add New Member'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editUser ? 'Update details and permissions.' : 'Create a new account and assign access.'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Personal Information */}
              <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-5 space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                    <input
                      className="w-full h-11 rounded-xl border border-slate-800 bg-[#0D111D] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. John Doe" required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Primary Phone</label>
                    <input
                      className="w-full h-11 rounded-xl border border-slate-800 bg-[#0D111D] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                      value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+1 555-0100"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                    <input
                      className="w-full h-11 rounded-xl border border-slate-800 bg-[#0D111D] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="user@domain.com" required disabled={!!editUser}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Role & Campaign */}
                <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-5 space-y-4">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Role & Access
                  </h3>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Assigned Role</label>
                    <div className="relative">
                      <select
                        className="w-full h-11 rounded-xl border border-slate-800 bg-[#0D111D] px-4 text-sm font-semibold text-white outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                        value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: parseInt(e.target.value) }))} required
                      >
                        <option value="" disabled>Select a role...</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Campaign Filter</label>
                    <div className="relative">
                      <select
                        className="w-full h-11 rounded-xl border border-slate-800 bg-[#0D111D] px-4 text-sm font-semibold text-white outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                        value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))}
                      >
                        <option value="">— All Campaigns —</option>
                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-2">Restricts user view to a single campaign only.</p>
                  </div>
                </div>

                {/* Security (create only) */}
                {!editUser && (
                  <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-5 space-y-4">
                    <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" /> Account Security
                    </h3>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Initial Password</label>
                      <input
                        className="w-full h-11 rounded-xl border border-slate-800 bg-[#0D111D] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20"
                        type="password" value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Minimum 6 characters" required
                      />
                      <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">Set a temporary password. They can change it later.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/60">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : (editUser ? 'Save Changes' : 'Create Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-[#0D111D] border border-slate-700/60 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-orange-500" />
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Password</h3>
                <p className="text-xs text-slate-400 mt-0.5">Enter a new secure password</p>
              </div>
            </div>
            <input
              className="w-full h-11 rounded-xl border border-slate-800 bg-[#0A0E18] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 mb-5"
              type="password" placeholder="Min 6 characters" value={newPw} onChange={e => setNewPw(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setResetId(null)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">Cancel</button>
              <button onClick={handleResetPw} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
                <Key className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Delete Team Member"
        message="Are you sure? This user will be deactivated and lose system access."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />

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

export default UserManagementPage;
