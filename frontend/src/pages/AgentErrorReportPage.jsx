import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users, AlertCircle, Search, RefreshCw, ShieldAlert,
  ChevronDown, ChevronRight, Phone, CheckCircle2, XCircle, Flag,
  AlertTriangle, Download, Clock, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import DateRangeDropdown from '../components/common/DateRangeDropdown';
import { getEstDateString } from '../utils/dateUtils';

export default function AgentErrorReportPage() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Grouping Mode: 'qa' (QA Officer / Evaluator who was assigned leads) OR 'call_agent' (Caller Agent)
  const [groupBy, setGroupBy] = useState('qa');

  // Default to today in US Eastern Time
  const todayEST = useMemo(() => getEstDateString(new Date()), []);

  // Filters
  const [search, setSearch] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedEvaluator, setSelectedEvaluator] = useState('all');
  const [dateRange, setDateRange] = useState({ start: todayEST, end: todayEST });
  const [expandedName, setExpandedName] = useState(null);

  // Load campaigns
  useEffect(() => {
    api.get('/campaigns')
      .then(res => setCampaigns(res.data.data || []))
      .catch(() => {});
  }, []);

  // Search is applied client-side below (the report is small), so it must not
  // refire the request per keystroke. The sequence guard drops a slow older
  // response that would otherwise overwrite fresher data.
  const requestSeq = useRef(0);
  const fetchData = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const params = { group_by: groupBy };
      if (selectedCampaign) params.campaign_name = selectedCampaign;
      if (dateRange.start) params.from_date = dateRange.start;
      if (dateRange.end) params.to_date = dateRange.end;

      const res = await api.get('/evaluations/reports/agent-errors', { params });
      if (seq !== requestSeq.current) return;
      if (res.data.success) {
        const data = Array.isArray(res.data.data) ? res.data.data : [];
        setReportData(data);

        // Auto-expand if only 1 evaluator or if specific evaluator filtered
        if (data.length === 1) {
          setExpandedName(data[0].name);
        }
      }
    } catch {
      if (seq === requestSeq.current) toast.error('Failed to load QA Agent Error Report.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [groupBy, selectedCampaign, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // List of distinct QA officers or agents present in data for quick dropdown
  const availableOfficers = useMemo(() => {
    return reportData.map(item => item.name).sort();
  }, [reportData]);

  // Filtered by selected evaluator & search input
  const filteredData = useMemo(() => {
    let list = reportData;
    if (selectedEvaluator !== 'all') {
      list = list.filter(item => item.name === selectedEvaluator);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(item =>
        (item.name && item.name.toLowerCase().includes(s)) ||
        (item.campaign_name && item.campaign_name.toLowerCase().includes(s))
      );
    }
    return list;
  }, [reportData, selectedEvaluator, search]);

  // Dynamic list of unique LA categories found in filtered dataset
  const filteredCategories = useMemo(() => {
    const counts = {};
    filteredData.forEach(item => {
      Object.entries(item.la_categories || {}).forEach(([cat, count]) => {
        counts[cat] = (counts[cat] || 0) + count;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredData]);

  // Dynamic status counts for filtered view
  const currentStatusCounts = useMemo(() => {
    const counts = {
      totalAssigned: 0,
      totalEvaluated: 0,
      Pending: 0,
      Accepted: 0,
      Rejected: 0,
      Flagged: 0,
      Decline: 0,
      'Not Billable': 0
    };
    filteredData.forEach(item => {
      counts.totalAssigned += item.total_assigned || 0;
      counts.totalEvaluated += item.total_evaluated || 0;
      Object.entries(item.statuses || {}).forEach(([st, cnt]) => {
        if (counts[st] !== undefined) counts[st] += cnt;
      });
    });
    return counts;
  }, [filteredData]);

  // Export to CSV
  const exportCsv = () => {
    if (!filteredData.length) return toast.error('No data to export.');
    const catKeys = filteredCategories.map(c => c[0]);
    const headers = [
      groupBy === 'qa' ? 'QA Evaluator Name' : 'Call Agent Name',
      'Campaign',
      'Total Assigned',
      'Evaluated',
      'Pending',
      'Accepted',
      'Rejected',
      'Flagged',
      'Decline',
      'Not Billable',
      ...catKeys
    ];
    const csvCell = (v) => {
      const s = String(v ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredData.map(item => [
      csvCell(item.name),
      csvCell(item.campaign_name),
      item.total_assigned,
      item.total_evaluated,
      item.statuses?.Pending || 0,
      item.statuses?.Accepted || 0,
      item.statuses?.Rejected || 0,
      item.statuses?.Flagged || 0,
      item.statuses?.Decline || 0,
      item.statuses?.['Not Billable'] || 0,
      ...catKeys.map(k => item.la_categories?.[k] || 0)
    ]);
    const csvContent = [headers.map(csvCell).join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const who = selectedEvaluator !== 'all' ? selectedEvaluator.replace(/[^\w-]+/g, '_') : 'all';
    link.setAttribute('download', `qa_agent_report_${who}_${getEstDateString(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Report exported to CSV');
  };

  return (
    <div className="font-sans space-y-6 pb-12">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Daily QA Agent & Error Report</h1>
          </div>
          <p className="text-xs text-slate-400">
            Monitor assigned leads and evaluation accuracy per QA Officer (e.g. David). Track status outcomes and live LA Side errors count.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Evaluator Selector Pills */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase px-2">Agent:</span>
            <select
              value={selectedEvaluator}
              onChange={e => {
                setSelectedEvaluator(e.target.value);
                if (e.target.value !== 'all') setExpandedName(e.target.value);
              }}
              className="bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Agents / QA Officers</option>
              {availableOfficers.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Grouping Toggle */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setGroupBy('qa')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                groupBy === 'qa' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              By QA Officer
            </button>
            <button
              onClick={() => setGroupBy('call_agent')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                groupBy === 'call_agent' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              By Call Agent
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/60 transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={exportCsv}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Active Agent Profile Banner (if specific agent selected) ── */}
      {selectedEvaluator !== 'all' && (
        <div className="bg-gradient-to-r from-indigo-950/60 via-[#111827] to-[#111827] border border-indigo-500/30 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-lg">
              {selectedEvaluator.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white capitalize">{selectedEvaluator}</h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold">
                  {groupBy === 'qa' ? 'QA Evaluator' : 'Call Agent'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Detailed audit performance, assigned leads, and categorized LA error statistics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedEvaluator('all')}
              className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
            >
              Clear Filter (Show All)
            </button>
          </div>
        </div>
      )}

      {/* ── KPI Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Total Assigned</span>
          <p className="text-xl font-bold text-white">{currentStatusCounts.totalAssigned}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {selectedEvaluator !== 'all' ? selectedEvaluator : `${filteredData.length} team members`}
          </span>
        </div>

        <div className="bg-[#111827] border border-amber-500/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Pending</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-400">{currentStatusCounts.Pending}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Awaiting audit</span>
        </div>

        <div className="bg-[#111827] border border-emerald-500/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Accepted</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">{currentStatusCounts.Accepted}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Passed QA</span>
        </div>

        <div className="bg-[#111827] border border-rose-500/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Rejected</span>
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-xl font-bold text-rose-400">{currentStatusCounts.Rejected}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Failed QA</span>
        </div>

        <div className="bg-[#111827] border border-amber-500/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Flagged</span>
            <Flag className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-400">{currentStatusCounts.Flagged}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Requires review</span>
        </div>

        <div className="bg-[#111827] border border-purple-500/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Decline</span>
            <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-xl font-bold text-purple-400">{currentStatusCounts.Decline}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Customer decline</span>
        </div>

        <div className="bg-[#111827] border border-cyan-500/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Not Billable</span>
            <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-xl font-bold text-cyan-400">{currentStatusCounts['Not Billable']}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Non-billable calls</span>
        </div>
      </div>

      {/* ── Top LA Error Categories Bar ──────────────────────────── */}
      {filteredCategories.length > 0 && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            LA Side Errors Frequency {selectedEvaluator !== 'all' ? `for ${selectedEvaluator}` : '(All Agents)'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {filteredCategories.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-2 bg-[#0B1120] border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-sm">
                <span className="text-xs text-slate-200 font-medium">{cat}</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold font-mono">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters Toolbar ───────────────────────────────────────── */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search agent name or campaign..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0B1120] border border-slate-800 text-xs text-slate-200 pl-9 pr-3 py-2 rounded-xl outline-none focus:border-indigo-500/50 placeholder:text-slate-600"
            />
          </div>

          <select
            value={selectedCampaign}
            onChange={e => setSelectedCampaign(e.target.value)}
            className="bg-[#0B1120] border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-xl outline-none focus:border-indigo-500/50 cursor-pointer"
          >
            <option value="">All Campaigns</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hidden sm:inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> US EST
          </span>
          <DateRangeDropdown
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={(s, e) => setDateRange({ start: s, end: e })}
          />
        </div>
      </div>

      {/* ── Main Report Table ────────────────────────────────────── */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">
              {groupBy === 'qa' ? 'QA Evaluator Summary' : 'Call Agent Summary'}
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {filteredData.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Click any row to expand phone audit records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1120] border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
              <tr>
                <th className="py-3 px-4 w-8"></th>
                <th className="py-3 px-4">{groupBy === 'qa' ? 'QA Evaluator' : 'Call Agent'}</th>
                <th className="py-3 px-4">Campaign</th>
                <th className="py-3 px-4 text-center">Assigned</th>
                <th className="py-3 px-4 text-center">Audited</th>
                <th className="py-3 px-4 text-center text-amber-400">Pending</th>
                <th className="py-3 px-4 text-center text-emerald-400">Accepted</th>
                <th className="py-3 px-4 text-center text-rose-400">Rejected</th>
                <th className="py-3 px-4 text-center text-purple-400">Decline</th>
                <th className="py-3 px-4 text-center text-cyan-400">Not Billable</th>
                <th className="py-3 px-4">LA Side Error Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                    <p className="text-xs">Loading QA agent report...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-500">
                    <AlertCircle className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs">No records found for the selected criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredData.map(item => {
                  const isExpanded = expandedName === item.name;
                  const catEntries = Object.entries(item.la_categories || {});

                  return (
                    <React.Fragment key={`${item.name}|${item.campaign_name || ''}|${item.qa_id ?? ''}`}>
                      <tr
                        onClick={() => setExpandedName(isExpanded ? null : item.name)}
                        className={`transition-colors cursor-pointer ${
                          isExpanded ? 'bg-indigo-500/[0.07]' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-3 px-4 text-center text-slate-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="capitalize">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-medium">
                            {item.campaign_name || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white font-mono">
                          {item.total_assigned}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-indigo-300 font-mono">
                          {item.total_evaluated}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-amber-400 font-mono">
                          {item.statuses?.Pending || 0}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-400 font-mono">
                          {item.statuses?.Accepted || 0}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-rose-400 font-mono">
                          {item.statuses?.Rejected || 0}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-purple-400 font-mono">
                          {item.statuses?.Decline || 0}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-cyan-400 font-mono">
                          {item.statuses?.['Not Billable'] || 0}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {catEntries.length === 0 ? (
                              <span className="text-[11px] text-slate-500 italic">No errors logged</span>
                            ) : (
                              catEntries.map(([catName, count]) => (
                                <span
                                  key={catName}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-300 font-medium"
                                  title={`${count} occurrence(s)`}
                                >
                                  <span>{catName}</span>
                                  <strong className="text-purple-400 font-mono bg-purple-500/20 px-1 rounded text-[10px]">
                                    {count}
                                  </strong>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded Detail Subtable ── */}
                      {isExpanded && (
                        <tr className="bg-[#0B1120] border-y border-indigo-500/20">
                          <td colSpan={11} className="p-4 sm:p-5">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                                  Audit Records for {item.name} ({item.records?.length ?? 0} records)
                                </h4>
                              </div>

                              <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-[#111827] text-slate-400 text-[10px] uppercase font-semibold">
                                    <tr>
                                      <th className="py-2.5 px-3">Phone</th>
                                      <th className="py-2.5 px-3">Call Agent</th>
                                      <th className="py-2.5 px-3">QA Evaluator</th>
                                      <th className="py-2.5 px-3">Date</th>
                                      <th className="py-2.5 px-3">QA Status</th>
                                      <th className="py-2.5 px-3">LA Side Error Category</th>
                                      <th className="py-2.5 px-3">LA Side Feedback</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/40">
                                    {(item.records ?? []).map(rec => (
                                      <tr key={rec.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="py-2 px-3 font-mono text-slate-200">
                                          {rec.phone || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-slate-300">
                                          {rec.call_agent || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-slate-300 capitalize">
                                          {rec.qa_evaluator || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                          {rec.date}
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                            rec.qa_status === 'Accepted' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20' :
                                            rec.qa_status === 'Rejected' ? 'bg-rose-950/50 text-rose-400 border border-rose-500/20' :
                                            rec.qa_status === 'Flagged' ? 'bg-amber-950/50 text-amber-400 border border-amber-500/20' :
                                            rec.qa_status === 'Decline' ? 'bg-purple-950/50 text-purple-400 border border-purple-500/20' :
                                            rec.qa_status === 'Not Billable' ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/20' :
                                            rec.qa_status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                            'bg-slate-800 text-slate-300'
                                          }`}>
                                            {rec.qa_status}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3">
                                          {rec.la_category !== '—' ? (
                                            <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium text-[11px]">
                                              {rec.la_category}
                                            </span>
                                          ) : (
                                            <span className="text-slate-600">—</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-300 max-w-xs truncate" title={rec.la_feedback}>
                                          {rec.la_feedback}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
