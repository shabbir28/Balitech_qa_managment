import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { LoadingPage, EmptyState, Pagination, Badge, ConfirmModal } from '../components/ui';
import { Users, Search, Plus, Edit2, Trash2, X, Save, Key, ClipboardList, Clock, CheckCircle, XCircle, Play, Pause, Volume2, SkipBack, SkipForward, Shield, UserPlus, User } from 'lucide-react';
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


const UserManagementPage = () => {
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

  // Activity Tracking
  const [selectedUserActivity, setSelectedUserActivity] = useState(null);
  const [userAssignments, setUserAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [audioAssignment, setAudioAssignment] = useState(null);

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

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

  const stats = {
    total: userAssignments.length,
    pending: userAssignments.filter(a => a.status === 'pending').length,
    accepted: userAssignments.filter(a => a.status === 'accepted').length,
    rejected: userAssignments.filter(a => a.status === 'rejected').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">My Team</h1>
          <p className="page-subtitle">Create and manage your team members</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card p-5 mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Search name, email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingPage /> : users.length === 0 ? (
          <EmptyState icon={Users} title="No users found" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Email</th>
                    <th className="th">Role</th>
                    <th className="th">Campaign</th>
                    <th className="th">Status</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map(user => (
                    <tr key={user.id} className="tr">
                      <td className="td font-semibold text-white">{user.name}</td>
                      <td className="td text-slate-400 text-sm">{user.email}</td>
                      <td className="td"><Badge status={user.role} /></td>
                      <td className="td text-slate-300 text-sm">
                        {user.campaign_name ? (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">{user.campaign_name}</span>
                        ) : <span className="text-slate-600 text-xs italic">All campaigns</span>}
                      </td>
                      <td className="td">
                        {user.is_active ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openActivity(user)} className="p-2 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-all" title="Activity">
                            <ClipboardList size={16} />
                          </button>
                          <button onClick={() => openEdit(user)} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => { setResetId(user.id); setNewPw(''); }} className="p-2 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-all" title="Reset Password">
                            <Key size={16} />
                          </button>
                          <button onClick={() => setDeleteId(user.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all" title="Delete">
                            <Trash2 size={16} />
                          </button>
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

      {/* Activity Modal */}
      {selectedUserActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500" />
            
            <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-indigo-400" />
                  Assigned Leads Activity
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Viewing assignments for <span className="text-white font-semibold">{selectedUserActivity.name}</span>
                </p>
              </div>
              <button onClick={() => setSelectedUserActivity(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
                  <p className="text-slate-500 font-medium mb-1 text-sm flex items-center gap-1"><ClipboardList className="w-4 h-4" /> Total Assigned</p>
                  <p className="text-white font-bold text-2xl">{stats.total}</p>
                </div>
                <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-4">
                  <p className="text-amber-500/70 font-medium mb-1 text-sm flex items-center gap-1"><Clock className="w-4 h-4" /> Pending</p>
                  <p className="text-amber-400 font-bold text-2xl">{stats.pending}</p>
                </div>
                <div className="bg-primary-500/5 rounded-xl border border-primary-500/20 p-4">
                  <p className="text-primary-500/70 font-medium mb-1 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Accepted</p>
                  <p className="text-primary-400 font-bold text-2xl">{stats.accepted}</p>
                </div>
                <div className="bg-rose-500/5 rounded-xl border border-rose-500/20 p-4">
                  <p className="text-rose-500/70 font-medium mb-1 text-sm flex items-center gap-1"><XCircle className="w-4 h-4" /> Rejected</p>
                  <p className="text-rose-400 font-bold text-2xl">{stats.rejected}</p>
                </div>
              </div>

              {loadingAssignments ? (
                <div className="p-10 text-center text-slate-500">Loading assignments...</div>
              ) : userAssignments.length === 0 ? (
                <div className="p-10 text-center text-slate-500 card">No assignments found for this user.</div>
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
                          <th className="th">Recording</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {userAssignments.map(a => (
                          <tr key={a.id} className="tr">
                            <td className="td font-mono text-sm font-bold text-white">{a.customer_phone}</td>
                            <td className="td text-sm text-slate-300">{a.campaign_name}</td>
                            <td className="td text-sm text-slate-400">
                              {a.assigned_at ? format(new Date(a.assigned_at), 'MMM d, yyyy') : '—'}
                            </td>
                            <td className="td">
                              <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                a.status === 'accepted' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/30' :
                                a.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                                a.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="td">
                              {a.recording_url && (a.status === 'accepted' || a.status === 'rejected') ? (
                                <button
                                  onClick={() => setAudioAssignment(a)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-semibold transition-all group"
                                >
                                  <Play className="w-3 h-3 group-hover:scale-110 transition-transform" /> Listen
                                </button>
                              ) : (
                                <span className="text-slate-600 text-xs font-medium italic">Not available</span>
                              )}
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
        </div>
      )}

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0A0F1A]/80 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="bg-[#0D1321]/95 backdrop-blur-xl border border-white/[0.08] w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-10 rounded-3xl flex flex-col shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500 opacity-80" />
            <div className="flex items-center justify-between p-6 border-b border-white/[0.05] bg-[#0d1117]">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                  {editUser ? 'Edit Team Member' : 'Add New User'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">{editUser ? 'Update the details and permissions for this user.' : 'Create a new account and assign their access level.'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 flex-1 flex flex-col overflow-y-auto bg-[#0a0d14]">
              <div className="space-y-6">
                {/* Personal Details */}
                <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.10] transition-colors">
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                      <input className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Doe" required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Primary Phone</label>
                      <input className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0100" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                      <input className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@domain.com" required disabled={!!editUser} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* System Access */}
                  <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.10] transition-colors flex flex-col h-full">
                    <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" />
                      Role & Permissions
                    </h3>
                    <div className="space-y-5 flex-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Assigned Role</label>
                        <select className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20" value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: parseInt(e.target.value) }))} required>
                          <option value="" disabled>Select a role...</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Campaign Filter (Optional)</label>
                        <select className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20" value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))}>
                          <option value="">— No restriction (All Data) —</option>
                          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">
                          Restrict this user's view to a single campaign.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Security (Only when creating) */}
                  {!editUser && (
                    <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.10] transition-colors flex flex-col h-full">
                      <h3 className="text-[11px] font-black text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Key className="w-3.5 h-3.5" />
                        Account Security
                      </h3>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Initial Password</label>
                        <input className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 characters" required />
                        <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">Set a secure temporary password. They can change it later.</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Actions */}
              <div className="mt-8 pt-5 border-t border-white/[0.05] flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/[0.02] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white hover:text-slate-900 rounded-xl text-xs font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all disabled:opacity-50 flex items-center gap-2">
                  <Save size={16} /> {saving ? 'Saving...' : (editUser ? 'Save Changes' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 to-orange-500" />
            <h3 className="text-lg font-semibold text-white mb-5">Reset Password</h3>
            <label className="label">New Password</label>
            <input className="input mb-5" type="password" placeholder="Min 6 characters" value={newPw} onChange={e => setNewPw(e.target.value)} />
            <div className="flex gap-3 justify-end">
               <button onClick={() => setResetId(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleResetPw} className="btn-primary"><Key size={16} /> Reset</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Delete User"
        message="Are you sure? This user will be deactivated."
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
