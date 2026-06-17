import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { LoadingPage, EmptyState } from '../components/ui';
import { Target, Plus, Search, X } from 'lucide-react';

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', passing_score: 80, client_name: '' });
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data.data);
    } catch {
      toast.error('Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Campaign name is required');
    setSaving(true);
    try {
      await api.post('/campaigns', form);
      toast.success('Campaign created successfully');
      setShowForm(false);
      fetchCampaigns();
    } catch {
      toast.error('Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const filteredCampaigns = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Manage system campaigns and passing criteria</p>
        </div>
        <button onClick={() => { setForm({ name: '', description: '', passing_score: 80, client_name: '' }); setShowForm(true); }} className="btn-primary">
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="card p-5 mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingPage /> : filteredCampaigns.length === 0 ? (
          <EmptyState icon={Target} title="No campaigns found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">Campaign Name</th>
                  <th className="th">Client Name</th>
                  <th className="th">Passing Score</th>
                  <th className="th">Description</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="tbody">
                {filteredCampaigns.map(c => (
                  <tr key={c.id} className="tr">
                    <td className="td font-semibold text-white">{c.name}</td>
                    <td className="td text-slate-300">{c.client_name || '—'}</td>
                    <td className="td text-slate-300">{c.passing_score}%</td>
                    <td className="td text-slate-400 max-w-xs truncate">{c.description || '—'}</td>
                    <td className="td">
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#0B1120]">
              <h2 className="text-lg font-semibold text-white">Create Campaign</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="label">Campaign Name</label>
                <input required className="input" placeholder="e.g. Medicare 2026" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Client Name (Optional)</label>
                <input className="input" placeholder="e.g. Acme Corp" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Passing Score (%)</label>
                <input required type="number" min="0" max="100" className="input" value={form.passing_score} onChange={e => setForm(f => ({ ...f, passing_score: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows="3" placeholder="Brief details..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-colors">
                  {saving ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
