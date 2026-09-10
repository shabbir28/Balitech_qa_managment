import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  XCircle, Search, RefreshCw, Download, Clock, Copy, Check,
  Phone, Users, Headset, ClipboardList, Hash, CalendarDays, X, ChevronDown, ShieldCheck, Inbox,
  Play, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import DateRangeDropdown from '../components/common/DateRangeDropdown';
import { Pagination } from '../components/ui';
import { getPresets } from '../utils/dateUtils';
import { copyText } from '../utils/clipboard';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 25;

/**
 * Strips the blank lines and stray indentation QA leaves in the feedback boxes
 * so the pasted block stays tight in chat.
 */
function tidyText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Plain-text version of one rejected call, laid out the way QA shares it in
 * chat: tab-separated header line, then the two feedback sections.
 */
function formatRecordAsText(r) {
  const header = [
    r.agent_name,
    r.team,
    r.phone,
    r.dids,
    r.talk_time,
    r.qa_status || 'Rejected',
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join('\t');

  return [
    header,
    'Agent side:',
    tidyText(r.agent_feedback) || '—',
    'LA side:',
    tidyText(r.la_feedback) || '—',
  ].join('\n');
}

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

// Talk time is always shown in raw seconds to match the dialer report.
function formatTalkTime(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return sec || '';
  return `${Math.round(n)}s`;
}

function prettyDate(iso) {
  const d = String(iso || '').slice(0, 10);
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const initialsOf = (name) =>
  String(name || '').trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

const selectCls = 'h-9 bg-[#0B1120] border border-slate-800 text-xs text-slate-200 pl-3 pr-8 rounded-lg outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 cursor-pointer appearance-none';

const SelectWrap = ({ children }) => (
  <div className="relative">
    {children}
    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

export default function RejectedCallsReportPage() {
  const { user } = useAuth();
  const isAgent = user?.role === 'QA Agent';

  const today = useMemo(() => getPresets().find((p) => p.label === 'Today'), []);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [qaUsers, setQaUsers] = useState([]);
  const [selectedQa, setSelectedQa] = useState('');
  const [dateRange, setDateRange] = useState({ start: today?.start || '', end: today?.end || '' });
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.get('/campaigns').then((res) => setCampaigns(res.data.data || [])).catch(() => {});
    if (!isAgent) {
      api.get('/users', { params: { limit: 100 } })
        .then((res) => {
          const list = Array.isArray(res.data.data) ? res.data.data : [];
          setQaUsers([...list].sort((a, b) => String(a.name).localeCompare(String(b.name))));
        })
        .catch(() => {});
    }
  }, [isAgent]);

  // Filters changed → back to first page.
  useEffect(() => { setPage(1); }, [debouncedSearch, selectedCampaign, selectedQa, dateRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedCampaign) params.campaign_name = selectedCampaign;
      if (selectedQa) params.qa_user_id = selectedQa;
      if (dateRange.start) params.from_date = dateRange.start;
      if (dateRange.end) params.to_date = dateRange.end;

      const res = await api.get('/evaluations/reports/rejected', { params });
      if (res.data.success) {
        setRows(res.data.data || []);
        setSummary(res.data.summary || null);
        setPagination(res.data.pagination || null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load rejected calls.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedCampaign, selectedQa, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total = summary?.total ?? pagination?.total ?? rows.length;
  const agentsCount = summary?.agents ?? new Set(rows.map((r) => r.agent_name)).size;
  const teamsCount = summary?.teams ?? 0;
  const missingFeedback = summary?.missing_feedback ?? 0;
  const topAgent = summary?.top_agent || null;
  const topAgentShare = topAgent && total ? Math.round((topAgent.count / total) * 100) : 0;
  const hasFilters = Boolean(debouncedSearch || selectedCampaign || selectedQa);
  const searching = search.trim() !== debouncedSearch;

  const focusAgent = (name) => {
    if (!name) return;
    const same = search.trim().toLowerCase() === String(name).toLowerCase();
    setSearch(same ? '' : name);
  };

  const rangeLabel = useMemo(() => {
    if (!dateRange.start) return 'All time';
    if (dateRange.start === dateRange.end) return prettyDate(dateRange.start);
    return `${prettyDate(dateRange.start)} – ${prettyDate(dateRange.end)}`;
  }, [dateRange]);

  const clearFilters = () => { setSearch(''); setSelectedCampaign(''); setSelectedQa(''); };

  const handleCopy = async (r) => {
    const ok = await copyText(formatRecordAsText(r));
    if (!ok) return toast.error('Copy failed.');
    setCopiedId(r.evaluation_id);
    toast.success('Copied');
    setTimeout(() => setCopiedId((id) => (id === r.evaluation_id ? null : id)), 1500);
  };

  const handleCopyAll = async () => {
    if (!rows.length) return toast.error('Nothing to copy.');
    const ok = await copyText(rows.map(formatRecordAsText).join('\n--------------------\n'));
    ok ? toast.success(`Copied ${rows.length} record(s)`) : toast.error('Copy failed.');
  };

  const exportCsv = () => {
    if (!rows.length) return toast.error('No data to export.');
    const headers = ['Agent', 'Team', 'Number', 'DID', 'Talk Time (sec)', 'QA Status', 'Agent Side Feedback', 'LA Side Feedback', 'LA Error Category', 'Evaluation Date', 'QA Name'];
    const lines = rows.map((r) => [
      r.agent_name, r.team, r.phone, r.dids, r.talk_time, r.qa_status,
      r.agent_feedback, r.la_feedback, r.la_error_category, r.evaluation_date?.slice?.(0, 10) || r.evaluation_date, r.qa_name,
    ].map(csvCell).join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rejected_calls_${dateRange.start || 'all'}_${dateRange.end || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Report exported to CSV');
  };

  const startIndex = pagination ? (pagination.page - 1) * (pagination.limit || PAGE_SIZE) : 0;

  return (
    <div className="font-sans space-y-4 pb-10 max-w-[1280px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
            <XCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Rejected Calls Report</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isAgent
                ? 'Calls you rejected, with your agent-side and LA-side feedback.'
                : 'Rejected calls with the QA\'s agent-side and LA-side feedback.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchData}
            disabled={loading}
            title="Refresh"
            className="h-8 w-8 rounded-lg bg-[#111827] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all flex items-center justify-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
          <button
            onClick={handleCopyAll}
            className="h-8 px-3 rounded-lg bg-[#111827] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-all flex items-center gap-1.5"
            title="Copy all records on this page as text"
          >
            <Copy className="w-3.5 h-3.5" /> Copy page
          </button>
          <button
            onClick={exportCsv}
            className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-500/15 via-[#111827] to-[#111827] border border-rose-500/30 rounded-xl p-4">
          <XCircle className="absolute -right-3 -bottom-3 w-20 h-20 text-rose-500/10 pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
            </span>
            <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Rejected calls</span>
          </div>
          <p className="text-2xl font-black text-white leading-none">{loading && !summary ? '…' : total}</p>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {missingFeedback > 0
              ? <><span className="text-amber-300 font-semibold">{missingFeedback}</span> without feedback</>
              : 'All have feedback'}
          </p>
        </div>

        <div className="relative overflow-hidden bg-[#111827] border border-slate-800 rounded-xl p-4">
          <Users className="absolute -right-3 -bottom-3 w-20 h-20 text-slate-500/[0.06] pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-sky-400" />
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agents</span>
          </div>
          <p className="text-2xl font-black text-white leading-none">{loading && !summary ? '…' : agentsCount}</p>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {teamsCount ? `Across ${teamsCount} team${teamsCount === 1 ? '' : 's'}` : 'In selected range'}
            {agentsCount > 0 && total > 0 && <> · avg {(total / agentsCount).toFixed(1)} each</>}
          </p>
        </div>

        <button
          type="button"
          onClick={() => focusAgent(topAgent?.name)}
          disabled={!topAgent}
          title={topAgent ? (search.trim().toLowerCase() === topAgent.name.toLowerCase() ? 'Click to clear this filter' : `Show only ${topAgent.name}'s rejected calls`) : ''}
          className="relative overflow-hidden text-left bg-[#111827] border border-slate-800 rounded-xl p-4 transition-colors enabled:hover:border-amber-500/40 enabled:hover:bg-amber-500/[0.04] disabled:cursor-default"
        >
          <Headset className="absolute -right-3 -bottom-3 w-20 h-20 text-slate-500/[0.06] pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
              <Headset className="w-3.5 h-3.5 text-amber-400" />
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Most rejected agent</span>
          </div>
          <p className="text-sm font-bold text-white leading-tight truncate capitalize">
            {topAgent ? topAgent.name : '—'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {topAgent
              ? <><span className="text-amber-300 font-semibold">{topAgent.count}</span> rejection{topAgent.count === 1 ? '' : 's'} · {topAgentShare}% of total</>
              : 'No data in range'}
          </p>
        </button>

        <div className="relative overflow-hidden bg-[#111827] border border-slate-800 rounded-xl p-4">
          <CalendarDays className="absolute -right-3 -bottom-3 w-20 h-20 text-slate-500/[0.06] pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Range</span>
          </div>
          <p className="text-sm font-bold text-white leading-tight">{rangeLabel}</p>
          <p className="text-[10px] text-slate-500 mt-1.5 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> US Eastern evaluation dates</p>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          {searching
            ? <RefreshCw className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 animate-spin" />
            : <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />}
          <input
            type="search"
            placeholder="Search agent, number, team, DID, feedback…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setDebouncedSearch(search.trim());
              if (e.key === 'Escape') setSearch('');
            }}
            className="w-full h-9 bg-[#0B1120] border border-slate-800 text-xs text-slate-200 pl-9 pr-8 rounded-lg outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 placeholder:text-slate-600 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <SelectWrap>
          <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} className={selectCls}>
            <option value="">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </SelectWrap>

        {!isAgent && qaUsers.length > 0 && (
          <SelectWrap>
            <select value={selectedQa} onChange={(e) => setSelectedQa(e.target.value)} className={selectCls}>
              <option value="">All QA evaluators</option>
              {qaUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </SelectWrap>
        )}

        {hasFilters && (
          <button onClick={clearFilters} className="h-9 px-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors inline-flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 h-9 px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3" /> US EST
          </span>
          <DateRangeDropdown
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={(s, e) => setDateRange({ start: s, end: e })}
          />
        </div>
      </div>

      {/* ── Records ── */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden animate-pulse">
                <div className="h-11 bg-[#0B1120]/60 border-b border-slate-800/70" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-px">
                  <div className="p-4 space-y-2"><div className="h-2.5 w-24 bg-slate-800 rounded" /><div className="h-2.5 w-3/4 bg-slate-800/70 rounded" /><div className="h-2.5 w-1/2 bg-slate-800/70 rounded" /></div>
                  <div className="p-4 space-y-2"><div className="h-2.5 w-24 bg-slate-800 rounded" /><div className="h-2.5 w-2/3 bg-slate-800/70 rounded" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-[#111827] border border-slate-800 rounded-xl py-14 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">No rejected calls</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Nothing rejected for <span className="text-slate-300">{rangeLabel}</span>{hasFilters ? ' with the current filters' : ''}.
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-4 h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          rows.map((r, idx) => {
            const copied = copiedId === r.evaluation_id;
            const viewPath = `/evaluations/view/${r.evaluation_id}`;
            const viewState = { from: '/rejected-calls', fromLabel: 'Back to Rejected Calls' };
            return (
              <article
                key={r.evaluation_id}
                className="group relative bg-[#111827] border border-slate-800 hover:border-rose-500/30 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-rose-950/30"
              >
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-rose-500 to-rose-700/60" />
                {/* Header row */}
                <div className="px-3.5 py-2.5 border-b border-slate-800/70 bg-[#0B1120]/60 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-[10px] font-mono text-slate-600 w-6 shrink-0">#{startIndex + idx + 1}</span>

                  <Link
                    to={viewPath}
                    state={viewState}
                    className="flex items-center gap-2 min-w-0 group/name"
                    title="Open this evaluation"
                  >
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500/30 to-rose-700/30 border border-rose-500/30 text-rose-200 text-[10px] font-black flex items-center justify-center shrink-0">
                      {initialsOf(r.agent_name)}
                    </span>
                    <span className="text-[13px] font-bold text-white capitalize truncate group-hover/name:text-rose-300 group-hover/name:underline decoration-rose-500/50 underline-offset-2 transition-colors">
                      {r.agent_name || '—'}
                    </span>
                  </Link>

                  {r.team && (
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-semibold text-slate-300 uppercase tracking-wide">
                      {r.team}
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-200">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {r.phone || '—'}
                  </span>

                  {r.dids && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/25 text-[10px] font-bold text-indigo-300">
                      <Hash className="w-2.5 h-2.5" /> {r.dids}
                    </span>
                  )}

                  {r.talk_time && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400" title={`Talk time: ${r.talk_time}s`}>
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatTalkTime(r.talk_time)}
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    <XCircle className="w-2.5 h-2.5" /> {r.qa_status || 'Rejected'}
                  </span>

                  {r.la_error_category && (
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/25 text-purple-300 font-medium text-[10px]">
                      {r.la_error_category}
                    </span>
                  )}

                  <span className="ml-auto flex items-center gap-2.5 text-[11px] text-slate-500">
                    {!isAgent && r.qa_name && (
                      <span className="hidden sm:inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-slate-600" />
                        <span className="text-slate-300 capitalize">{r.qa_name}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-slate-600" />
                      {prettyDate(r.evaluation_date)}
                    </span>
                    <Link
                      to={viewPath}
                      state={viewState}
                      className={`h-7 px-2.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
                        r.recording_url
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:text-white'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={r.recording_url ? 'Open evaluation and listen to the recording' : 'Open evaluation (no recording attached)'}
                    >
                      {r.recording_url ? <Play className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                      {r.recording_url ? 'Listen' : 'Open'}
                    </Link>
                    <button
                      onClick={() => handleCopy(r)}
                      className={`h-7 w-7 rounded-lg border flex items-center justify-center transition-colors ${
                        copied
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                      title={copied ? 'Copied' : 'Copy this record as text'}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </span>
                </div>

                {/* Feedback */}
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/70">
                  <section className="px-3.5 py-3 flex gap-3">
                    <span className="w-0.5 rounded-full bg-amber-400/70 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-1 flex items-center gap-1.5">
                        <Headset className="w-3 h-3" /> Agent side
                      </h3>
                      <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                        {r.agent_feedback || <span className="text-slate-600 italic">No agent-side feedback</span>}
                      </p>
                    </div>
                  </section>
                  <section className="px-3.5 py-3 flex gap-3">
                    <span className="w-0.5 rounded-full bg-purple-400/70 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-purple-400/90 mb-1 flex items-center gap-1.5">
                        <ClipboardList className="w-3 h-3" /> LA side
                      </h3>
                      <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                        {r.la_feedback || <span className="text-slate-600 italic">No LA-side feedback</span>}
                      </p>
                    </div>
                  </section>
                </div>
              </article>
            );
          })
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
          <Pagination pagination={pagination} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
