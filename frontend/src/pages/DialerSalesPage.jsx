import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, AlertCircle, Database, Filter, ChevronDown, Calendar, Clock, Ban, UserCheck, X, CheckSquare, Square, Check, Layers, Send, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Status dropdown cell — allows QA to mark as Not a Sale or any other status
function StatusCell({ lead, dialerType, qaOverride, onOverrideChange, statuses = [] }) {
  const [updating, setUpdating] = useState(false);
  const currentValue = qaOverride || lead.status;
  const isNotASale = currentValue === 'NOT_A_SALE';

  const handleChange = async (e) => {
    const newVal = e.target.value;
    const qa_override = newVal === lead.status ? null : newVal;
    setUpdating(true);
    try {
      const res = await api.post('/dialer-sales/override', {
        lead_id: lead.lead_id,
        dialer: dialerType,
        qa_override
      });
      if (res.data.success) {
        onOverrideChange(lead.lead_id, qa_override);
        if (qa_override === 'NOT_A_SALE') {
          toast.success('Marked as Not a Sale');
        } else if (qa_override) {
          toast.success(`Status changed to ${qa_override}`);
        } else {
          toast('Reverted to original status', { icon: '↩️' });
        }
      } else {
        toast.error(res.data.message || 'Failed to update. Make sure data is saved in history first.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not update. Record may not be in history DB yet.');
    } finally {
      setUpdating(false);
    }
  };

  const allOptions = Array.from(new Set([lead.status, ...statuses]));

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {updating ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
      ) : (
        <div className="relative">
          <select
            value={currentValue}
            onChange={handleChange}
            className={`appearance-none text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 pr-5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors ${
              isNotASale
                ? 'bg-red-900/40 text-red-400 border-red-500/30'
                : currentValue !== lead.status
                ? 'bg-amber-900/40 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {allOptions.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
            {!allOptions.includes('NOT_A_SALE') && (
              <option value="NOT_A_SALE">Not a Sale</option>
            )}
          </select>
          <ChevronDown className="w-2.5 h-2.5 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>
      )}
    </div>
  );
}

// QA Status dropdown cell
function QaStatusCell({ lead, dialerType, currentStatus, onStatusChange }) {
  const [updating, setUpdating] = useState(false);

  const handleChange = async (e) => {
    const newVal = e.target.value;
    setUpdating(true);
    try {
      const res = await api.post('/dialer-sales/qa-status', {
        lead_id: lead.lead_id,
        dialer: dialerType,
        qa_status: newVal
      });
      if (res.data.success) {
        onStatusChange(lead.lead_id, newVal);
        toast.success(`QA Status changed to ${newVal}`);
      } else {
        toast.error(res.data.message || 'Failed to update');
      }
    } catch {
      toast.error('Could not update. Record may not be in history DB yet.');
    } finally {
      setUpdating(false);
    }
  };

  const getStyle = () => {
    switch (currentStatus) {
      case 'Accepted':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20';
      case 'Rejected':
        return 'bg-red-950/40 text-red-400 border-red-500/20';
      case 'Flagged':
        return 'bg-amber-950/40 text-amber-400 border-amber-500/20';
      case 'Decline':
        return 'bg-purple-950/40 text-purple-400 border-purple-500/20';
      case 'Not Billable':
        return 'bg-cyan-950/40 text-cyan-400 border-cyan-500/20';
      default: // Pending
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div onClick={e => e.stopPropagation()}>
      {updating ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
      ) : (
        <div className="relative inline-block">
          <select
            value={currentStatus || 'Pending'}
            onChange={handleChange}
            className={`appearance-none text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 pr-5 border cursor-pointer focus:outline-none transition-colors ${getStyle()}`}
          >
            <option value="Pending">Pending</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Flagged">Flagged</option>
            <option value="Decline">Decline</option>
            <option value="Not Billable">Not Billable</option>
          </select>
          <ChevronDown className="w-2.5 h-2.5 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>
      )}
    </div>
  );
}

// ─── AssignLeadsModal ────────────────────────────────────────────────────────
function AssignLeadsModal({ onClose, dialer, selectedLeads = [], onDeselectLead, filteredLeads = [], onComplete }) {
  const [qas, setQas] = useState([]);
  const [selectedQa, setSelectedQa] = useState('');
  const [assignMode, setAssignMode] = useState(selectedLeads.length > 0 ? 'selected' : 'bulk');
  const [qty, setQty] = useState(filteredLeads.length > 5 ? 5 : Math.max(1, filteredLeads.length));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingQas, setLoadingQas] = useState(true);

  // Auto-switch mode if selected leads become empty
  useEffect(() => {
    if (selectedLeads.length === 0 && assignMode === 'selected') {
      setAssignMode('bulk');
    }
  }, [selectedLeads.length, assignMode]);

  useEffect(() => {
    api.get('/teams/members/available')
      .then(res => {
        const list = res.data.data || [];
        setQas(list);
        if (list.length > 0) {
          setSelectedQa(list[0].id);
        }
      })
      .catch(() => {
        // Fallback to /users
        api.get('/users?limit=100').then(res => {
          const list = (res.data.data || []).filter(u => u.role === 'QA Agent' || u.role_id === 2);
          setQas(list);
          if (list.length > 0) setSelectedQa(list[0].id);
        }).catch(() => toast.error('Failed to load QA list.'));
      })
      .finally(() => setLoadingQas(false));
  }, []);

  const leadsToAssign = assignMode === 'selected' 
    ? selectedLeads 
    : filteredLeads.slice(0, qty);

  const selectedQaObj = qas.find(q => String(q.id) === String(selectedQa));

  const handleAssign = async () => {
    if (!selectedQa) { toast.error('Select a QA Agent.'); return; }
    if (leadsToAssign.length === 0) { toast.error('No leads available to assign.'); return; }

    setSubmitting(true);
    try {
      const res = await api.post('/dialer-sales/assign', {
        dialer,
        assigned_to: selectedQa,
        leads: leadsToAssign.map(l => ({
          lead_id: l.lead_id,
          phone: l.phone,
          status: l.status,
          agent: l.agent || l.last_agent || 'Dialer Agent',
          name: l.name || '',
          team: l.team || '',
          sale_date: l.sale_date || l.last_call?.substring(0, 10)
        })),
        notes
      });
      if (res.data.success) {
        toast.success(res.data.message || `${leadsToAssign.length} leads assigned successfully!`);
        onComplete(leadsToAssign.map(l => l.lead_id), selectedQaObj?.name || 'QA Agent');
        onClose();
      } else {
        toast.error(res.data.message || 'Failed to assign leads.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Server error during lead assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Assign Leads to QA Evaluator</h2>
              <p className="text-[11px] text-slate-400">Distribute selected calls for quality evaluation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Mode Selector (if selectedLeads exist) */}
          {selectedLeads.length > 0 && (
            <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setAssignMode('selected')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  assignMode === 'selected'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Selected Leads ({selectedLeads.length})
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('bulk')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  assignMode === 'bulk'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Bulk Quantity
              </button>
            </div>
          )}

          {/* Selected Leads Pills Preview */}
          {assignMode === 'selected' && selectedLeads.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Cherry-picked Numbers ({selectedLeads.length})
                </label>
                <span className="text-[10px] text-slate-500">Click ✕ to remove from batch</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 max-h-36 overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5">
                {selectedLeads.map(l => (
                  <span
                    key={l.lead_id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-[11px] font-mono text-slate-200"
                  >
                    <span className="font-semibold text-emerald-400">{l.phone}</span>
                    <span className="text-slate-500 text-[10px]">({l.lead_id})</span>
                    {onDeselectLead && (
                      <button
                        type="button"
                        onClick={() => onDeselectLead(l.lead_id)}
                        className="text-slate-400 hover:text-red-400 transition-colors ml-0.5"
                        title="Remove from selection"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bulk Quantity Mode */}
          {assignMode === 'bulk' && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Quantity to Assign
                </label>
                <span className="text-[11px] text-slate-500 font-medium">Max: {filteredLeads.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={filteredLeads.length}
                  value={qty}
                  onChange={e => setQty(Math.min(filteredLeads.length, Math.max(1, parseInt(e.target.value) || 0)))}
                  className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <div className="flex gap-1">
                  {[5, 10, 25, 50].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQty(Math.min(filteredLeads.length, n))}
                      className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded text-xs font-semibold cursor-pointer"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* QA Dropdown */}
          <div>
            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Target QA Evaluator
            </label>
            {loadingQas ? (
              <div className="text-xs text-slate-500 animate-pulse">Loading QA team members...</div>
            ) : (
              <div className="relative">
                <select
                  value={selectedQa}
                  onChange={e => setSelectedQa(e.target.value)}
                  className="w-full appearance-none bg-slate-800/80 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 pr-8 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
                >
                  {qas.length === 0 ? (
                    <option value="">No QA Agents found</option>
                  ) : (
                    qas.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.name} ({q.campaign_name || q.role || 'QA Agent'})
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Notes / Instructions (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="E.g., High priority sales, check script & consent..."
              rows="2"
              className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 resize-none"
            />
          </div>

          {/* Summary Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <p className="text-slate-400 font-medium">Ready to assign:</p>
              <p className="text-sm font-bold text-white font-mono mt-0.5">
                {leadsToAssign.length} Lead(s)
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-medium">Evaluator:</p>
              <p className="text-sm font-bold text-emerald-400 mt-0.5">
                {selectedQaObj?.name || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/40 flex gap-2">
          <button
            onClick={handleAssign}
            disabled={submitting || qas.length === 0 || leadsToAssign.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Assigning...' : `Confirm & Assign (${leadsToAssign.length})`}
          </button>
          <button
            onClick={onClose}
            className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg py-2.5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DialerSalesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dialerType, setDialerType] = useState('medicare');

  // Sync dialerType state with user's assigned campaign
  useEffect(() => {
    if (user && user.role === 'QA Agent') {
      const camp = (user.campaign_name || '').toLowerCase();
      if (camp.includes('medicare')) {
        setDialerType('medicare');
      } else if (camp.includes('pharmacy')) {
        setDialerType('pharmacy');
      }
    }
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sales, setSales] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [error, setError] = useState('');
  
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState('All');
  const [agentSearch, setAgentSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('TODAY');
  const [qaMetadata, setQaMetadata] = useState({}); // { lead_id -> { qa_override, qa_status } }
  const [showAssign, setShowAssign] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelectedStatus('All');
    setSelectedTeam('All');
    setAgentSearch('');
    setSelectedLeadIds([]);
    try {
      const res = await api.get(`/dialer-sales?dialer=${encodeURIComponent(dialerType)}&timeFilter=${timeFilter}`);
      if (res.data.success) {
        const leads = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.leads || res.data.data?.sales || []);
        setSales(leads);
        setStatuses(res.data.statuses || []);
        if (leads.length === 0) {
          toast('No sales found for this dialer and time period.', { icon: 'ℹ️' });
        } else {
          // Fetch existing QA overrides & status metadata for these leads
          try {
            const overrideRes = await api.post('/dialer-sales/overrides-by-leads', {
              dialer: dialerType,
              lead_ids: leads.map(l => l.lead_id)
            });
            if (overrideRes.data.success) {
              setQaMetadata(overrideRes.data.data || {});
            }
          } catch { /* non-critical */ }
        }
      } else {
        setError(res.data.message || 'Failed to fetch sales');
      }
    } catch (err) {
      console.error(err);
      setError('Error communicating with the server.');
    } finally {
      setLoading(false);
    }
  }, [dialerType, timeFilter]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/dialer-sales/sync', { dialer: dialerType });
      if (res.data.success) {
        toast.success(`Synced statuses: ${res.data.statuses.join(', ')}`);
        fetchSales();
      } else {
        toast.error('Failed to sync statuses');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error syncing statuses');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const handleOverrideChange = useCallback((lead_id, qa_override) => {
    setQaMetadata(prev => ({
      ...prev,
      [lead_id]: {
        ...(prev[lead_id] || {}),
        qa_override
      }
    }));
  }, []);

  const handleStatusChange = useCallback((lead_id, qa_status) => {
    setQaMetadata(prev => ({
      ...prev,
      [lead_id]: {
        ...(prev[lead_id] || {}),
        qa_status
      }
    }));
  }, []);

  const { filteredSales, statusCounts, teamCounts, totalSales, notASaleCount } = useMemo(() => {
    const sCounts = {};
    const tCounts = {};
    statuses.forEach(s => sCounts[s] = 0);
    let nasc = 0;
    
    sales.forEach(lead => {
      if (sCounts[lead.status] !== undefined) {
        sCounts[lead.status]++;
      } else {
        sCounts[lead.status] = 1;
      }
      const team = lead.team || 'Unknown';
      tCounts[team] = (tCounts[team] || 0) + 1;
      if (qaMetadata[lead.lead_id]?.qa_override === 'NOT_A_SALE') nasc++;
    });

    let finalFiltered = sales;
    if (selectedStatus !== 'All') {
      finalFiltered = finalFiltered.filter(lead => lead.status === selectedStatus);
    }
    if (selectedTeam !== 'All') {
      finalFiltered = finalFiltered.filter(lead => (lead.team || 'Unknown') === selectedTeam);
    }
    if (agentSearch.trim()) {
      const query = agentSearch.trim().toLowerCase();
      finalFiltered = finalFiltered.filter(lead => {
        const agent = String(lead.last_agent || lead.agent || lead.user || '').toLowerCase();
        return agent.includes(query);
      });
    }

    return { 
      filteredSales: finalFiltered, 
      statusCounts: sCounts,
      teamCounts: tCounts,
      totalSales: sales.length,
      notASaleCount: nasc
    };
  }, [sales, statuses, selectedStatus, selectedTeam, agentSearch, qaMetadata]);


  const [quickSelectCount, setQuickSelectCount] = useState(5);

  const unassignedFilteredSales = useMemo(() => {
    return filteredSales.filter(lead => !qaMetadata[lead.lead_id]?.is_assigned);
  }, [filteredSales, qaMetadata]);

  const selectedLeads = useMemo(() => {
    return sales.filter(s => selectedLeadIds.includes(s.lead_id));
  }, [sales, selectedLeadIds]);

  const visibleUnassignedLeadIds = useMemo(() => {
    return unassignedFilteredSales.map(l => l.lead_id);
  }, [unassignedFilteredSales]);

  const allFilteredSelected = visibleUnassignedLeadIds.length > 0 && visibleUnassignedLeadIds.every(id => selectedLeadIds.includes(id));
  const someFilteredSelected = visibleUnassignedLeadIds.some(id => selectedLeadIds.includes(id)) && !allFilteredSelected;

  const handleToggleLead = (leadId, e) => {
    if (e) e.stopPropagation();
    if (qaMetadata[leadId]?.is_assigned) return; // Prevent selecting already assigned lead
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleToggleAll = () => {
    if (allFilteredSelected) {
      setSelectedLeadIds(prev => prev.filter(id => !visibleUnassignedLeadIds.includes(id)));
    } else {
      setSelectedLeadIds(prev => Array.from(new Set([...prev, ...visibleUnassignedLeadIds])));
    }
  };

  const handleQuickSelect = (count) => {
    const num = Math.min(unassignedFilteredSales.length, Math.max(1, count));
    const idsToPick = unassignedFilteredSales.slice(0, num).map(l => l.lead_id);
    if (idsToPick.length > 0) {
      setSelectedLeadIds(prev => {
        const combined = Array.from(new Set([...prev, ...idsToPick]));
        return combined;
      });
      toast.success(`Selected ${idsToPick.length} leads from this view (Total: ${new Set([...selectedLeadIds, ...idsToPick]).size})!`);
    } else {
      toast.error('No unassigned leads available in current view.');
    }
  };

  const handleAssignmentComplete = (assignedIds, qaName) => {
    setQaMetadata(prev => {
      const updated = { ...prev };
      assignedIds.forEach(id => {
        updated[id] = {
          ...(updated[id] || {}),
          is_assigned: true,
          assigned_qa_name: qaName
        };
      });
      return updated;
    });
    setSelectedLeadIds(prev => prev.filter(id => !assignedIds.includes(id)));
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-6">
      
      {/* 
        HEADER SECTION: Compact & Clean
      */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">Dialer Sales</h1>
            <p className="text-slate-400 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Live Tracking ({timeFilter === 'TODAY' ? "Today's Leads" : "Monthly Leads"})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Filter Segmented Control */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => { setTimeFilter('TODAY'); setSelectedStatus('All'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                timeFilter === 'TODAY' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Today
            </button>
            <button
              onClick={() => { setTimeFilter('MONTH'); setSelectedStatus('All'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                timeFilter === 'MONTH' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Monthly
            </button>
          </div>

          <div className="w-px h-6 bg-slate-800 mx-1"></div>

          {/* Dialer Select */}
          <div className="relative">
            <select
              value={dialerType}
              onChange={(e) => setDialerType(e.target.value)}
              disabled={user && user.role === 'QA Agent'}
              className="appearance-none bg-slate-800/80 border border-slate-700 text-slate-200 text-sm rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer h-[34px] disabled:opacity-75 disabled:cursor-not-allowed"
            >
              <option value="medicare">Medicare Dialer</option>
              <option value="pharmacy">Pharmacy Dialer</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={fetchSales}
            disabled={loading}
            className="flex items-center justify-center w-[34px] h-[34px] bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
           <button
            onClick={handleSync}
            disabled={syncing || loading}
            className="flex items-center gap-1.5 px-3 h-[34px] bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50 text-xs font-medium"
            title="Force a re-scrape of campaign statuses"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync
          </button>

          <button
            onClick={() => setShowAssign(true)}
            disabled={loading || filteredSales.length === 0}
            className={`flex items-center gap-1.5 px-3 h-[34px] rounded-lg transition-all text-xs font-semibold shadow-md cursor-pointer ${
              selectedLeadIds.length > 0
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold ring-2 ring-emerald-400/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50'
            }`}
            title="Assign leads to QA"
          >
            <UserCheck className="w-3.5 h-3.5" />
            {selectedLeadIds.length > 0 ? `Assign (${selectedLeadIds.length}) Selected` : 'Assign to QA'}
          </button>
        </div>
      </div>

      {showAssign && (
        <AssignLeadsModal
          onClose={() => setShowAssign(false)}
          dialer={dialerType}
          selectedLeads={selectedLeads}
          onDeselectLead={(id) => setSelectedLeadIds(prev => prev.filter(x => x !== id))}
          filteredLeads={filteredSales.filter(l => !qaMetadata[l.lead_id]?.is_assigned)}
          onComplete={handleAssignmentComplete}
        />
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* 
        COMPACT STATUS METRICS
      */}
      {!loading && statuses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
          <div
            onClick={() => setSelectedStatus('All')}
            className={`cursor-pointer transition-all duration-200 rounded-lg p-2.5 border flex flex-col justify-center gap-1 ${
              selectedStatus === 'All'
                ? 'bg-slate-800 border-slate-500/50 shadow-sm'
                : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${selectedStatus === 'All' ? 'text-white' : 'text-slate-400'}`}>
              All {timeFilter === 'TODAY' ? 'Today' : 'Monthly'}
            </span>
            <span className="text-lg font-bold text-slate-100">{totalSales}</span>
          </div>

          {/* Not a Sale card */}
          <div className="cursor-default transition-all duration-200 rounded-lg p-2.5 border flex flex-col justify-center gap-1 bg-red-950/30 border-red-500/20">
            <div className="flex items-center gap-1">
              <Ban className="w-3 h-3 text-red-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400">Not a Sale</span>
            </div>
            <span className="text-lg font-bold text-red-300">{notASaleCount}</span>
          </div>

          {Object.entries(statusCounts).map(([status, count]) => {
            const isSelected = selectedStatus === status;
            return (
              <div
                key={status}
                onClick={() => { setSelectedStatus(status); setSelectedTeam('All'); }}
                className={`cursor-pointer transition-all duration-200 rounded-lg p-2.5 border flex flex-col justify-center gap-1 ${
                  isSelected
                    ? 'bg-slate-800 border-slate-500/50 shadow-sm'
                    : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider truncate pr-1 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                    {status}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${count > 0 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                </div>
                <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 
        COMPACT TEAM METRICS
      */}
      {!loading && Object.keys(teamCounts || {}).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
          {Object.entries(teamCounts)
            .sort((a, b) => b[1] - a[1]) // Sort by highest sales
            .map(([team, count]) => {
            const isSelected = selectedTeam === team;
            return (
              <div
                key={team}
                onClick={() => { setSelectedTeam(team); setSelectedStatus('All'); }}
                className={`cursor-pointer transition-all duration-200 rounded-lg p-2.5 border flex flex-col justify-center gap-1 ${
                  isSelected
                    ? 'bg-emerald-900/30 border-emerald-500/50 shadow-sm'
                    : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider truncate pr-1 ${isSelected ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {team}
                  </span>
                </div>
                <span className={`text-lg font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 
        CLEAN DATA TABLE 
      */}
      {user?.role !== 'QA Agent' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col relative" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-slate-300 text-xs font-medium flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                {filteredSales.length}
              </span>
              {selectedStatus === 'All' ? 'Total Leads' : `Leads for ${selectedStatus}`}
            </h3>

            {/* Unassigned count indicator */}
            <span className="text-[11px] text-slate-400">
              (<span className="text-emerald-400 font-semibold">{unassignedFilteredSales.length}</span> unassigned)
            </span>

            {/* Quick Select Buttons */}
            {unassignedFilteredSales.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-400" /> Quick Select:
                </span>
                {[5, 10, 20, 50].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleQuickSelect(cnt)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-slate-700 text-[11px] font-bold transition-all cursor-pointer"
                  >
                    +{cnt}
                  </button>
                ))}
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="number"
                    min="1"
                    max={unassignedFilteredSales.length}
                    value={quickSelectCount}
                    onChange={e => setQuickSelectCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 text-center font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickSelect(quickSelectCount)}
                    className="px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Pick
                  </button>
                </div>
              </div>
            )}

            {selectedLeadIds.length > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-700/80 animate-in fade-in duration-200">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {selectedLeadIds.length} Selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLeadIds([])}
                  className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Agent Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={agentSearch}
                onChange={e => setAgentSearch(e.target.value)}
                placeholder="Search Agent..."
                className="bg-slate-950/80 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500 w-36 sm:w-48 transition-all"
              />
              {agentSearch && (
                <button
                  type="button"
                  onClick={() => setAgentSearch('')}
                  className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title="Clear agent search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {selectedLeadIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAssign(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all text-xs font-bold shadow-md cursor-pointer animate-in fade-in"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Assign {selectedLeadIds.length} Selected
              </button>
            )}
            { (selectedStatus !== 'All' || selectedTeam !== 'All' || agentSearch.trim()) && (
              <button 
                onClick={() => { setSelectedStatus('All'); setSelectedTeam('All'); setAgentSearch(''); }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-slate-800"
              >
                Reset Filters <Filter className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>


        <div className="overflow-auto flex-1 bg-slate-950/20">
          {loading && !sales.length ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <p className="text-xs font-medium">Loading sales...</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 sticky top-0 z-10">
                <tr>
                  <th className="w-10 px-3 py-3 text-center font-medium text-slate-400 border-b border-slate-800">
                    <button
                      type="button"
                      onClick={handleToggleAll}
                      className="text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center justify-center cursor-pointer"
                      title={allFilteredSelected ? "Deselect all visible" : "Select all visible"}
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : someFilteredSelected ? (
                        <div className="w-3.5 h-3.5 rounded border border-emerald-400 bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-[9px]">—</div>
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Lead ID</th>
                  <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">QA Status</th>
                  <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Phone</th>
                  <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Team</th>
                  <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Agent</th>
                  <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Last Call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSales.length === 0 && !loading && (
                  <tr>
                    <td colSpan="9" className="px-4 py-16 text-center text-slate-500">
                      No leads match the current filters.
                    </td>
                  </tr>
                )}
                {filteredSales.map((lead, idx) => {
                  const isAssigned = Boolean(qaMetadata[lead.lead_id]?.is_assigned);
                  const isSelected = selectedLeadIds.includes(lead.lead_id);
                  return (
                    <tr 
                      key={lead.lead_id + idx}
                      onClick={() => !isAssigned && handleToggleLead(lead.lead_id)}
                      className={`transition-colors ${
                        isAssigned
                          ? 'bg-slate-950/40 opacity-70 cursor-not-allowed'
                          : isSelected 
                            ? 'bg-emerald-950/40 hover:bg-emerald-950/50 border-l-2 border-emerald-500 cursor-pointer' 
                            : qaMetadata[lead.lead_id]?.qa_override === 'NOT_A_SALE' 
                              ? 'bg-red-950/20 hover:bg-red-950/30 cursor-pointer' 
                              : 'hover:bg-slate-800/40 cursor-pointer'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {isAssigned ? (
                          <span title={`Already assigned to ${qaMetadata[lead.lead_id]?.assigned_qa_name || 'QA Agent'}`}>
                            <Ban className="w-3.5 h-3.5 text-slate-600 inline-block" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleToggleLead(lead.lead_id, e)}
                            className="text-slate-500 hover:text-emerald-400 transition-colors inline-flex items-center justify-center cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                            )}
                          </button>
                        )}
                      </td>
                      <td
                        className="px-4 py-2.5 whitespace-nowrap text-emerald-400 font-medium cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dialer/lead/${lead.lead_id}?dialer=${encodeURIComponent(dialerType)}&from=sales`);
                        }}
                      >
                        {lead.lead_id}
                      </td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <StatusCell
                          lead={lead}
                          dialerType={dialerType}
                          qaOverride={qaMetadata[lead.lead_id]?.qa_override}
                          onOverrideChange={handleOverrideChange}
                          statuses={statuses}
                        />
                      </td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <QaStatusCell
                          lead={lead}
                          dialerType={dialerType}
                          currentStatus={qaMetadata[lead.lead_id]?.qa_status || 'Pending'}
                          onStatusChange={handleStatusChange}
                        />
                        {qaMetadata[lead.lead_id]?.is_assigned && (
                          <div className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-900/40 text-blue-400 border border-blue-500/20">
                            Assigned to: {qaMetadata[lead.lead_id].assigned_qa_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300 font-semibold">
                        {lead.phone}
                      </td>
                      <td className="px-4 py-2.5 text-slate-200">
                        {lead.name || <span className="text-slate-600 italic">Unknown</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-900/40 text-emerald-400 border border-emerald-500/20">
                          {lead.team || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {lead.last_agent || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {lead.last_call || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      {/* Floating Selection Bar */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-emerald-500/40 shadow-2xl shadow-emerald-950/80 rounded-2xl px-5 py-3 flex items-center gap-4 backdrop-blur-md animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 text-white text-xs font-medium">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xs">
              {selectedLeadIds.length}
            </span>
            <span>Lead(s) selected from table</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:scale-105 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            Assign Selected Leads
          </button>
          <button
            onClick={() => setSelectedLeadIds([])}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Deselect All
          </button>
        </div>
      )}
    </div>
  );
}
