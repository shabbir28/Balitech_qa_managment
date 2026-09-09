import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LoadingPage, Pagination, ConfirmModal } from '../components/ui';
import PasswordInput, { isPasswordValid } from '../components/common/PasswordInput';
import {
  Users, Search, Edit2, Trash2, X, Save, Key, ClipboardList, Clock,
  CheckCircle, XCircle, Play, Pause, Volume2, SkipBack, SkipForward, Shield,
  UserPlus, User, Mail, Phone as PhoneIcon, Activity,
  RefreshCw, ChevronDown, Target, ShieldCheck, Crown, Headset, UserCog, BadgeCheck
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

/* ─── Helpers ───────────────────────────────────────────────────────── */

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600', 'from-sky-500 to-blue-600', 'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-indigo-500 to-blue-600',
];

const getInitials = (name) =>
  name ? name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

// Stable colour per user so avatars do not reshuffle between pages / searches.
const avatarFor = (user) => AVATAR_GRADIENTS[(user?.id || 0) % AVATAR_GRADIENTS.length];

const ROLE_STYLES = {
  'Super Admin': { icon: Crown,       chip: 'bg-purple-500/15 text-purple-300 border-purple-500/30', dot: 'bg-purple-400' },
  'QA Admin':    { icon: ShieldCheck, chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', dot: 'bg-indigo-400' },
  'Manager':     { icon: UserCog,     chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',    dot: 'bg-amber-400' },
  'QA Agent':    { icon: Headset,     chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',          dot: 'bg-sky-400' },
};
const roleStyle = (role) => ROLE_STYLES[role] || { icon: Shield, chip: 'bg-slate-800 text-slate-300 border-slate-700', dot: 'bg-slate-400' };

const RoleBadge = ({ role, size = 'sm' }) => {
  const { icon: Icon, chip } = roleStyle(role);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border font-bold ${chip} ${size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {role || 'Member'}
    </span>
  );
};

const Field = ({ label, hint, children, required, className = '' }) => (
  <div className={className}>
    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
      {label}{required && <span className="text-rose-400 ml-1">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">{hint}</p>}
  </div>
);

const inputCls = 'w-full h-11 rounded-xl border border-slate-800 bg-[#0D111D] px-4 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed';
const iconInputCls = `${inputCls} pl-10`;

const SelectField = ({ value, onChange, children, ...rest }) => (
  <div className="relative">
    <select {...rest} value={value} onChange={onChange} className={`${inputCls} appearance-none cursor-pointer pr-10`}>
      {children}
    </select>
    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
  </div>
);

/* ─── Mini Audio Player Modal ───────────────────────────────────────── */
const AudioModal = ({ url, phone, onClose }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  const fmt = (s) => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
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
              <p className="text-sm text-slate-400 font-medium mt-0.5 font-mono">{phone}</p>
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
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * (dur || 0); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }}>
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

/* ─── Page ──────────────────────────────────────────────────────────── */
const EMPTY_FORM = { name: '', email: '', password: '', role_id: 2, phone: '', campaign_id: '' };
const PAGE_SIZE = 20;

const UserManagementPage = () => {
  const { hasRole } = useAuth();
  const canManageUsers = hasRole('Super Admin');

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, byRole: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [resetting, setResetting] = useState(false);

  const [selectedUserActivity, setSelectedUserActivity] = useState(null);
  const [userAssignments, setUserAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [audioAssignment, setAudioAssignment] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, roleFilter]);

  // Lookups + headline stats; the stats call covers up to 100 members (the API cap).
  const fetchLookups = useCallback(async () => {
    try {
      const [rolesRes, campaignsRes, allRes] = await Promise.all([
        api.get('/roles'),
        api.get('/campaigns'),
        api.get('/users', { params: { page: 1, limit: 100 } }),
      ]);
      setRoles(rolesRes.data.data || []);
      setCampaigns(campaignsRes.data.data || []);
      const all = allRes.data.data || [];
      const byRole = {};
      all.forEach((u) => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
      setStats({
        total: allRes.data.pagination?.total ?? all.length,
        active: all.filter((u) => u.is_active).length,
        byRole,
      });
    } catch {
      /* non-fatal: table still loads */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const params = { page, limit: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter) params.role_id = roleFilter;
      const res = await api.get('/users', { params });
      setUsers(res.data.data || []);
      setPagination(res.data.pagination || null);
    } catch {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter]);

  useEffect(() => { fetchLookups(); }, [fetchLookups]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchUsers(), fetchLookups()]);
    setRefreshing(false);
  };

  /* ── Create / edit ── */
  const openCreate = () => { setForm(EMPTY_FORM); setEditUser(null); setShowForm(true); };
  const openEdit = (user) => {
    setForm({ name: user.name, email: user.email, password: '', role_id: user.role_id, phone: user.phone || '', campaign_id: user.campaign_id || '' });
    setEditUser(user);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editUser && !isPasswordValid(form.password)) {
      toast.error('Password must be at least 8 characters and contain a letter and a number.');
      return;
    }
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, { name: form.name, role_id: form.role_id, phone: form.phone, campaign_id: form.campaign_id || null });
        toast.success('Member updated.');
      } else {
        await api.post('/auth/register', { ...form, campaign_id: form.campaign_id || null });
        toast.success('Member created.');
      }
      setShowForm(false);
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${deleteId}`);
      toast.success('Member removed.');
      setDeleteId(null);
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    }
  };

  const handleResetPw = async () => {
    if (!isPasswordValid(newPw)) {
      toast.error('Password must be at least 8 characters and contain a letter and a number.');
      return;
    }
    setResetting(true);
    try {
      await api.put(`/users/${resetUser.id}/reset-password`, { new_password: newPw });
      toast.success(`Password reset for ${resetUser.name}.`);
      setResetUser(null);
      setNewPw('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password reset failed.');
    } finally {
      setResetting(false);
    }
  };

  /* ── Activity ── */
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

  const actStats = useMemo(() => ({
    total: userAssignments.length,
    pending: userAssignments.filter((a) => a.status === 'pending').length,
    accepted: userAssignments.filter((a) => a.status === 'accepted').length,
    rejected: userAssignments.filter((a) => a.status === 'rejected').length,
  }), [userAssignments]);

  const selectedRoleName = roles.find((r) => String(r.id) === String(form.role_id))?.name;
  const selectedCampaignName = campaigns.find((c) => String(c.id) === String(form.campaign_id))?.name;
  const previewUser = editUser || { id: 0 };

  const lastSeen = (u) => {
    if (!u.last_login) return 'Never signed in';
    try { return `Active ${formatDistanceToNow(new Date(u.last_login), { addSuffix: true })}`; } catch { return '—'; }
  };

  return (
    <div className="space-y-6 pb-10 max-w-[1440px] mx-auto font-sans">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-indigo-500/40 bg-indigo-500/5 text-indigo-400 text-[10px] font-bold tracking-wider uppercase mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Team Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">My Team</h1>
          <p className="text-slate-400 text-sm mt-1">Manage members, roles, campaign access and activity.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="h-10 px-3.5 rounded-xl bg-[#0D111D] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {canManageUsers && (
            <button
              onClick={openCreate}
              className="h-10 flex items-center gap-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              <UserPlus className="w-4 h-4" />
              Add Member
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Members</p>
            <p className="text-2xl font-black text-white leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
            <BadgeCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active</p>
            <p className="text-2xl font-black text-emerald-400 leading-tight">{stats.active}</p>
          </div>
        </div>
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
            <Headset className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">QA Agents</p>
            <p className="text-2xl font-black text-sky-300 leading-tight">{stats.byRole['QA Agent'] || 0}</p>
          </div>
        </div>
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
            <UserCog className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Admins & Managers</p>
            <p className="text-2xl font-black text-amber-300 leading-tight">
              {(stats.byRole['Super Admin'] || 0) + (stats.byRole['QA Admin'] || 0) + (stats.byRole['Manager'] || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="w-full h-10 bg-[#0A0E18] border border-slate-800 text-slate-200 pl-10 pr-9 rounded-xl outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all text-sm placeholder:text-slate-600 font-medium"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Clear search">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setRoleFilter('')}
            className={`h-8 px-3 rounded-lg text-xs font-bold border transition-all ${!roleFilter ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#0A0E18] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
          >
            All
          </button>
          {roles.map((r) => {
            const { icon: Icon } = roleStyle(r.name);
            const active = String(roleFilter) === String(r.id);
            return (
              <button
                key={r.id}
                onClick={() => setRoleFilter(active ? '' : r.id)}
                className={`h-8 px-3 rounded-lg text-xs font-bold border transition-all inline-flex items-center gap-1.5 ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#0A0E18] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {r.name}
                {stats.byRole[r.name] != null && (
                  <span className={`px-1.5 rounded text-[10px] font-mono ${active ? 'bg-white/20' : 'bg-slate-800'}`}>{stats.byRole[r.name]}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="lg:ml-auto text-xs text-slate-500 font-medium whitespace-nowrap">
          {pagination ? <>Showing <span className="text-slate-300">{users.length}</span> of <span className="text-slate-300">{pagination.total}</span></> : null}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        {loading ? <div className="py-16"><LoadingPage /></div> : users.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-indigo-400/50" />
            </div>
            <p className="text-white font-bold text-sm">No team members found</p>
            <p className="text-slate-500 text-xs mt-1">Try a different search or role filter{canManageUsers ? ', or add a new member.' : '.'}</p>
            {canManageUsers && (
              <button onClick={openCreate} className="mt-5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" /> Add Member
              </button>
            )}
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
                  {users.map((user) => (
                    <tr key={user.id} className="group hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white bg-gradient-to-br shrink-0 shadow-lg ${avatarFor(user)}`}>
                            {getInitials(user.name)}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0D111D] ${user.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors truncate">{user.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">#{user.id} · {lastSeen(user)}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <a href={`mailto:${user.email}`} className="flex items-center gap-1.5 text-slate-300 hover:text-indigo-300 text-xs font-medium transition-colors">
                            <Mail className="w-3 h-3 text-slate-500 shrink-0" /> <span className="truncate max-w-[220px]">{user.email}</span>
                          </a>
                          {user.phone ? (
                            <span className="flex items-center gap-1.5 text-slate-400 text-xs font-medium font-mono">
                              <PhoneIcon className="w-3 h-3 text-slate-500 shrink-0" /> {user.phone}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-slate-600 text-xs italic">
                              <PhoneIcon className="w-3 h-3 shrink-0" /> No phone
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5"><RoleBadge role={user.role} /></td>

                      <td className="px-5 py-3.5">
                        {user.campaign_name ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold">
                            <Target className="w-3 h-3" /> {user.campaign_name}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">All campaigns</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          user.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' : 'bg-slate-500'}`} />
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openActivity(user)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/15 transition-all" title="View activity">
                            <Activity className="w-4 h-4" />
                          </button>
                          {canManageUsers && (
                            <>
                              <button onClick={() => openEdit(user)} className="p-2 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-all" title="Edit member">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setResetUser(user); setNewPw(''); }} className="p-2 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/15 transition-all" title="Reset password">
                                <Key className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteId(user.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-all" title="Remove member">
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
            {pagination && pagination.pages > 1 && <Pagination pagination={pagination} onPageChange={setPage} />}
          </>
        )}
      </div>

      {/* ── Activity drawer ── */}
      {selectedUserActivity && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-[#0D111D] border border-slate-700/60 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white bg-gradient-to-br shrink-0 ${avatarFor(selectedUserActivity)}`}>
                  {getInitials(selectedUserActivity.name)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedUserActivity.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Assignment activity log</p>
                </div>
              </div>
              <button onClick={() => setSelectedUserActivity(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                    {userAssignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-3 font-mono text-sm font-bold text-white">{a.customer_phone}</td>
                        <td className="px-5 py-3 text-sm text-slate-300">{a.campaign_name}</td>
                        <td className="px-5 py-3 text-sm text-slate-400">{a.assigned_at ? format(new Date(a.assigned_at), 'MMM d, yyyy') : '—'}</td>
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
                            <button onClick={() => setAudioAssignment(a)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-semibold transition-all group">
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

      {/* ── Add / Edit member modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !saving && setShowForm(false)} />
          <form
            onSubmit={handleSave}
            className="bg-[#0D111D] border border-slate-700/60 w-full max-w-3xl max-h-[92vh] relative z-10 rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row"
          >
            {/* Left: live preview */}
            <aside className="lg:w-[260px] shrink-0 bg-gradient-to-b from-indigo-950/60 via-[#0A0E18] to-[#0A0E18] border-b lg:border-b-0 lg:border-r border-slate-800/80 p-6 flex flex-col">
              <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-6">
                {editUser ? <Edit2 className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {editUser ? 'Edit Member' : 'New Member'}
              </div>

              <div className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white bg-gradient-to-br shadow-xl ring-4 ring-[#0D111D] ${avatarFor(previewUser)}`}>
                  {getInitials(form.name) || <User className="w-8 h-8 opacity-70" />}
                </div>
                <p className="mt-4 text-base font-bold text-white truncate max-w-full">{form.name || 'Member name'}</p>
                <p className="text-xs text-slate-500 truncate max-w-full mt-0.5">{form.email || 'email@domain.com'}</p>
                <div className="mt-4"><RoleBadge role={selectedRoleName} size="md" /></div>
              </div>

              <dl className="mt-6 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <Target className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Campaign access</dt>
                    <dd className="text-slate-300 font-medium truncate">{selectedCampaignName || 'All campaigns'}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <PhoneIcon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone</dt>
                    <dd className="text-slate-300 font-medium font-mono truncate">{form.phone || '—'}</dd>
                  </div>
                </div>
              </dl>

              <p className="mt-auto pt-6 text-[10px] text-slate-600 leading-relaxed hidden lg:block">
                {editUser
                  ? 'Email cannot be changed. Use “Reset password” from the table to change credentials.'
                  : 'The member can sign in immediately with the initial password and change it from their profile.'}
              </p>
            </aside>

            {/* Right: form */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800/80">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">{editUser ? 'Edit Team Member' : 'Add New Member'}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{editUser ? 'Update details and permissions.' : 'Create an account and assign access.'}</p>
                </div>
                <button type="button" onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Personal information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Full name" required>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input className={iconInputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. John Doe" required autoFocus />
                      </div>
                    </Field>
                    <Field label="Phone">
                      <div className="relative">
                        <PhoneIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input className={iconInputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0100" />
                      </div>
                    </Field>
                    <Field label="Email address" required className="md:col-span-2" hint={editUser ? 'Email is the login ID and cannot be changed.' : undefined}>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input className={iconInputCls} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="user@domain.com" required disabled={!!editUser} autoComplete="off" />
                      </div>
                    </Field>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Role & access
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Assigned role" required>
                      <SelectField value={form.role_id} onChange={(e) => setForm((f) => ({ ...f, role_id: parseInt(e.target.value) }))} required>
                        <option value="" disabled>Select a role...</option>
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </SelectField>
                    </Field>
                    <Field label="Campaign filter" hint="Restricts this member to a single campaign.">
                      <SelectField value={form.campaign_id} onChange={(e) => setForm((f) => ({ ...f, campaign_id: e.target.value }))}>
                        <option value="">All campaigns</option>
                        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </SelectField>
                    </Field>
                  </div>
                </section>

                {!editUser && (
                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" /> Account security
                    </h3>
                    <Field label="Initial password" required hint="Temporary password — the member can change it after signing in.">
                      <PasswordInput
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="Minimum 8 characters"
                        showRules
                        accent="rose"
                        required
                      />
                    </Field>
                  </section>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800/80 bg-[#0A0E18]/60">
                <button type="button" onClick={() => setShowForm(false)} className="h-10 px-5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (!editUser && !isPasswordValid(form.password))}
                  className="h-10 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : (editUser ? 'Save changes' : 'Create member')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Reset password modal ── */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-[#0D111D] border border-slate-700/60 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-orange-500" />
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Reset password</h3>
                  <p className="text-xs text-slate-400 mt-0.5">for <span className="text-slate-200 font-semibold">{resetUser.name}</span></p>
                </div>
              </div>
              <button onClick={() => setResetUser(null)} className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <Field label="New password" required>
                <PasswordInput
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Minimum 8 characters"
                  showRules
                  accent="amber"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleResetPw(); }}
                />
              </Field>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-800/80 bg-[#0A0E18]/60">
              <button onClick={() => setResetUser(null)} className="h-10 px-4 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">Cancel</button>
              <button
                onClick={handleResetPw}
                disabled={resetting || !isPasswordValid(newPw)}
                className="h-10 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                Reset password
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Remove team member"
        message="This user will be deactivated and lose access to the system. You can't undo this from here."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />

      {audioAssignment && (
        <AudioModal url={audioAssignment.recording_url} phone={audioAssignment.customer_phone} onClose={() => setAudioAssignment(null)} />
      )}
    </div>
  );
};

export default UserManagementPage;
