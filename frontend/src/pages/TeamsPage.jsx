import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Users, Plus, Trash2, UserPlus, X, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

/* ─── Create User Modal ────────────────────────────────────────────── */
const CreateUserModal = ({ roles, onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '', department: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.role_id)
      return toast.error('All fields required.');
    setLoading(true);
    try {
      const res = await api.post('/teams/create-user', form);
      toast.success('User created!');
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Create New User</h2>
            <p className="text-sm text-slate-400 mt-1">User will login with these credentials</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" placeholder="John Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" placeholder="QA Dept" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="user@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input className="input pr-10" type={show ? 'text' : 'password'} placeholder="Min 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
              <option value="">— Select role —</option>
              {roles.filter(r => !['Manager'].includes(r.name)).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Add Member Modal ─────────────────────────────────────────────── */
const AddMemberModal = ({ teamId, onClose, onAdded }) => {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/teams/members/available').then(r => setUsers(r.data.data)).catch(() => {});
  }, []);

  const submit = async () => {
    if (!selected) return toast.error('Select a user.');
    setLoading(true);
    try {
      await api.post(`/teams/${teamId}/members`, { user_id: selected });
      toast.success('Member added!');
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">Add Member to Team</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <select className="input" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">— Select user —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role}) — {u.email}</option>
            ))}
          </select>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submit} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Team Card ────────────────────────────────────────────────────── */
const TeamCard = ({ team, onDeleted }) => {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);

  const loadMembers = useCallback(async () => {
    const r = await api.get(`/teams/${team.id}/members`);
    setMembers(r.data.data);
  }, [team.id]);

  useEffect(() => {
    if (expanded) {
      loadMembers();
    }
  }, [expanded, loadMembers]);

  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.delete(`/teams/${team.id}/members/${userId}`);
      toast.success('Member removed.');
      loadMembers();
    } catch { toast.error('Failed.'); }
  };

  const deleteTeam = async () => {
    if (!window.confirm(`Delete team "${team.name}"?`)) return;
    try {
      await api.delete(`/teams/${team.id}`);
      toast.success('Team deleted.');
      onDeleted();
    } catch { toast.error('Failed.'); }
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-white text-base">{team.name}</p>
              <p className="text-xs text-slate-400 font-medium">{team.member_count} members</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setExpanded(e => !e); }} className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={deleteTeam} className="p-2 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {team.description && <p className="text-xs text-slate-500 mt-2">{team.description}</p>}
      </div>

      {expanded && (
        <div className="border-t border-slate-800 px-6 pb-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Members</p>
            <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-all">
              <UserPlus className="w-3.5 h-3.5" /> Add Member
            </button>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No members yet. Add members to this team.</p>
          ) : (
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{m.email} · <span className="text-emerald-400">{m.role}</span></p>
                  </div>
                  <button onClick={() => removeMember(m.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddMember && (
        <AddMemberModal teamId={team.id} onClose={() => setShowAddMember(false)} onAdded={loadMembers} />
      )}
    </div>
  );
};

/* ─── Main Page ────────────────────────────────────────────────────── */
const TeamsPage = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  
  const fetchTeams = useCallback(async () => {
    try {
      const [teamsRes, rolesRes] = await Promise.all([api.get('/teams'), api.get('/roles')]);
      setTeams(teamsRes.data.data);
      setRoles(rolesRes.data.data);
    } catch { toast.error('Failed to load teams.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Team name is required.');
    try {
      await api.post('/teams', form);
      toast.success('Team created!');
      setForm({ name: '', description: '' });
      setShowCreate(false);
      fetchTeams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create team.');
    }
  };

  return (
    <div>
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Team Management</h1>
          <p className="page-subtitle">Create teams, manage members and QA user accounts</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCreateUser(true)} className="btn-secondary">
            <UserPlus size={15} /> New User Account
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={15} /> New Team
          </button>
        </div>
      </div>

      {/* Create Team Form */}
      {showCreate && (
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create New Team</h3>
          <form onSubmit={createTeam} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Team Name *</label>
                <input className="input" placeholder="e.g. ACA QA Squad" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="Optional description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create Team</button>
            </div>
          </form>
        </div>
      )}

      {/* Teams Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-white font-bold mb-1">No teams yet</p>
          <p className="text-slate-500 text-sm">Create your first team to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teams.map(t => (
            <TeamCard key={t.id} team={t} onDeleted={fetchTeams} />
          ))}
        </div>
      )}

      {showCreateUser && (
        <CreateUserModal roles={roles} onClose={() => setShowCreateUser(false)} onCreated={fetchTeams} />
      )}
    </div>
  );
};

export default TeamsPage;
