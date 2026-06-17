import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { LoadingPage, EmptyState, ConfirmModal } from '../components/ui';
import { AlertTriangle, Plus, Edit2, Trash2, X, Save } from 'lucide-react';

const CriticalErrorsPage = () => {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ error_type: '', description: '', severity: 'High' });
  const [saving, setSaving] = useState(false);

  const fetchErrors = async () => {
    try {
      const res = await api.get('/critical-errors');
      setErrors(res.data.data);
    } catch {
      toast.error('Failed to load critical errors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const openCreate = () => { setForm({ error_type: '', description: '', severity: 'High' }); setEditItem(null); setShowForm(true); };
  const openEdit = (err) => { setForm({ error_type: err.error_type, description: err.description || '', severity: err.severity }); setEditItem(err); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.error_type.trim()) { toast.error('Error type is required.'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/critical-errors/${editItem.id}`, form);
        toast.success('Critical error type updated.');
      } else {
        await api.post('/critical-errors', form);
        toast.success('Critical error type created.');
      }
      setShowForm(false);
      fetchErrors();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/critical-errors/${deleteId}`);
      toast.success('Critical error type deactivated.');
      setDeleteId(null);
      fetchErrors();
    } catch {
      toast.error('Delete failed.');
    }
  };

  const severityMap = { Critical: 'badge-red', High: 'badge-orange', Medium: 'badge-yellow', Low: 'badge-blue' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            Critical Error Types
          </h1>
          <p className="page-subtitle">Manage critical error definitions for QA evaluation</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Error Type
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingPage /> : errors.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No error types" description="Add critical error types to use in evaluations." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">#</th>
                  <th className="th">Error Type</th>
                  <th className="th">Description</th>
                  <th className="th">Severity</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {errors.map((err, i) => (
                  <tr key={err.id} className="tr">
                    <td className="td text-slate-500 text-sm font-medium">{i + 1}</td>
                    <td className="td">
                      <p className="font-semibold text-white">{err.error_type}</p>
                    </td>
                    <td className="td text-slate-400 text-sm max-w-xs">
                      <p className="truncate">{err.description || '—'}</p>
                    </td>
                    <td className="td">
                      <span className={severityMap[err.severity] || 'badge-gray'}>{err.severity}</span>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(err)} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => setDeleteId(err.id)} className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all" title="Deactivate">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">{editItem ? 'Edit' : 'Add'} Critical Error Type</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="label">Error Type *</label>
                <input
                  className="input"
                  value={form.error_type}
                  onChange={(e) => setForm(f => ({ ...f, error_type: e.target.value }))}
                  placeholder="e.g. Wrong Information Given"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input h-20 resize-none"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe when this error applies..."
                />
              </div>
              <div>
                <label className="label">Severity</label>
                <select
                  className="input"
                  value={form.severity}
                  onChange={(e) => setForm(f => ({ ...f, severity: e.target.value }))}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Error Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Deactivate Error Type"
        message="This will deactivate the critical error type. It will no longer appear in evaluation forms."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  );
};

export default CriticalErrorsPage;
