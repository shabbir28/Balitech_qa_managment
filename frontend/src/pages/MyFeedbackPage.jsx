import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { LoadingPage, EmptyState, Pagination, Badge, ScoreBar } from '../components/ui';
import { MessageSquare, Eye, ThumbsUp, AlertTriangle, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const MyFeedbackPage = () => {
  const [feedback, setFeedback] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const { user } = useAuth();

  const fetchFeedback = async () => {
    try {
      const res = await api.get('/feedback/my-feedback', { params: { page, limit: 10 } });
      setFeedback(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load your feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadDetail = async (id) => {
    try {
      const res = await api.get(`/feedback/${id}`);
      setSelected(res.data.data);
    } catch {
      toast.error('Failed to load feedback details.');
    }
  };

  const handleAcknowledge = async () => {
    if (!selected) return;
    setAcknowledging(true);
    try {
      await api.put(`/feedback/${selected.id}/acknowledge`);
      toast.success('Feedback acknowledged!');
      loadDetail(selected.id);
      fetchFeedback();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to acknowledge.');
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">My Feedback</h1>
        <p className="page-subtitle">Welcome, {user?.name} · QA feedback for your calls</p>
      </div>

      {/* Summary Bar */}
      {!loading && feedback.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Feedback', value: pagination?.total || 0, color: 'text-white' },
            { label: 'Passed', value: feedback.filter(f => f.status === 'Pass').length, color: 'text-emerald-400' },
            { label: 'Failed', value: feedback.filter(f => f.status === 'Fail').length, color: 'text-rose-400' },
            { label: 'Pending ACK', value: feedback.filter(f => f.feedback_status === 'Pending' || f.feedback_status === 'Viewed by Agent').length, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="card p-5 text-center">
              <p className={`text-3xl font-bold mb-1 ${s.color}`}>{s.value}</p>
              <p className="text-sm text-slate-400 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? <LoadingPage /> : feedback.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No feedback yet" description="Your QA feedback will appear here after evaluations." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Campaign</th>
                    <th className="th">QA Score</th>
                    <th className="th">Result</th>
                    <th className="th">Critical Errors</th>
                    <th className="th">Status</th>
                    <th className="th">Date</th>
                    <th className="th">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {feedback.map(fb => (
                    <tr key={fb.id} className={`tr ${fb.status === 'Fail' ? 'bg-rose-500/5' : ''}`}>
                      <td className="td text-slate-300 font-medium">{fb.campaign_name || '—'}</td>
                      <td className="td w-32">
                        <ScoreBar score={parseFloat(fb.qa_score)} />
                      </td>
                      <td className="td"><Badge status={fb.status} /></td>
                      <td className="td">
                        {fb.has_critical_errors ? (
                          <span className="badge-red flex items-center gap-1 w-fit"><AlertTriangle size={11} /> Yes</span>
                        ) : <span className="badge-gray">None</span>}
                      </td>
                      <td className="td">
                        <Badge status={fb.feedback_status} />
                      </td>
                      <td className="td text-slate-400 text-sm">
                        {fb.created_at ? format(new Date(fb.created_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="td">
                        <button onClick={() => loadDetail(fb.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold transition-colors">
                          <Eye size={14} /> View
                        </button>
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">Feedback Detail</h3>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Score overview */}
              <div className={`p-5 rounded-xl border ${selected.status === 'Pass' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-3xl font-bold text-white">{parseFloat(selected.qa_score).toFixed(1)}%</p>
                    <p className="text-sm text-slate-400 font-medium">QA Score</p>
                  </div>
                  <Badge status={selected.status} />
                </div>
              </div>

              {/* Scores breakdown */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-4">Score Breakdown</p>
                <div className="space-y-3">
                  {[
                    ['Opening Script', selected.opening_script_score],
                    ['Verification', selected.verification_score],
                    ['Product Knowledge', selected.product_knowledge_score],
                    ['Compliance', selected.compliance_score],
                    ['Communication', selected.communication_score],
                    ['Closing Script', selected.closing_score],
                    ['Call Handling', selected.call_handling_score],
                  ].filter(([, v]) => v !== undefined).map(([label, score]) => (
                    <div key={label} className="flex items-center gap-4">
                      <span className="text-xs font-medium text-slate-400 w-32 flex-shrink-0">{label}</span>
                      <ScoreBar score={parseFloat(score)} />
                    </div>
                  ))}
                </div>
              </div>

              {selected.critical_errors?.length > 0 && (
                <div className="bg-rose-500/5 rounded-xl p-5 border border-rose-500/20">
                  <p className="text-sm font-semibold text-rose-500 mb-3">⚠️ Critical Errors Found</p>
                  <div className="space-y-2">
                    {selected.critical_errors.map(ce => (
                      <div key={ce.id} className="flex items-center justify-between">
                        <p className="text-sm font-medium text-rose-400">{ce.error_type}</p>
                        <Badge status={ce.severity} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.qa_remarks && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-2">QA Remarks</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{selected.qa_remarks}</p>
                </div>
              )}

              {selected.improvement_suggestions && (
                <div className="bg-amber-500/5 rounded-xl p-5 border border-amber-500/20">
                  <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">💡 Improvement Suggestions</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{selected.improvement_suggestions}</p>
                </div>
              )}

              {selected.coaching_comments?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-white mb-3">Coaching Comments</p>
                  {selected.coaching_comments.map(c => (
                    <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <p className="text-xs text-slate-500 font-medium mb-1">{c.commenter_name}</p>
                      <p className="text-sm text-slate-300">{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Acknowledge Button */}
              {['Pending', 'Viewed by Agent'].includes(selected.feedback_status) && (
                <button
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
                >
                  <ThumbsUp size={18} />
                  {acknowledging ? 'Acknowledging...' : 'Acknowledge Feedback'}
                </button>
              )}
              {selected.feedback_status === 'Acknowledged by Agent' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 justify-center">
                  ✓ You acknowledged this feedback on {selected.acknowledged_at ? format(new Date(selected.acknowledged_at), 'MMM d, yyyy') : 'N/A'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyFeedbackPage;
