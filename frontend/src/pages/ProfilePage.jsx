import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Save, Shield, Users, Play, Pause, Volume2, X, SkipBack, SkipForward, Clock, CheckCircle, XCircle, Target } from 'lucide-react';
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
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

/* ─── Main Page ────────────────────────────────────────────────────── */
const ProfilePage = () => {
  const { user, loadUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    department: user?.department || '',
    phone: user?.phone || '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  
  // Manager features
  const [managedUsers, setManagedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAssignments, setUserAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [audioAssignment, setAudioAssignment] = useState(null);

  const fetchManagedUsers = useCallback(async () => {
    if (user?.role !== 'Manager') return;
    setLoadingUsers(true);
    try {
      const res = await api.get('/users/managed-stats');
      setManagedUsers(res.data.data || []);
    } catch {
      toast.error('Failed to load managed users.');
    } finally {
      setLoadingUsers(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'team') fetchManagedUsers();
  }, [activeTab, fetchManagedUsers]);

  const fetchUserAssignments = async (uId) => {
    setLoadingAssignments(true);
    try {
      const res = await api.get('/assignments', { params: { user_id: uId, limit: 100 } });
      setUserAssignments(res.data.data || []);
    } catch {
      toast.error('Failed to load user assignments.');
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put('/auth/profile', profileForm);
      await loadUser();
      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePwSave = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('New passwords do not match.');
      return;
    }
    if (pwForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSavingPw(true);
    try {
      await api.put('/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed successfully.');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSavingPw(false);
    }
  };

  const roleColors = {
    Admin: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    Manager: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    'QA Officer': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Team Lead': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    Agent: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    User: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-4">
            <User className="w-3 h-3" /> Account Settings
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">My Profile</h1>
          <p className="text-slate-400 text-xs mt-1.5 font-medium leading-relaxed">Manage your personal information, security, and preferences.</p>
        </div>
        {user?.role === 'Manager' && (
          <div className="flex bg-[#0d1117] border border-white/[0.06] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-emerald-500/10 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'team' ? 'bg-indigo-500/10 text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}
            >
              Managed Users
            </button>
          </div>
        )}
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ── Left Column: Profile Card ───────────────────────────────── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="relative overflow-hidden bg-[#0d1117] border border-white/[0.06] rounded-2xl p-8 flex flex-col items-center text-center hover:border-white/[0.12] transition-all duration-300 group">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl group-hover:bg-emerald-500/20 transition-all" />
              
              <div className="w-28 h-28 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-[2rem] flex items-center justify-center text-emerald-400 text-5xl font-black shadow-[0_0_30px_rgba(16,185,129,0.15)] mb-5 transform group-hover:scale-105 transition-transform duration-300">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              
              <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-1">{user?.name}</h2>
              <p className="text-slate-400 text-xs font-bold mb-6">{user?.email}</p>
              
              <div className="w-full flex flex-col gap-2.5">
                <div className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border ${roleColors[user?.role] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'} flex items-center justify-center`}>
                  <Shield className="w-4 h-4 mr-2" />
                  {user?.role}
                </div>
                
                {user?.agent_id && (
                  <div className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[#151a23] text-slate-400 border border-white/[0.05] flex justify-center">
                    Agent ID: {user.agent_id}
                  </div>
                )}
                
                <div className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                  <Target className="w-4 h-4 mr-2" />
                  {user?.campaign_name || 'Unassigned Campaign'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Forms ───────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

          {/* Edit Profile */}
          <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-all duration-300">
            <div className="px-6 py-5 border-b border-white/[0.05] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">Edit Profile</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Update your contact details</p>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={handleProfileSave} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                  <input
                    className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Department</label>
                    <input
                      className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                      value={profileForm.department}
                      onChange={(e) => setProfileForm(f => ({ ...f, department: e.target.value }))}
                      placeholder="Sales, QA, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Phone</label>
                    <input
                      className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+1 555-0100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email</label>
                  <input className="w-full h-11 rounded-xl border border-white/[0.04] bg-[#0a0d13] px-4 text-sm font-semibold text-slate-500 cursor-not-allowed" value={user?.email} disabled />
                  <p className="text-[10px] font-semibold text-slate-600 mt-2">Email cannot be changed. Contact Admin.</p>
                </div>
                <div className="flex justify-end pt-3">
                  <button type="submit" disabled={savingProfile} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50">
                    <Save size={16} />
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Change Password */}
          {user?.role !== 'User' && user?.role !== 'Agent' && (
            <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-all duration-300">
              <div className="px-6 py-5 border-b border-white/[0.05] flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Change Password</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Ensure your account is secure</p>
                </div>
              </div>
              <div className="p-6">
                <form onSubmit={handlePwSave} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Current Password</label>
                    <input
                      type="password"
                      className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                      value={pwForm.current_password}
                      onChange={(e) => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">New Password</label>
                    <input
                      type="password"
                      className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                      value={pwForm.new_password}
                      onChange={(e) => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#151a23] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                      value={pwForm.confirm_password}
                      onChange={(e) => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                      placeholder="Repeat new password"
                    />
                  </div>
                  <div className="flex justify-end pt-3">
                    <button type="submit" disabled={savingPw} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white hover:text-slate-900 rounded-xl text-xs font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all disabled:opacity-50">
                      <Lock size={16} />
                      {savingPw ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingUsers ? (
              <div className="col-span-full py-10 text-center text-slate-500">Loading users...</div>
            ) : managedUsers.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-500 card">No assigned users found. Assign leads to see them here.</div>
            ) : (
              managedUsers.map(u => (
                <div key={u.id} 
                  onClick={() => { setSelectedUser(u); fetchUserAssignments(u.id); }}
                  className={`card p-5 cursor-pointer transition-all hover:border-indigo-500/50 ${selectedUser?.id === u.id ? 'ring-1 ring-indigo-500 border-indigo-500 bg-indigo-500/5' : ''}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">{u.name}</h4>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900 rounded border border-slate-800 p-2">
                      <p className="text-slate-500 font-medium mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Total</p>
                      <p className="text-white font-bold text-base">{u.total_assigned}</p>
                    </div>
                    <div className="bg-amber-500/5 rounded border border-amber-500/20 p-2">
                      <p className="text-amber-500/70 font-medium mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</p>
                      <p className="text-amber-400 font-bold text-base">{u.pending}</p>
                    </div>
                    <div className="bg-primary-500/5 rounded border border-primary-500/20 p-2">
                      <p className="text-primary-500/70 font-medium mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Accepted</p>
                      <p className="text-primary-400 font-bold text-base">{u.accepted}</p>
                    </div>
                    <div className="bg-rose-500/5 rounded border border-rose-500/20 p-2">
                      <p className="text-rose-500/70 font-medium mb-1 flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</p>
                      <p className="text-rose-400 font-bold text-base">{u.rejected}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedUser && (
            <div className="card overflow-hidden mt-6 border-indigo-500/20 bg-indigo-500/5">
              <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    Leads for {selectedUser.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Click play to review accepted or rejected calls</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="btn-secondary px-3 py-1.5 text-xs">Close</button>
              </div>
              
              {loadingAssignments ? (
                <div className="p-10 text-center text-slate-500 text-sm">Loading assignments...</div>
              ) : userAssignments.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-sm">No assignments found for this user.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead className="thead">
                      <tr>
                        <th className="th">Phone</th>
                        <th className="th">Campaign</th>
                        <th className="th">Date</th>
                        <th className="th">Status</th>
                        <th className="th">Recording</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userAssignments.map(a => (
                        <tr key={a.id} className="tr">
                          <td className="td font-mono text-xs font-bold text-white">{a.customer_phone}</td>
                          <td className="td text-xs text-slate-300">{a.campaign_name}</td>
                          <td className="td text-xs text-slate-400">
                            {a.call_date ? format(new Date(a.call_date), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="td">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
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
              )}
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

export default ProfilePage;
