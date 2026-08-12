import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import {
  ListChecks,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  X,
  Search,
  Check,
  Hash,
  Activity,
  User,
  ChevronRight,
  Layers
} from 'lucide-react';
import { format } from 'date-fns';

/* ── Status Badge ─────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const normalized = status?.toLowerCase() || 'pending';
  const map = {
    pending: { icon: Clock, cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400', label: 'Pending' },
    accepted: { icon: CheckCircle2, cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', label: 'Accepted' },
    rejected: { icon: XCircle, cls: 'bg-rose-500/10 border-rose-500/30 text-rose-400', label: 'Rejected' },
    'coaching required': { icon: AlertTriangle, cls: 'bg-orange-500/10 border-orange-500/30 text-orange-400', label: 'Coaching' },
    invalid: { icon: XCircle, cls: 'bg-slate-500/10 border-slate-500/30 text-slate-400', label: 'Invalid' },
  };
  const m = map[normalized] || map.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${m.cls}`}>
      <Icon className="w-3 h-3" />{m.label}
    </span>
  );
};

/* ── Evaluate Modal ────────────────────────────────────────────────── */
const EvaluateModal = ({ transfer, onClose, onRefresh }) => {
  const navigate = useNavigate();
  const [qaStatus, setQaStatus] = useState(transfer.qa_status || transfer.status || 'Pending');
  const [qaScore, setQaScore] = useState(transfer.qa_score || '');
  const [qaNotes, setQaNotes] = useState(transfer.qa_notes || '');
  const [submitting, setSubmitting] = useState(false);

  const [dialerLoading, setDialerLoading] = useState(false);
  const [dialerError, setDialerError] = useState(null);
  const [dialerLeads, setDialerLeads] = useState([]);
  const [dialerType, setDialerType] = useState('pharmacy');

  useEffect(() => {
    const fetchDialerData = async () => {
      const phone = transfer.phone_number || transfer.phoneNumber || transfer.customer_number;
      if (!phone) {
        setDialerError("No phone number available to search.");
        return;
      }
      
      setDialerLoading(true);
      try {
        const searchRes = await api.get(`/dialer/search?phone=${encodeURIComponent(phone)}&dialer=${encodeURIComponent(dialerType)}`);
        if (searchRes.data.success && searchRes.data.data.leads && searchRes.data.data.leads.length > 0) {
          setDialerLeads(searchRes.data.data.leads);
        } else {
          setDialerError("No lead found in Dialer for this number.");
        }
      } catch (err) {
        setDialerError(err.response?.data?.message || "Failed to fetch from Dialer.");
      } finally {
        setDialerLoading(false);
      }
    };
    
    fetchDialerData();
  }, [transfer, dialerType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (qaStatus === 'Pending') {
      toast.error('Please select a QA Status other than Pending.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/transfer-qa/update-status', {
        transfer_id: transfer.transfer_id,
        qa_status: qaStatus,
        qa_score: qaScore,
        qa_notes: qaNotes
      });
      toast.success('Evaluation submitted successfully!');
      onRefresh();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500" />
        
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-indigo-400" />
              Evaluate Transfer
            </h3>
            <p className="text-sm text-slate-400 mt-1 font-mono">{transfer.transfer_id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Transfer Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Agent Name</p>
              <p className="text-sm text-white font-semibold">{transfer.hrms_real_name || transfer.agentName || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Pseudo</p>
              <p className="text-sm text-white font-semibold">{transfer.pseudo || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">First Name</p>
              <p className="text-sm text-white font-semibold">{transfer.customer_first_name || transfer.firstName || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Last Name</p>
              <p className="text-sm text-white font-semibold">{transfer.customer_last_name || transfer.lastName || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Phone</p>
              <p className="text-sm text-white font-mono">{transfer.phone_number || transfer.phoneNumber || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Line</p>
              <p className="text-sm text-white">{transfer.line || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Team</p>
              <p className="text-sm text-white">{transfer.team || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">State</p>
              <p className="text-sm text-white">{transfer.state || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Zipcode</p>
              <p className="text-sm text-white">{transfer.zipcode || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Age</p>
              <p className="text-sm text-white">{transfer.age || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Date</p>
              <p className="text-sm text-white">{(transfer.created_at || transfer.createdAt) ? format(new Date(transfer.created_at || transfer.createdAt), 'MMM d, yyyy HH:mm') : '—'}</p>
            </div>
          </div>

          {/* Dialer Leads Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-emerald-400" />
                Search Results
              </h4>
              <div className="flex items-center gap-3">
                <select
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                  value={dialerType}
                  onChange={(e) => setDialerType(e.target.value)}
                >
                  <option value="pharmacy">Pharmacy Dialer</option>
                  <option value="medicare">Medicare Dialer</option>
                </select>
                {dialerLeads.length > 0 && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                    {dialerLeads.length} Found
                  </span>
                )}
              </div>
            </div>

            {dialerLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                Searching for leads...
              </div>
            ) : dialerError ? (
              <div className="p-6">
                <div className="text-xs text-amber-400 flex items-center gap-2 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5" /> {dialerError}
                </div>
              </div>
            ) : dialerLeads.length > 0 ? (
              <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-sm z-10">
                    <tr className="border-b border-slate-800">
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead ID</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">List ID</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Agent</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Call</th>
                      <th className="py-3 px-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {dialerLeads.map((lead) => (
                      <tr 
                        key={lead.lead_id} 
                        className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                        onClick={() => navigate(`/dialer/lead/${lead.lead_id}?dialer=${encodeURIComponent(dialerType)}&agent_name=${encodeURIComponent(transfer.hrms_real_name || transfer.agentName || '')}&team=${encodeURIComponent(transfer.team || '')}`)}
                      >
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 font-mono text-xs border border-indigo-500/20">
                            {lead.lead_id}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs font-medium text-slate-200">{lead.name || '—'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-full border text-[10px] ${
                            lead.status === 'CALLBK' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                            lead.status === 'SALE'   ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                            lead.status === 'DNC'    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                            'text-slate-400 bg-slate-800/50 border-slate-700'
                          }`}>
                            <Activity className="w-2.5 h-2.5" />
                            {lead.status || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs font-medium text-slate-200 font-mono">{lead.phone}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-slate-400">{lead.list_id}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                              <User className="w-2.5 h-2.5 text-slate-400" />
                            </div>
                            <span className="text-xs text-slate-300">{lead.last_agent || '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] text-slate-500">{lead.last_call ? new Date(lead.last_call).toLocaleString() : '—'}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex p-1.5 text-slate-500 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 rounded-md transition-all">
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-slate-500" />
                </div>
                <h3 className="text-sm font-semibold text-slate-300">No leads found</h3>
                <p className="text-slate-500 text-xs mt-1">We couldn't find any leads matching that phone number.</p>
              </div>
            )}
          </div>

          <form id="evaluation-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">QA Status <span className="text-rose-500">*</span></label>
              <select 
                className="input"
                value={qaStatus}
                onChange={(e) => setQaStatus(e.target.value)}
                required
              >
                <option value="Pending">Pending</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Coaching Required">Coaching Required</option>
                <option value="Invalid">Invalid</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">QA Score (Optional)</label>
              <input 
                type="number" 
                className="input" 
                placeholder="e.g. 95" 
                value={qaScore}
                onChange={(e) => setQaScore(e.target.value)}
                min="0" max="100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">QA Notes (Optional)</label>
              <textarea 
                className="input min-h-[100px] resize-y" 
                placeholder="Add evaluation remarks..."
                value={qaNotes}
                onChange={(e) => setQaNotes(e.target.value)}
              ></textarea>
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-slate-800 shrink-0 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" form="evaluation-form" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? (
              <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Submitting...</>
            ) : (
              <><Check size={16} /> Submit Evaluation</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Main Page ────────────────────────────────────────────────────── */
const TransferQAPage = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  const [qaAgents, setQaAgents] = useState([]);
  const [assigning, setAssigning] = useState(null);
  
  const [bulkQuantity, setBulkQuantity] = useState(10);
  const [bulkAgent, setBulkAgent] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const { hasRole } = useAuth();

  useEffect(() => {
    if (hasRole('Super Admin', 'QA Admin')) {
      api.get('/teams/members/available')
        .then(res => setQaAgents(res.data.data || []))
        .catch(err => console.error('Failed to load QA agents:', err));
    }
  }, [hasRole]);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/transfer-qa/${activeTab}`);
      setTransfers(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch transfers.');
      // Keep transfers empty if there's an error
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  if (!hasRole('Super Admin', 'QA Admin', 'QA Agent')) {
    return <div className="p-10 text-center text-slate-500">You do not have access to this page.</div>;
  }

  // Derived groups
  const filteredTransfers = transfers.filter(t => {
    // Determine category based on qa_status
    let category;
    const status = (t.qa_status || t.status)?.toLowerCase();
    if (status === 'accepted') category = 'reviewed';
    else if (status === 'rejected' || status === 'coaching required' || status === 'invalid') category = 'rejected';
    else category = 'pending';

    if (activeTab !== category) return false;

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      return (
        t.transfer_id?.toLowerCase().includes(query) ||
        (t.hrms_real_name || t.agentName || '')?.toLowerCase().includes(query) ||
        (t.pseudo || '')?.toLowerCase().includes(query) ||
        (t.customer_first_name || t.firstName || '')?.toLowerCase().includes(query) ||
        (t.customer_last_name || t.lastName || '')?.toLowerCase().includes(query) ||
        (t.phone_number || t.phoneNumber || '')?.toLowerCase().includes(query) ||
        t.line?.toLowerCase().includes(query) ||
        t.team?.toLowerCase().includes(query) ||
        t.state?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleBulkAssign = async () => {
    if (!bulkAgent || bulkQuantity <= 0) {
      toast.error('Please select an agent and a valid quantity.');
      return;
    }

    // Get unassigned transfers from the currently filtered list
    const unassignedTransfers = filteredTransfers.filter(t => !t.assigned_to);
    if (unassignedTransfers.length === 0) {
      toast.error('No unassigned transfers available in the current view.');
      return;
    }

    const transfersToAssign = unassignedTransfers.slice(0, bulkQuantity);
    const transferIds = transfersToAssign.map(t => t.transfer_id);

    setBulkAssigning(true);
    try {
      const res = await api.post('/transfer-qa/assign-batch', {
        transfer_ids: transferIds,
        assigned_to: bulkAgent
      });
      toast.success(res.data.message || `${transferIds.length} transfers assigned successfully!`);
      setBulkAgent('');
      fetchTransfers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to bulk assign transfers');
    } finally {
      setBulkAssigning(false);
    }
  };

  const tabs = [
    { id: 'pending', label: 'Pending QA' },
    { id: 'reviewed', label: 'Reviewed (Accepted)' },
    { id: 'rejected', label: 'Rejected / Coaching' }
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-3">
            <ListChecks className="w-3 h-3" /> External Integration
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Transfer QA Module</h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">Evaluate HRMS transfer calls originating from external apps.</p>
        </div>
        <button onClick={fetchTransfers} disabled={loading} className="btn-ghost">
          Refresh Data
        </button>
      </div>

      {/* ── Tabs & Search ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d1117] p-2 rounded-2xl border border-white/5">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
            placeholder="Search transfers..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── PROFESSIONAL BULK ASSIGN PANEL ── */}
      {hasRole('Super Admin', 'QA Admin') && activeTab === 'pending' && (
        <div className="bg-[#0f141f] border border-white/5 rounded-xl shadow-lg mb-6 overflow-hidden">
          {/* Subtle accent bar at top */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-indigo-600"></div>
          
          <div className="p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Left side: Header */}
            <div className="flex items-start gap-4 w-full md:w-auto">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">Bulk Assign Leads</h2>
                <p className="text-sm text-slate-400 mt-0.5">Assign multiple pending transfers to a QA Agent in one click.</p>
              </div>
            </div>

            {/* Right side: Form Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              
              {/* Quantity Input */}
              <div className="flex flex-col w-full sm:w-28">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Quantity</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="number" 
                    min="1"
                    max="1000"
                    value={bulkQuantity}
                    onChange={(e) => setBulkQuantity(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg h-10 pl-9 pr-3 text-sm text-slate-200 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Agent Select */}
              <div className="flex flex-col w-full sm:w-56">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Assign To</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg h-10 pl-9 pr-8 text-sm text-slate-200 outline-none appearance-none transition-all cursor-pointer"
                    value={bulkAgent}
                    onChange={(e) => setBulkAgent(e.target.value)}
                  >
                    <option value="" className="text-slate-500">Select an Agent...</option>
                    {qaAgents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex flex-col w-full sm:w-auto self-end mt-4 sm:mt-0">
                <button 
                  onClick={handleBulkAssign}
                  disabled={bulkAssigning || !bulkAgent || bulkQuantity <= 0}
                  className="h-10 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {bulkAssigning ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing</>
                  ) : (
                    'Assign Leads'
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Data Table ─────────────────────────────────────── */}
      <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Syncing Google Sheets...</p>
            </div>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="py-20">
            <EmptyState 
              icon={ListChecks} 
              title="No transfers found" 
              description={`There are no transfers matching the '${tabs.find(t => t.id === activeTab).label}' status or your search.`} 
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Transfer ID</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Date</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Agent Name</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Pseudo</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Phone Number</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Line</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Team</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">State</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">First Name</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Last Name</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Zipcode</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Age</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Status</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Assigned To</th>
                  <th className="py-4 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredTransfers.map((t, idx) => (
                  <tr key={t.transfer_id || idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-5 text-xs font-mono font-bold text-indigo-400">{t.transfer_id}</td>
                    <td className="py-4 px-5 text-xs text-slate-400 font-medium">
                      {(t.created_at || t.createdAt) ? format(new Date(t.created_at || t.createdAt), 'MMM d, yyyy HH:mm') : '—'}
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-200 font-semibold">{t.hrms_real_name || t.agentName || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-200 font-semibold">{t.pseudo || '—'}</td>
                    <td className="py-4 px-5 text-xs font-mono font-bold text-slate-300">{t.phone_number || t.phoneNumber || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-300">{t.line || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-300">{t.team || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-300">{t.state || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-300">{t.customer_first_name || t.firstName || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-300">{t.customer_last_name || t.lastName || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-300">{t.zipcode || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-300">{t.age || '—'}</td>
                    <td className="py-4 px-5">
                      <StatusBadge status={t.qa_status || t.status} />
                    </td>
                    <td className="py-4 px-5">
                      {hasRole('Super Admin', 'QA Admin') ? (
                        <div className="flex items-center gap-2">
                          <select 
                            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
                            value={t.assigned_to || ''}
                            onChange={async (e) => {
                              const newAssignee = e.target.value;
                              if (!newAssignee) return;
                              setAssigning(t.transfer_id);
                              try {
                                await api.post('/transfer-qa/assign', {
                                  transfer_id: t.transfer_id,
                                  assigned_to: newAssignee
                                });
                                toast.success('Transfer assigned successfully');
                                fetchTransfers();
                              } catch (err) {
                                toast.error(err.response?.data?.message || 'Failed to assign transfer');
                              } finally {
                                setAssigning(null);
                              }
                            }}
                            disabled={assigning === t.transfer_id}
                          >
                            <option value="">Unassigned</option>
                            {qaAgents.map(agent => (
                              <option key={agent.id} value={agent.id}>{agent.name}</option>
                            ))}
                          </select>
                          {assigning === t.transfer_id && <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          {t.assigned_to_name || 'Unassigned'}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      {(t.qa_status || t.status)?.toLowerCase() === 'pending' || !(t.qa_status || t.status) ? (
                        <button 
                          onClick={() => setSelectedTransfer(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                        >
                          <ListChecks className="w-3.5 h-3.5" /> Evaluate
                        </button>
                      ) : (
                        <button 
                          onClick={() => setSelectedTransfer(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTransfer && (
        <EvaluateModal 
          transfer={selectedTransfer} 
          onClose={() => setSelectedTransfer(null)}
          onRefresh={fetchTransfers}
        />
      )}
    </div>
  );
};

export default TransferQAPage;
