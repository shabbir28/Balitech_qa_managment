import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, AlertCircle, Database, Filter, ChevronDown, Calendar, Clock, Ban, UserCheck, X } from 'lucide-react';
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
          </select>
          <ChevronDown className="w-2.5 h-2.5 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>
      )}
    </div>
  );
}

// ─── AssignLeadsModal ────────────────────────────────────────────────────────
function AssignLeadsModal({ onClose, dialer, filteredLeads, onComplete }) {
  const [qas, setQas] = useState([]);
  const [selectedQa, setSelectedQa] = useState('');
  const [qty, setQty] = useState(filteredLeads.length > 5 ? 5 : filteredLeads.length);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingQas, setLoadingQas] = useState(true);

  useEffect(() => {
    api.get('/teams/members/available')
      .then(res => {
        setQas(res.data.data || []);
        if (res.data.data?.length > 0) {
          setSelectedQa(res.data.data[0].id);
        }
      })
      .catch(() => toast.error('Failed to load QA list.'))
      .finally(() => setLoadingQas(false));
  }, []);

  const handleAssign = async () => {
    if (!selectedQa) { toast.error('Select a QA Agent.'); return; }
    if (qty <= 0) { toast.error('Quantity must be greater than 0.'); return; }
    
    // Slice first X quantity from filteredLeads
    const leadsToAssign = filteredLeads.slice(0, qty);
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
          sale_date: l.sale_date || l.last_call?.substring(0, 10)
        })),
        notes
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Leads assigned successfully!');
        onComplete();
        onClose();
      } else {
        toast.error(res.data.message || 'Failed to assign leads.');
      }
    } catch {
      toast.error('Server error during lead assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-semibold text-sm">Assign Leads to QA</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-slate-400 text-xs leading-relaxed">
            Assign leads from your current filtered list to a QA Agent for evaluation.
          </p>

          {/* QA Dropdown */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Select QA Agent</label>
            {loadingQas ? (
              <div className="text-xs text-slate-500 animate-pulse">Loading QA team members...</div>
            ) : (
              <div className="relative">
                <select
                  value={selectedQa}
                  onChange={e => setSelectedQa(e.target.value)}
                  className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {qas.length === 0 ? (
                    <option value="">No QA Agents found</option>
                  ) : (
                    qas.map(q => (
                      <option key={q.id} value={q.id}>{q.name} ({q.campaign_name || 'No Campaign'})</option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Quantity to Assign (Max {filteredLeads.length})
            </label>
            <input
              type="number"
              min="1"
              max={filteredLeads.length}
              value={qty}
              onChange={e => setQty(Math.min(filteredLeads.length, Math.max(1, parseInt(e.target.value) || 0)))}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="E.g., Please evaluate these urgently..."
              rows="2"
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-650 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAssign}
              disabled={submitting || qas.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg py-2 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
            <button
              onClick={onClose}
              className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm rounded-lg py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
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
  const [timeFilter, setTimeFilter] = useState('TODAY');
  const [qaMetadata, setQaMetadata] = useState({}); // { lead_id -> { qa_override, qa_status } }
  const [showAssign, setShowAssign] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelectedStatus('All');
    setSelectedTeam('All');
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

    return { 
      filteredSales: finalFiltered, 
      statusCounts: sCounts,
      teamCounts: tCounts,
      totalSales: sales.length,
      notASaleCount: nasc
    };
  }, [sales, statuses, selectedStatus, selectedTeam, qaMetadata]);

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
            className="flex items-center gap-1.5 px-3 h-[34px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 text-xs font-semibold shadow-md cursor-pointer"
            title="Assign these leads to QA"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Assign to QA
          </button>
        </div>
      </div>

      {showAssign && (
        <AssignLeadsModal
          onClose={() => setShowAssign(false)}
          dialer={dialerType}
          filteredLeads={filteredSales}
          onComplete={fetchSales}
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
          <h3 className="text-slate-300 text-xs font-medium flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
              {filteredSales.length}
            </span>
            {selectedStatus === 'All' ? 'Total Leads' : `Leads for ${selectedStatus}`}
          </h3>
          { (selectedStatus !== 'All' || selectedTeam !== 'All') && (
            <button 
              onClick={() => { setSelectedStatus('All'); setSelectedTeam('All'); }}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              Clear Filter <Filter className="w-3 h-3" />
            </button>
          )}
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
                    <td colSpan="8" className="px-4 py-16 text-center text-slate-500">
                      No leads match the current filters.
                    </td>
                  </tr>
                )}
                {filteredSales.map((lead, idx) => (
                  <tr 
                    key={lead.lead_id + idx}
                    className={`transition-colors ${qaMetadata[lead.lead_id]?.qa_override === 'NOT_A_SALE' ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-slate-800/40'}`}
                  >
                    <td
                      className="px-4 py-2.5 whitespace-nowrap text-emerald-400 font-medium cursor-pointer hover:underline"
                      onClick={() => navigate(`/dialer/lead/${lead.lead_id}?dialer=${encodeURIComponent(dialerType)}`)}
                    >
                      {lead.lead_id}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusCell
                        lead={lead}
                        dialerType={dialerType}
                        qaOverride={qaMetadata[lead.lead_id]?.qa_override}
                        onOverrideChange={handleOverrideChange}
                        statuses={statuses}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <QaStatusCell
                        lead={lead}
                        dialerType={dialerType}
                        currentStatus={qaMetadata[lead.lead_id]?.qa_status || 'Pending'}
                        onStatusChange={handleStatusChange}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-300">
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
