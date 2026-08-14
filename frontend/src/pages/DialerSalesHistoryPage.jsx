import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, AlertCircle, History, ChevronDown,
  CalendarDays, Search, Users, TrendingUp, Phone, Filter, X, Ban, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import DateRangeDropdown from '../components/common/DateRangeDropdown';
import { getEstDateString, fmtLocal } from '../utils/dateUtils';

// ─── StatusCell & QaStatusCell Components ─────────────────────────────────────
function StatusCell({ row, dialerType, onOverrideChange }) {
  const [updating, setUpdating] = useState(false);
  const isNotASale = row.qa_override === 'NOT_A_SALE';

  const handleChange = async (e) => {
    const newVal = e.target.value;
    const qa_override = newVal === 'NOT_A_SALE' ? 'NOT_A_SALE' : null;
    setUpdating(true);
    try {
      const res = await api.post('/dialer-sales/override', {
        lead_id: row.lead_id,
        dialer: dialerType,
        qa_override
      });
      if (res.data.success) {
        onOverrideChange(row.lead_id, qa_override);
        if (qa_override === 'NOT_A_SALE') {
          toast.success('Marked as Not a Sale');
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

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {updating ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
      ) : (
        <div className="relative">
          <select
            value={isNotASale ? 'NOT_A_SALE' : row.status}
            onChange={handleChange}
            className={`appearance-none text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 pr-5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors ${
              isNotASale
                ? 'bg-red-900/40 text-red-400 border-red-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <option value={row.status}>{row.status}</option>
            <option value="NOT_A_SALE">Not a Sale</option>
          </select>
          <ChevronDown className="w-2.5 h-2.5 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>
      )}
    </div>
  );
}

function QaStatusCell({ row, dialerType, onStatusChange }) {
  const [updating, setUpdating] = useState(false);

  const handleChange = async (e) => {
    const newVal = e.target.value;
    setUpdating(true);
    try {
      const res = await api.post('/dialer-sales/qa-status', {
        lead_id: row.lead_id,
        dialer: dialerType,
        qa_status: newVal
      });
      if (res.data.success) {
        onStatusChange(row.lead_id, newVal);
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
    switch (row.qa_status) {
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
            value={row.qa_status || 'Pending'}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DialerSalesHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getInitialDates = () => {
    const todayEST = getEstDateString(new Date());
    const baseDate = new Date(`${todayEST}T00:00:00`);
    baseDate.setDate(baseDate.getDate() - 1);
    const dateStr = fmtLocal(baseDate);
    return { start: dateStr, end: dateStr };
  };

  const [dialerType, setDialerType]     = useState('medicare');

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

  const [startDate, setStartDate]       = useState(getInitialDates().start);
  const [endDate, setEndDate]           = useState(getInitialDates().end);
  const [loading, setLoading]           = useState(false);
  const [fetched, setFetched]           = useState(false);
  const [sales, setSales]               = useState([]);
  const [statusSummary, setStatusSummary] = useState({});
  const [teamSummary, setTeamSummary]   = useState({});
  const [total, setTotal]               = useState(0);
  const [notASaleCount, setNotASaleCount] = useState(0);
  const [error, setError]               = useState('');
  const [showAssign, setShowAssign]     = useState(false);

  const [filterStatus, setFilterStatus] = useState('All');
  const [filterTeam, setFilterTeam]     = useState('All');
  const [filterNotASale, setFilterNotASale] = useState(false);
  const [searchText, setSearchText]     = useState('');

  const handleDateRangeChange = useCallback((start, end) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  const fetchHistory = useCallback(async (sDate, eDate) => {
    const s = sDate || startDate;
    const e = eDate || endDate;
    if (!s || !e) { toast.error('Please select a date range.'); return; }
    setLoading(true);
    setError('');
    setFilterStatus('All');
    setFilterTeam('All');
    setFilterNotASale(false);
    setSearchText('');
    try {
      const res = await api.get(
        `/dialer-sales/history?dialer=${encodeURIComponent(dialerType)}&startDate=${s}&endDate=${e}`
      );
      if (res.data.success) {
        setSales(res.data.data);
        setStatusSummary(res.data.statusSummary || {});
        setTeamSummary(res.data.teamSummary || {});
        setTotal(res.data.total || 0);
        setNotASaleCount(res.data.notASaleCount || 0);
        setFetched(true);
        if (res.data.total === 0) {
          toast('No sales found for this date range.', { icon: 'ℹ️' });
        } else {
          toast.success(`${res.data.total} sales found`);
        }
      } else {
        setError(res.data.message || 'Server error');
      }
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  }, [dialerType, startDate, endDate]);

  const handleOverrideChange = useCallback((lead_id, qa_override) => {
    setSales(prev => prev.map(r => r.lead_id === lead_id ? { ...r, qa_override } : r));
    setNotASaleCount(prev => {
      const was = sales.find(r => r.lead_id === lead_id)?.qa_override === 'NOT_A_SALE';
      if (qa_override === 'NOT_A_SALE' && !was) return prev + 1;
      if (!qa_override && was) return prev - 1;
      return prev;
    });
  }, [sales]);

  const handleStatusChange = useCallback((lead_id, qa_status) => {
    setSales(prev => prev.map(r => r.lead_id === lead_id ? { ...r, qa_status } : r));
  }, []);

  const filteredSales = useMemo(() => {
    let arr = sales;
    if (filterNotASale) {
      arr = arr.filter(r => r.qa_override === 'NOT_A_SALE');
    } else {
      if (filterStatus !== 'All') arr = arr.filter(r => r.status === filterStatus);
      if (filterTeam !== 'All')   arr = arr.filter(r => (r.team || 'Unknown') === filterTeam);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      arr = arr.filter(r =>
        (r.lead_id || '').toLowerCase().includes(q) ||
        (r.phone   || '').toLowerCase().includes(q) ||
        (r.agent   || '').toLowerCase().includes(q) ||
        (r.status  || '').toLowerCase().includes(q) ||
        (r.team    || '').toLowerCase().includes(q) ||
        (r.sale_date || '').includes(q)
      );
    }
    return arr;
  }, [sales, filterStatus, filterTeam, filterNotASale, searchText]);

  const hasFilters = filterStatus !== 'All' || filterTeam !== 'All' || filterNotASale || searchText.trim();

  const dateRangeLabel = startDate === endDate
    ? startDate
    : `${startDate} → ${endDate}`;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-6">

      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
            <History className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">Daily Sales History</h1>
            <p className="text-slate-400 text-xs flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {fetched ? dateRangeLabel : 'View day-wise dialer sales from the database'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dialer Select */}
          <div className="relative">
            <select
              value={dialerType}
              onChange={e => setDialerType(e.target.value)}
              disabled={user && user.role === 'QA Agent'}
              className="appearance-none bg-slate-800/80 border border-slate-700 text-slate-200 text-sm rounded-lg pl-3 pr-8 py-1.5 h-[34px] focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              <option value="medicare">Medicare Dialer</option>
              <option value="pharmacy">Pharmacy Dialer</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Date Range Dropdown */}
          <DateRangeDropdown
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateRangeChange}
          />
          {/* View Button */}
          <button
            onClick={() => fetchHistory()}
            disabled={loading}
            className="flex items-center gap-2 px-4 h-[34px] bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Loading...' : 'View Sales'}
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
          onComplete={() => fetchHistory()}
        />
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /><p>{error}</p>
        </div>
      )}

      {/* ─── EMPTY STATE ─────────────────────────────────────── */}
      {!fetched && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
          <CalendarDays className="w-12 h-12 opacity-30" />
          <p className="text-sm font-medium">Select a date range and click "View Sales" to get started</p>
        </div>
      )}

      {/* ─── LOADING ─────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          <p className="text-sm font-medium">Fetching sales data...</p>
        </div>
      )}

      {/* ─── RESULTS ─────────────────────────────────────────── */}
      {fetched && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gradient-to-br from-violet-900/40 to-purple-900/20 border border-violet-500/20 rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Total Sales
              </span>
              <span className="text-3xl font-bold text-white">{total}</span>
              <span className="text-[10px] text-slate-500 truncate">{dateRangeLabel}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Teams
              </span>
              <span className="text-3xl font-bold text-white">{Object.keys(teamSummary).length}</span>
              <span className="text-[10px] text-slate-500">Active teams</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Statuses
              </span>
              <span className="text-3xl font-bold text-white">{Object.keys(statusSummary).length}</span>
              <span className="text-[10px] text-slate-500">Sale types</span>
            </div>

            {/* Not a Sale */}
            <div
              onClick={() => { setFilterNotASale(f => !f); setFilterStatus('All'); setFilterTeam('All'); }}
              className={`cursor-pointer rounded-xl p-4 flex flex-col gap-1 border transition-all ${
                filterNotASale
                  ? 'bg-red-900/40 border-red-500/40 shadow-lg shadow-red-900/20'
                  : 'bg-slate-900 border-slate-800 hover:border-red-500/30'
              }`}
            >
              <span className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 ${filterNotASale ? 'text-red-300' : 'text-red-400'}`}>
                <Ban className="w-3.5 h-3.5" /> Not a Sale
              </span>
              <span className={`text-3xl font-bold ${filterNotASale ? 'text-red-200' : 'text-white'}`}>{notASaleCount}</span>
              <span className={`text-[10px] ${filterNotASale ? 'text-red-400' : 'text-slate-500'}`}>
                {filterNotASale ? 'Click to clear' : 'QA marked — click to filter'}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Showing
              </span>
              <span className="text-3xl font-bold text-white">{filteredSales.length}</span>
              <span className="text-[10px] text-slate-500">After filters</span>
            </div>
          </div>

          {/* Status Breakdown */}
          {Object.keys(statusSummary).length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Status Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                <div
                  onClick={() => { setFilterStatus('All'); setFilterNotASale(false); }}
                  className={`cursor-pointer rounded-lg p-2.5 border flex flex-col gap-1 transition-all ${
                    filterStatus === 'All' && !filterNotASale
                      ? 'bg-violet-900/30 border-violet-500/40'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${filterStatus === 'All' && !filterNotASale ? 'text-violet-300' : 'text-slate-400'}`}>All</span>
                  <span className={`text-lg font-bold ${filterStatus === 'All' && !filterNotASale ? 'text-violet-200' : 'text-slate-200'}`}>{total}</span>
                </div>
                {Object.entries(statusSummary).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                  <div
                    key={status}
                    onClick={() => { setFilterStatus(status); setFilterTeam('All'); setFilterNotASale(false); }}
                    className={`cursor-pointer rounded-lg p-2.5 border flex flex-col gap-1 transition-all ${
                      filterStatus === status && !filterNotASale
                        ? 'bg-slate-800 border-slate-500/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${filterStatus === status && !filterNotASale ? 'text-white' : 'text-slate-400'}`}>{status}</span>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${count > 0 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                    </div>
                    <span className={`text-lg font-bold ${filterStatus === status && !filterNotASale ? 'text-white' : 'text-slate-200'}`}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Breakdown */}
          {Object.keys(teamSummary).length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Team Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {Object.entries(teamSummary).sort((a, b) => b[1] - a[1]).map(([team, count]) => (
                  <div
                    key={team}
                    onClick={() => { setFilterTeam(team); setFilterStatus('All'); setFilterNotASale(false); }}
                    className={`cursor-pointer rounded-lg p-2.5 border flex flex-col gap-1 transition-all ${
                      filterTeam === team && !filterNotASale
                        ? 'bg-emerald-900/30 border-emerald-500/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${filterTeam === team && !filterNotASale ? 'text-emerald-300' : 'text-slate-400'}`}>{team}</span>
                    <span className={`text-lg font-bold ${filterTeam === team && !filterNotASale ? 'text-emerald-400' : 'text-slate-200'}`}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TABLE ──────────────────────────────────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col" style={{ height: 'calc(100vh - 460px)', minHeight: '380px' }}>
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-1">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">{filteredSales.length}</span>
                <h3 className="text-slate-300 text-xs font-medium">
                  {filterNotASale ? 'Not a Sale Records' : filterStatus === 'All' && filterTeam === 'All' ? 'All Sales' : 'Filtered Sales'}
                  {' '}— {dateRangeLabel}
                </h3>
                {hasFilters && (
                  <button onClick={() => { setFilterStatus('All'); setFilterTeam('All'); setFilterNotASale(false); setSearchText(''); }} className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 ml-2">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search lead, phone, agent, date..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 w-56 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="overflow-auto flex-1 bg-slate-950/20">
              {filteredSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                  <History className="w-8 h-8 opacity-20" />
                  <p className="text-xs">No sales found for the selected filters.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800 w-10">#</th>
                      <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Lead ID</th>
                      <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Status</th>
                      <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">QA Status</th>
                      <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Phone</th>
                      <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Team</th>
                      <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Agent</th>
                      <th className="px-4 py-3 font-medium text-slate-400 border-b border-slate-800">Sale Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredSales.map((row, idx) => (
                      <tr
                        key={`${row.lead_id}-${idx}`}
                        className={`transition-colors ${row.qa_override === 'NOT_A_SALE' ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-slate-800/40'}`}
                      >
                        <td className="px-4 py-2.5 text-slate-600 font-mono">{idx + 1}</td>
                        <td
                          className="px-4 py-2.5 text-violet-400 font-medium whitespace-nowrap cursor-pointer hover:underline"
                          onClick={() => navigate(`/dialer/lead/${row.lead_id}?dialer=${encodeURIComponent(dialerType)}`)}
                        >
                          {row.lead_id}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusCell row={row} dialerType={dialerType} onOverrideChange={handleOverrideChange} />
                        </td>
                        <td className="px-4 py-2.5">
                          <QaStatusCell row={row} dialerType={dialerType} onStatusChange={handleStatusChange} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-300">{row.phone || '-'}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-900/40 text-emerald-400 border border-emerald-500/20">
                            {row.team || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{row.agent || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{row.sale_date || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
