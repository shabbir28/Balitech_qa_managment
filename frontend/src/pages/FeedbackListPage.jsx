import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { LoadingPage, EmptyState, Pagination, Badge } from '../components/ui';
import { MessageSquare, Search, Eye, MessageCircle, X, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const FeedbackListPage = () => {
  const [feedback, setFeedback] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { hasRole } = useAuth();

  const fetchFeedback = async () => {
    try {
      const res = await api.get('/feedback', { params: { page, limit: 20, search, ...filters } });
      setFeedback(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filters]);

  const loadDetail = async (id) => {
    try {
      const res = await api.get(`/feedback/${id}`);
      setSelected(res.data.data);
      setSuggestions(res.data.data.improvement_suggestions || '');
      setComment('');
    } catch {
      toast.error('Failed to load feedback details.');
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) { toast.error('Comment cannot be empty.'); return; }
    setSubmitting(true);
    try {
      await api.post(`/feedback/${selected.id}/coaching-comment`, { comment });
      toast.success('Coaching comment added.');
      loadDetail(selected.id);
      setComment('');
      fetchFeedback();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSuggestions = async () => {
    try {
      await api.put(`/feedback/${selected.id}/improvement-suggestions`, { improvement_suggestions: suggestions });
      toast.success('Suggestions saved.');
      fetchFeedback();
    } catch {
      toast.error('Failed to save suggestions.');
    }
  };

  const handleClose = async (id) => {
    try {
      await api.put(`/feedback/${id}/close`);
      toast.success('Feedback closed.');
      fetchFeedback();
      if (selected?.id === id) setSelected(null);
    } catch {
      toast.error('Failed to close feedback.');
    }
  };

  const statusColor = {
    'Pending': 'badge-yellow',
    'Viewed by Agent': 'badge-blue',
    'Acknowledged by Agent': 'badge-green',
    'Coaching Required': 'badge-orange',
    'Closed': 'badge-gray',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Feedback Management</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} total feedback records</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input className="input pl-9" placeholder="Search agent, campaign..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-48" value={filters.status} onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
            <option value="">All Statuses</option>
            {['Pending', 'Viewed by Agent', 'Acknowledged by Agent', 'Coaching Required', 'Closed'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingPage /> : feedback.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No feedback yet" description="Feedback is auto-generated after QA evaluations." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Agent</th>
                    <th className="th">Campaign</th>
                    <th className="th">QA Score</th>
                    <th className="th">Result</th>
                    <th className="th">Feedback Status</th>
                    <th className="th">Critical Errors</th>
                    <th className="th">Date</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {feedback.map(fb => (
                    <tr key={fb.id} className="tr">
                      <td className="td">
                        <p className="font-semibold text-white">{fb.agent_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{fb.agent_id}</p>
                      </td>
                      <td className="td text-slate-300 font-medium">{fb.campaign_name || '—'}</td>
                      <td className="td">
                        <span className={`font-bold ${parseFloat(fb.qa_score) >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {parseFloat(fb.qa_score).toFixed(1)}%
                        </span>
                      </td>
                      <td className="td"><Badge status={fb.status} /></td>
                      <td className="td">
                        <span className={statusColor[fb.feedback_status] || 'badge-gray'}>
                          {fb.feedback_status}
                        </span>
                      </td>
                      <td className="td">
                        {fb.has_critical_errors ? (
                          <span className="badge-red">Yes</span>
                        ) : <span className="badge-gray">None</span>}
                      </td>
                      <td className="td text-slate-400 text-sm">
                        {fb.created_at ? format(new Date(fb.created_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <button onClick={() => loadDetail(fb.id)} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="View">
                            <Eye size={16} />
                          </button>
                          {hasRole('Manager') && fb.feedback_status !== 'Closed' && (
                            <button onClick={() => handleClose(fb.id)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="Close">
                              <CheckCircle size={16} />
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

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">Feedback Details</h3>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Agent', selected.agent_name],
                  ['Campaign', selected.campaign_name || '—'],
                  ['QA Score', `${parseFloat(selected.qa_score).toFixed(1)}%`],
                  ['Status', selected.status],
                  ['Feedback Status', selected.feedback_status],
                  ['Acknowledged', selected.acknowledged_at ? format(new Date(selected.acknowledged_at), 'MMM d, yyyy') : 'Not yet'],
                ].map(([l, v]) => (
                  <div key={l} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">{l}</p>
                    <p className="font-semibold text-slate-200">{v}</p>
                  </div>
                ))}
              </div>

              {selected.qa_remarks && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-2">QA Remarks</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{selected.qa_remarks}</p>
                </div>
              )}

              {selected.critical_errors?.length > 0 && (
                <div className="bg-rose-500/5 rounded-xl p-5 border border-rose-500/20">
                  <p className="text-sm font-semibold text-rose-500 mb-3">Critical Errors</p>
                  <div className="space-y-2">
                    {selected.critical_errors.map(ce => (
                      <div key={ce.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <p className="text-sm text-rose-400 font-medium">{ce.error_type}</p>
                        <Badge status={ce.severity} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvement Suggestions */}
              {hasRole('Manager') && (
                <div>
                  <label className="label">Improvement Suggestions</label>
                  <textarea
                    className="input h-24 resize-none mb-3"
                    value={suggestions}
                    onChange={(e) => setSuggestions(e.target.value)}
                    placeholder="Add improvement suggestions for the agent..."
                  />
                  <button onClick={handleSaveSuggestions} className="btn-secondary text-sm px-4 py-2">Save Suggestions</button>
                </div>
              )}

              {/* Coaching Comments */}
              {selected.coaching_comments?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-white mb-3">Coaching Comments</p>
                  {selected.coaching_comments.map(c => (
                    <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-2 font-medium">{c.commenter_name} · {format(new Date(c.created_at), 'MMM d, yyyy')}</p>
                      <p className="text-sm text-slate-300">{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Coaching Comment */}
              {hasRole('Manager') && (
                <div className="pt-2">
                  <label className="label">Add Coaching Comment</label>
                  <textarea
                    className="input h-24 resize-none mb-3"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Enter coaching feedback..."
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={submitting}
                    className="btn-primary text-sm px-4 py-2"
                  >
                    <MessageCircle size={14} />
                    {submitting ? 'Saving...' : 'Add Comment'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackListPage;
