import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Users, Plus, Trash2, UserPlus, X, ChevronDown, ChevronUp, Eye, EyeOff, Shield } from 'lucide-react';

/* ─── Create User Modal ────────────────────────────────────────────── */
const CreateUserModal = ({ roles, campaigns, onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '', campaign_id: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.role_id)
      return toast.error('All fields required.');
    setLoading(true);
    try {
      const payload = { ...form, campaign_id: form.campaign_id || null };
      const res = await api.post('/teams/create-user', payload);
      toast.success('User created!');
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A0F1A]/90" onClick={onClose} />
      
      <div className="bg-[#0D1321] border border-slate-800 w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-10 rounded-lg flex flex-col shadow-2xl">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#0D1321] z-20">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-wide">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              USER PROVISIONING
            </h2>
            <p className="text-sm text-slate-500 mt-1">Configure identity and access parameters for a new system user.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1"><X size={20} /></button>
        </div>

        {/* Modal Body */}
        <form onSubmit={submit} className="p-6 flex-1 flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="flex flex-col gap-6">
              
              {/* Section 1 */}
              <div className="border border-slate-800 rounded-lg p-5 bg-[#111827]">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">1. Identity Parameters</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Full Legal Name</label>
                    <input className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Smith" required />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Primary Email Address</label>
                    <input className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john.smith@domain.com" required />
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div className="border border-slate-800 rounded-lg p-5 bg-[#111827]">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">2. Security Credentials</h3>
                
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Authentication Password</label>
                  <div className="relative">
                    <input className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md py-2.5 pl-3 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono" type={show ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required />
                    <button type="button" onClick={() => setShow(s => !s)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-2">Password must meet standard security policies.</p>
                </div>
              </div>

            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-6">

              {/* Section 3 */}
              <div className="border border-slate-800 rounded-lg p-5 bg-[#111827] h-full flex flex-col">
                <h3 className="text-[10px] font-bold text-indigo-500/70 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Shield size={12} />
                  3. System Access Control
                </h3>
                
                <div className="space-y-6 flex-1">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Assigned Role</label>
                    <select className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md py-2.5 px-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors" value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))} required>
                      <option value="" disabled>— Select active role —</option>
                      {roles.filter(r => !['Manager'].includes(r.name)).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 border-t border-slate-800/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-slate-400 block">Data Isolation (Campaign Filter)</label>
                      <span className="text-[9px] uppercase tracking-wider text-slate-600 border border-slate-800 px-1.5 rounded bg-slate-900">Optional</span>
                    </div>
                    <select className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md py-2.5 px-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors" value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))}>
                      <option value="">— Unrestricted Data Access —</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="mt-3 bg-indigo-500/5 border border-indigo-500/10 rounded p-3">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        If a campaign is selected, this user's view will be <strong className="text-indigo-400 font-semibold">strictly sandboxed</strong> to records originating from that specific campaign source.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Actions */}
          <div className="mt-2 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Abort
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
              {loading ? 'Provisioning...' : 'Deploy User Profile'}
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
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  
  const fetchTeams = useCallback(async () => {
    try {
      const [teamsRes, rolesRes, campaignsRes] = await Promise.all([
        api.get('/teams'),
        api.get('/roles'),
        api.get('/campaigns'),
      ]);
      setTeams(teamsRes.data.data);
      setRoles(rolesRes.data.data);
      setCampaigns(campaignsRes.data.data);
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
        <CreateUserModal roles={roles} campaigns={campaigns} onClose={() => setShowCreateUser(false)} onCreated={fetchTeams} />
      )}
    </div>
  );
};

export default TeamsPage;
