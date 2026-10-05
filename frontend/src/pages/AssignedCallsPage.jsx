import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Search, RefreshCw, Phone, UserMinus, Users, Inbox,
  ChevronDown, ChevronRight, ShieldCheck, Clock, CheckCircle2, XCircle,
  CheckSquare, Square,
} from 'lucide-react';
import DateRangeDropdown from '../components/common/DateRangeDropdown';
import { ConfirmModal } from '../components/ui';
import { getEstDateString, getEstDateTimeString } from '../utils/dateUtils';
import { copyText } from '../utils/clipboard';

const STATUS_META = {
  pending:   { icon: Clock,        cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300',       label: 'Pending' },
  accepted:  { icon: ShieldCheck,  cls: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',    label: 'In progress' },
  rejected:  { icon: XCircle,      cls: 'bg-rose-500/10 border-rose-500/30 text-rose-300',          label: 'Rejected' },
  completed: { icon: CheckCircle2, cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300', label: 'Completed' },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap ${meta.cls}`}>
      <Icon className="w-3 h-3" />{meta.label}
    </span>
  );
};

const isLocked = (row) => Boolean(row.evaluation_id) || row.status === 'completed' || row.effective_status === 'completed';

const initialsOf = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || '?';

export default function AssignedCallsPage() {
  const today = useMemo(() => getEstDateString(new Date()), []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [agentId, setAgentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [collapsed, setCollapsed] = useState({});
  const [pendingRemove, setPendingRemove] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const all = [];
      let page = 1;
      let pages = 1;
      let nextStats = {};
      do {
        const res = await api.get('/assignments', {
          params: {
            page,
            limit: 200,
            start_date: startDate,
            end_date: endDate,
          },
        });
        all.push(...(res.data.data || []));
        nextStats = res.data.stats || nextStats;
        pages = res.data.pagination?.pages || 1;
        page += 1;
      } while (page <= pages && page <= 25);
      setAssignments(all);
      setStats(nextStats);
      setSelectedIds((prev) => {
        const valid = new Set(all.map((row) => row.id));
        const next = new Set([...prev].filter((id) => valid.has(id) && !isLocked(all.find((row) => row.id === id) || {})));
        return next.size === prev.size ? prev : next;
      });
    } catch {
      toast.error('Failed to load assigned calls.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const changeRange = (start, end) => {
    setStartDate(start || today);
    setEndDate(end || start || today);
    setAgentId('');
    setSelectedIds(new Set());
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMany = (rows, on) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => {
        if (isLocked(row)) return;
        if (on) next.add(row.id);
        else next.delete(row.id);
      });
      return next;
    });
  };

  const agents = useMemo(() => {
    const map = new Map();
    assignments.forEach((row) => {
      const key = String(row.assigned_to);
      if (!map.has(key)) {
        map.set(key, { id: key, name: row.assigned_to_name || 'Unknown agent', email: row.assigned_to_email || '' });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments]);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = assignments.filter((row) => {
      if (agentId && String(row.assigned_to) !== agentId) return false;
      const status = row.effective_status || row.status;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!query) return true;
      return [row.customer_phone, row.agent_name, row.campaign_name, row.assigned_to_name, row.assigned_by_name, row.disposition]
        .some((value) => (value || '').toLowerCase().includes(query));
    });

    const map = new Map();
    filtered.forEach((row) => {
      const key = String(row.assigned_to);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: row.assigned_to_name || 'Unknown agent',
          email: row.assigned_to_email || '',
          leads: [],
        });
      }
      map.get(key).leads.push(row);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments, agentId, statusFilter, search]);

  const askRemove = (rows) => {
    const open = rows.filter((row) => !isLocked(row));
    if (!open.length) {
      toast.error('Evaluated leads stay assigned.');
      return;
    }
    setPendingRemove(open);
  };

  const confirmRemove = async () => {
    const rows = pendingRemove || [];
    if (!rows.length) return;
    try {
      if (rows.length === 1) {
        await api.delete(`/assignments/${rows[0].id}`);
        toast.success('Assignment removed. The lead is back in the pool.');
      } else {
        const res = await api.post('/assignments/unassign', { ids: rows.map((row) => row.id) });
        toast.success(res.data.message || 'Assignments removed.');
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rows.forEach((row) => next.delete(row.id));
        return next;
      });
      setPendingRemove(null);
      await fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove the assignment.');
    }
  };

  const rangeLabel = startDate === endDate ? startDate : `${startDate} → ${endDate}`;
  const isToday = startDate === today && endDate === today;
  const visibleCount = groups.reduce((sum, group) => sum + group.leads.length, 0);

  const statusTabs = [
    { key: 'all', label: 'All', value: stats.total },
    { key: 'pending', label: 'Pending', value: stats.pending },
    { key: 'accepted', label: 'In progress', value: stats.accepted },
    { key: 'completed', label: 'Completed', value: stats.completed },
    { key: 'rejected', label: 'Rejected', value: stats.rejected },
  ];

  const selectedRows = useMemo(
    () => assignments.filter((row) => selectedIds.has(row.id) && !isLocked(row)),
    [assignments, selectedIds]
  );

  const removeCount = pendingRemove?.length || 0;
  const removeNames = [...new Set((pendingRemove || []).map((row) => row.assigned_to_name).filter(Boolean))];
  const removeMessage = removeCount <= 1
    ? `Remove ${pendingRemove?.[0]?.customer_phone || 'this lead'} from ${removeNames[0] || 'this agent'}? It goes back to the unassigned pool and can be assigned again.`
    : removeNames.length > 1
      ? `Remove ${removeCount} selected leads across ${removeNames.length} agents? They go back to the unassigned pool.`
      : `Remove ${removeCount} selected leads from ${removeNames[0]}? They go back to the unassigned pool.`;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Assigned Calls</h1>
          <p className="text-slate-400 text-xs mt-1 max-w-xl">
            Leads handed to each QA agent, grouped by agent. Times follow US Eastern (America/New_York).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeDropdown startDate={startDate} endDate={endDate} onChange={changeRange} />
          <button
            type="button"
            onClick={fetchAssignments}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 bg-[#0d1117] border border-white/10 text-slate-300 rounded-xl text-xs font-medium hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <div className="rounded-xl bg-[#0d1117] border border-white/[0.06] px-4 py-3">
          <p className="text-2xl font-semibold tracking-tight leading-none text-amber-300">{agents.length}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">QA agents</p>
        </div>
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-xl px-4 py-3 text-left border transition-colors ${
              statusFilter === tab.key
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-[#0d1117] border-white/[0.06] hover:border-white/15'
            }`}
          >
            <p className="text-2xl font-semibold tracking-tight leading-none text-white">{tab.value ?? 0}</p>
            <p className="text-[11px] text-slate-500 mt-1.5">{tab.label}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-[#0d1117] border border-white/[0.06]">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5 p-3 border-b border-white/[0.06]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone, call agent, campaign, or QA agent"
              className="w-full bg-[#080B11] border border-white/10 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder:text-slate-600"
            />
          </div>
          <div className="relative md:w-56">
            <Users className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full appearance-none bg-[#080B11] border border-white/10 text-slate-200 text-xs rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              <option value="">All QA agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-amber-200 whitespace-nowrap">{selectedRows.length} selected</span>
              <button
                type="button"
                onClick={() => askRemove(selectedRows)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[11px] font-semibold hover:bg-rose-500/20 transition-colors"
              >
                <UserMinus className="w-3.5 h-3.5" />
                Remove selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-2 rounded-xl text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-56 flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 border-2 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Loading assigned calls…</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
              <Inbox className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                {search || agentId || statusFilter !== 'all' ? 'No matching assignments' : 'No assigned calls'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {search || agentId || statusFilter !== 'all'
                  ? 'Try another agent, status, or search.'
                  : isToday
                    ? 'Nothing has been assigned today yet. New assignments show up here as soon as they are handed out.'
                    : `No assignments were recorded for ${rangeLabel}.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2.5">
            <p className="px-1 text-[11px] text-slate-500">
              {visibleCount} lead{visibleCount === 1 ? '' : 's'} across {groups.length} agent{groups.length === 1 ? '' : 's'}
              {isToday ? ' today' : ` · ${rangeLabel}`}
            </p>
            {groups.map((group) => {
              const open = collapsed[group.id] !== true;
              const releasable = group.leads.filter((row) => !isLocked(row));
              const groupSelected = releasable.filter((row) => selectedIds.has(row.id)).length;
              const groupAllSelected = releasable.length > 0 && groupSelected === releasable.length;
              return (
                <div key={group.id} className="border border-white/5 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 p-3 hover:bg-white/[0.02]">
                    <button
                      type="button"
                      onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: prev[group.id] !== true }))}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <span className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {initialsOf(group.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-white truncate">{group.name}</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5 truncate">
                          {group.leads.length} assigned{group.email ? ` · ${group.email}` : ''}
                        </span>
                      </span>
                    </button>
                    {groupSelected > 0 && (
                      <button
                        type="button"
                        onClick={() => askRemove(releasable.filter((row) => selectedIds.has(row.id)))}
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-300 text-[11px] font-medium hover:bg-rose-500/20 transition-colors shrink-0"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Remove {groupSelected}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: prev[group.id] !== true }))}
                      className="w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 flex items-center justify-center shrink-0"
                      aria-label={open ? 'Collapse agent' : 'Expand agent'}
                    >
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {open && (
                    <div className="border-t border-white/5">
                      <table className="w-full text-left border-collapse min-w-[920px]">
                        <thead>
                          <tr className="bg-white/[0.02]">
                            <th className="py-2.5 px-3 w-10 border-b border-white/5">
                              <button
                                type="button"
                                disabled={releasable.length === 0}
                                onClick={() => toggleMany(releasable, !groupAllSelected)}
                                className="text-slate-500 hover:text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                title={groupAllSelected ? 'Clear this agent' : 'Select open leads for this agent'}
                              >
                                {groupAllSelected
                                  ? <CheckSquare className="w-3.5 h-3.5 text-amber-300" />
                                  : <Square className="w-3.5 h-3.5" />}
                              </button>
                            </th>
                            {['Phone', 'Campaign', 'Call agent', 'Status', 'Assigned by', 'Assigned', ''].map((heading) => (
                              <th
                                key={heading || 'action'}
                                className={`py-2.5 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-white/5 ${heading === '' ? 'text-right' : ''}`}
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {group.leads.map((row) => {
                            const status = row.effective_status || row.status;
                            const locked = isLocked(row);
                            const checked = selectedIds.has(row.id);
                            return (
                              <tr key={row.id} className={`transition-colors ${checked ? 'bg-amber-500/[0.06]' : 'hover:bg-white/[0.02]'}`}>
                                <td className="py-3 px-3">
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => toggleSelected(row.id)}
                                    title={locked ? 'Already evaluated' : 'Select lead'}
                                    className="text-slate-500 hover:text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    {checked
                                      ? <CheckSquare className="w-3.5 h-3.5 text-amber-300" />
                                      : <Square className="w-3.5 h-3.5" />}
                                  </button>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!row.customer_phone) return;
                                      const ok = await copyText(row.customer_phone);
                                      ok ? toast.success(`Copied ${row.customer_phone}`) : toast.error('Copy failed.');
                                    }}
                                    className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-100 hover:text-amber-300"
                                    title="Copy phone"
                                  >
                                    <Phone className="w-3 h-3 text-slate-500" />
                                    {row.customer_phone || '—'}
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-xs text-amber-200/90 whitespace-nowrap">{row.campaign_name || '—'}</td>
                                <td className="py-3 px-4 text-xs text-slate-300">{row.agent_name || '—'}</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <StatusBadge status={status} />
                                    {row.evaluation_status && (
                                      <span className="text-[10px] text-slate-400">{row.evaluation_status}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">{row.assigned_by_name || '—'}</td>
                                <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                                  {row.assigned_at ? getEstDateTimeString(row.assigned_at) : '—'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => askRemove([row])}
                                    title={locked ? 'Already evaluated. This assignment stays.' : 'Remove assignment'}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                                  >
                                    <UserMinus className="w-3 h-3" />
                                    {locked ? 'Evaluated' : 'Remove'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {groupSelected > 0 && (
                        <div className="sm:hidden p-3 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => askRemove(releasable.filter((row) => selectedIds.has(row.id)))}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-300 text-xs font-medium"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Remove {groupSelected} selected
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(pendingRemove?.length)}
        title={removeCount === 1 ? 'Remove assignment' : 'Release assigned leads'}
        message={removeMessage}
        danger
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
