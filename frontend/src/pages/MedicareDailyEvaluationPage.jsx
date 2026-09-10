import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TbDownload, TbRefresh, TbChevronDown, TbInbox, TbSearch, TbX,
  TbClockHour4, TbRotate, TbClipboardText, TbChevronLeft, TbChevronRight,
  TbCircleCheck, TbCircleX, TbFlag, TbUsers, TbUserCheck, TbAlertTriangle,
} from 'react-icons/tb';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import api from '../services/api';
import DateRangeDropdown from '../components/common/DateRangeDropdown';
import { getPresets } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 100;

/**
 * Columns, in the exact order the team keeps them in the Excel workbook.
 * `align` / `type` drive the export so the file opens looking like their sheet.
 */
const COLUMNS = [
  { key: 'evaluation_date', label: 'Date', width: 92, excelWidth: 11, align: 'center', type: 'date' },
  { key: 'agent_name', label: 'Agent Name', width: 150, excelWidth: 20, align: 'center' },
  { key: 'team', label: 'Teams', width: 130, excelWidth: 17, align: 'center' },
  { key: 'phone', label: 'Numbers', width: 120, excelWidth: 15, align: 'center' },
  { key: 'dids', label: 'Dids', width: 70, excelWidth: 8, align: 'center' },
  { key: 'talk_time', label: 'Talktime', width: 82, excelWidth: 10, align: 'center', type: 'number' },
  { key: 'status', label: 'Status', width: 100, excelWidth: 12, align: 'center', type: 'status' },
  { key: 'agent_side', label: 'Agent side', width: 300, excelWidth: 55, align: 'left', wrap: true },
  { key: 'la_side', label: 'LA side', width: 340, excelWidth: 60, align: 'left', wrap: true },
  { key: 'dropping_reason', label: 'Dropping Reason', width: 190, excelWidth: 26, align: 'center', wrap: true, accent: true },
];

function prettyDate(iso) {
  const d = String(iso || '').slice(0, 10);
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: '2-digit',
  });
}

function longDate(iso) {
  const d = String(iso || '').slice(0, 10);
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

const STATUS_STYLES = {
  accepted: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  pass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  rejected: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
  fail: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
  flagged: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  decline: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
  'not billable': 'bg-slate-500/15 border-slate-500/30 text-slate-300',
  'not bilable': 'bg-slate-500/15 border-slate-500/30 text-slate-300',
};

function StatusBadge({ value }) {
  const key = String(value || '').toLowerCase();
  const cls = STATUS_STYLES[key] || 'bg-slate-700/30 border-slate-600/40 text-slate-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${cls}`}>
      {value || '—'}
    </span>
  );
}

const selectCls =
  'h-9 w-full bg-[#0B1120] border border-slate-800 text-xs text-slate-200 pl-3 pr-8 rounded-lg outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500/20 cursor-pointer appearance-none [color-scheme:dark] hover:border-slate-700 transition-colors';

function SelectWrap({ children }) {
  return (
    <div className="relative">
      {children}
      <TbChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5">{label}</span>
      {children}
    </div>
  );
}

/** Deliberately small — the sheet below is the star of this page. */
function KpiCard({ label, value, sub, icon: Icon, tint, title }) {
  return (
    <div
      title={title || label}
      className={`min-w-0 bg-[#111827] border rounded-lg px-2.5 py-2 ${tint.card}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${tint.box}`}>
          <Icon className={`w-3 h-3 ${tint.icon}`} />
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-[0.1em] truncate ${tint.label}`}>{label}</span>
      </div>
      <p className="text-[16px] font-black text-white leading-none tabular-nums truncate">{value}</p>
      {sub && <p className="text-[9.5px] text-slate-500 mt-1 truncate">{sub}</p>}
    </div>
  );
}

const TINT = {
  indigo: { card: 'border-slate-800', box: 'bg-indigo-500/10 border-indigo-500/25', icon: 'text-indigo-400', label: 'text-slate-400' },
  emerald: { card: 'border-slate-800', box: 'bg-emerald-500/10 border-emerald-500/25', icon: 'text-emerald-400', label: 'text-slate-400' },
  rose: { card: 'border-rose-500/25', box: 'bg-rose-500/15 border-rose-500/30', icon: 'text-rose-400', label: 'text-rose-300' },
  amber: { card: 'border-slate-800', box: 'bg-amber-500/10 border-amber-500/25', icon: 'text-amber-400', label: 'text-slate-400' },
  sky: { card: 'border-slate-800', box: 'bg-sky-500/10 border-sky-500/25', icon: 'text-sky-400', label: 'text-slate-400' },
  violet: { card: 'border-slate-800', box: 'bg-violet-500/10 border-violet-500/25', icon: 'text-violet-400', label: 'text-slate-400' },
};

/* ── Excel export styling ─────────────────────────────────────────────── */
const XL_HEADER_FILL = 'FF1F3864';   // navy header band
const XL_ACCENT_FILL = 'FFC6E0B4';   // light green "Dropping Reason" header
const XL_GRID = 'FF8EA9DB';
const XL_BORDER = {
  top: { style: 'thin', color: { argb: XL_GRID } },
  left: { style: 'thin', color: { argb: XL_GRID } },
  bottom: { style: 'thin', color: { argb: XL_GRID } },
  right: { style: 'thin', color: { argb: XL_GRID } },
};
const XL_STATUS_COLOR = {
  accepted: 'FF107C41',
  pass: 'FF107C41',
  rejected: 'FFC00000',
  fail: 'FFC00000',
  flagged: 'FFBF8F00',
  decline: 'FFC55A11',
};

/**
 * Turn "2026-09-10" into a real Date so Excel can sort and format it.
 * Must be UTC midnight: ExcelJS serialises with getTime(), so a local-midnight
 * date east of UTC lands on the previous day's serial (10 Sep would show 9 Sep).
 */
function toExcelDate(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export default function MedicareDailyEvaluationPage() {
  const { user } = useAuth();
  const isAgent = user?.role === 'QA Agent';
  const today = useMemo(() => getPresets().find((p) => p.label === 'Today'), []);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [qaUsers, setQaUsers] = useState([]);
  const [selectedQa, setSelectedQa] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  // QA Agents are locked to their own campaign; everyone else starts on Medicare.
  const [selectedCampaign, setSelectedCampaign] = useState(
    isAgent ? (user?.campaign_name || 'Medicare') : 'Medicare'
  );
  const [dateRange, setDateRange] = useState({ start: today?.start || '', end: today?.end || '' });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (isAgent) return; // agents cannot list campaigns or other users
    api.get('/campaigns').then((res) => setCampaigns(res.data.data ?? [])).catch(() => {});
    api.get('/users', { params: { limit: 100 } })
      .then((res) => {
        const list = Array.isArray(res.data.data) ? res.data.data : [];
        setQaUsers([...list].sort((a, b) => String(a.name).localeCompare(String(b.name))));
      })
      .catch(() => {});
  }, [isAgent]);

  useEffect(() => { setPage(1); }, [debouncedSearch, selectedQa, selectedCampaign, dateRange]);

  const buildParams = useCallback((forExport) => {
    const params = forExport ? { page: 1, limit: 1000 } : { page, limit: PAGE_SIZE };
    if (debouncedSearch) params.search = debouncedSearch;
    if (selectedQa) params.qa_user_id = selectedQa;
    if (selectedCampaign) params.campaign_name = selectedCampaign;
    if (dateRange.start) params.from_date = dateRange.start;
    if (dateRange.end) params.to_date = dateRange.end;
    return params;
  }, [page, debouncedSearch, selectedQa, selectedCampaign, dateRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/evaluations/reports/medicare-daily', { params: buildParams(false) });
      if (res.data.success) {
        setRows(res.data.data ?? []);
        setSummary(res.data.summary ?? null);
        setPagination(res.data.pagination ?? null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load evaluations.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rangeLabel = useMemo(() => {
    if (!dateRange.start) return 'All time';
    if (dateRange.start === dateRange.end) return longDate(dateRange.start);
    return `${longDate(dateRange.start)} – ${longDate(dateRange.end)}`;
  }, [dateRange]);

  const total = summary?.total ?? pagination?.total ?? rows.length;
  const pct = (n) => (total > 0 ? `${Math.round(((n || 0) / total) * 100)}% of total` : '—');
  const totalPages = pagination?.pages ?? 1;
  const startIndex = (page - 1) * PAGE_SIZE;
  const defaultCampaign = isAgent ? (user?.campaign_name || 'Medicare') : 'Medicare';
  const hasFilters = Boolean(debouncedSearch || selectedQa || selectedCampaign !== defaultCampaign);
  const searching = search.trim() !== debouncedSearch;
  const qaLabel = isAgent
    ? (user?.name || 'My evaluations')
    : selectedQa
      ? (qaUsers.find((u) => String(u.id) === String(selectedQa))?.name || 'Selected QA')
      : 'All QA Executives';

  const resetFilters = () => {
    setSearch('');
    setSelectedQa('');
    setSelectedCampaign(defaultCampaign);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get('/evaluations/reports/medicare-daily', { params: buildParams(true) });
      const exportRows = res.data?.data ?? [];
      if (exportRows.length === 0) {
        toast.error('Nothing to export for these filters.');
        return;
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Medicare Daily Evaluation';
      wb.created = new Date();

      const ws = wb.addWorksheet('Daily Evaluation', {
        views: [{ state: 'frozen', ySplit: 1 }],
        pageSetup: {
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        },
      });

      ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.excelWidth }));

      const header = ws.addRow(COLUMNS.map((c) => c.label));
      header.height = 30;
      header.eachCell((cell, col) => {
        const column = COLUMNS[col - 1];
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: column.accent ? XL_ACCENT_FILL : XL_HEADER_FILL },
        };
        cell.font = {
          name: 'Calibri',
          bold: true,
          size: 11,
          color: { argb: column.accent ? 'FF1F3864' : 'FFFFFFFF' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = XL_BORDER;
      });

      exportRows.forEach((row) => {
        const excelRow = ws.addRow(
          COLUMNS.map((c) => {
            const raw = row[c.key];
            if (c.type === 'date') return toExcelDate(raw) ?? '';
            if (c.type === 'number') {
              const n = Number(String(raw ?? '').trim());
              return Number.isFinite(n) && String(raw ?? '').trim() !== '' ? n : (raw ?? '');
            }
            return raw ?? '';
          })
        );

        excelRow.eachCell({ includeEmpty: true }, (cell, col) => {
          const column = COLUMNS[col - 1];
          cell.border = XL_BORDER;
          cell.alignment = {
            wrapText: Boolean(column.wrap),
            vertical: column.wrap ? 'top' : 'middle',
            horizontal: column.align || 'left',
          };

          if (column.type === 'date') cell.numFmt = 'd-mmm-yy';

          // Colour the outcome so a rejected row is obvious at a glance.
          const statusColor = column.type === 'status'
            ? XL_STATUS_COLOR[String(cell.value || '').toLowerCase()]
            : null;
          cell.font = {
            name: 'Calibri',
            size: 10,
            bold: Boolean(statusColor),
            color: { argb: statusColor || 'FF1F2937' },
          };
        });
      });

      // Autofilter over the header so admins can slice it further in Excel.
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
      ws.headerFooter = {
        oddHeader: `&L&"Calibri,Bold"Medicare Daily Evaluation&R&"Calibri,Regular"${rangeLabel}`,
        oddFooter: '&LGenerated from QA Portal&RPage &P of &N',
      };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const tag = `${dateRange.start || 'all'}${dateRange.start === dateRange.end ? '' : `_${dateRange.end || 'all'}`}`;
      link.href = url;
      link.download = `medicare_daily_evaluation_${tag}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${exportRows.length} evaluation${exportRows.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to export Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="font-sans space-y-4 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
            <TbClipboardText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Medicare Daily Evaluation</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isAgent
                ? 'Every evaluation sheet you submitted, exactly as you filled it in.'
                : 'Every evaluation sheet a QA submitted, exactly as filled in.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="h-8 px-2.5 rounded-lg bg-[#111827] border border-slate-800 text-[10px] font-medium text-slate-400 inline-flex items-center gap-1.5">
            <TbClockHour4 className="w-3.5 h-3.5" /> US Eastern
          </span>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            title="Refresh"
            className="h-8 w-8 rounded-lg bg-[#111827] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all flex items-center justify-center"
          >
            <TbRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={exporting || !rows.length}
            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <TbDownload className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Download Excel'}
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Field label="Search">
              <div className="relative">
                {searching
                  ? <TbRefresh className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />
                  : <TbSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />}
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Agent, number, team, DID, reason…"
                  className="h-9 w-full bg-[#0B1120] border border-slate-800 text-xs text-slate-200 pl-9 pr-8 rounded-lg outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500/20 placeholder:text-slate-600 transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  >
                    <TbX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Field>
            <Field label="QA Executive">
              {isAgent ? (
                <div className="h-9 px-3 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 flex items-center truncate capitalize">
                  {user?.name}
                </div>
              ) : (
                <SelectWrap>
                  <select className={selectCls} value={selectedQa} onChange={(e) => setSelectedQa(e.target.value)}>
                    <option className="bg-[#0B1120] text-slate-200" value="">All QA Executives</option>
                    {qaUsers.map((u) => (
                      <option className="bg-[#0B1120] text-slate-200" key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </SelectWrap>
              )}
            </Field>
            <Field label="Campaign">
              {isAgent ? (
                <div className="h-9 px-3 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 flex items-center truncate">
                  {user?.campaign_name || 'Assigned campaign'}
                </div>
              ) : (
                <SelectWrap>
                  <select className={selectCls} value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
                    <option className="bg-[#0B1120] text-slate-200" value="Medicare">Medicare</option>
                    {campaigns
                      .filter((c) => !/medicare/i.test(c.name))
                      .map((c) => (
                        <option className="bg-[#0B1120] text-slate-200" key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    <option className="bg-[#0B1120] text-slate-200" value="all">All Campaigns</option>
                  </select>
                </SelectWrap>
              )}
            </Field>
            <Field label="Reporting Period">
              <div className="[&>div]:w-full [&>div>button]:w-full [&>div>button]:h-9 [&>div>button]:py-0 [&>div>button]:rounded-lg [&>div>button]:bg-[#0B1120]">
                <DateRangeDropdown
                  startDate={dateRange.start}
                  endDate={dateRange.end}
                  onChange={(start, end) => setDateRange({ start, end })}
                />
              </div>
            </Field>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-3 rounded-lg bg-[#0B1120] border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-white hover:border-slate-600 inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
            >
              <TbRotate className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── KPI strip (compact on purpose) ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <KpiCard
          label={isAgent ? 'My Evaluations' : 'Evaluations'}
          value={total}
          sub={rangeLabel}
          icon={TbClipboardText}
          tint={TINT.indigo}
          title={`${total} evaluation sheets submitted`}
        />
        <KpiCard
          label="Accepted"
          value={summary?.accepted ?? 0}
          sub={pct(summary?.accepted)}
          icon={TbCircleCheck}
          tint={TINT.emerald}
        />
        <KpiCard
          label="Rejected"
          value={summary?.rejected ?? 0}
          sub={pct(summary?.rejected)}
          icon={TbCircleX}
          tint={TINT.rose}
        />
        <KpiCard
          label="Flagged"
          value={summary?.flagged ?? 0}
          sub={pct(summary?.flagged)}
          icon={TbFlag}
          tint={TINT.amber}
        />
        <KpiCard
          label="Agents"
          value={summary?.agents ?? 0}
          sub={summary?.teams ? `${summary.teams} team${summary.teams === 1 ? '' : 's'}` : 'In range'}
          icon={TbUsers}
          tint={TINT.sky}
        />
        <KpiCard
          label="Top Reason"
          value={summary?.top_reason?.reason || '—'}
          sub={summary?.top_reason ? `${summary.top_reason.count} call${summary.top_reason.count === 1 ? '' : 's'}` : 'No reason logged'}
          icon={TbAlertTriangle}
          tint={TINT.violet}
          title={summary?.top_reason?.reason || 'No dropping reason recorded'}
        />
      </div>

      {/* ── Scope summary ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <TbUserCheck className="w-3.5 h-3.5 text-slate-600" />
          {qaLabel}
        </span>
        <span className="text-slate-700">·</span>
        <span>{selectedCampaign === 'all' ? 'All Campaigns' : selectedCampaign}</span>
        <span className="text-slate-700">·</span>
        <span>{rangeLabel}</span>
        {!isAgent && summary?.qa_executives > 0 && (
          <>
            <span className="text-slate-700">·</span>
            <span>{summary.qa_executives} QA executive{summary.qa_executives === 1 ? '' : 's'}</span>
          </>
        )}
      </div>

      {/* ── Sheet ── */}
      {loading && !rows.length ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[62px] bg-[#111827] border border-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-[420px] bg-[#111827] border border-slate-800 rounded-xl animate-pulse" />
        </div>
      ) : !rows.length ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto mb-3">
            <TbInbox className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-300">No evaluations submitted</p>
          <p className="text-xs text-slate-500 mt-1">Nothing for {rangeLabel} with the current filters.</p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 h-8 px-3.5 rounded-lg bg-[#0B1120] border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-slate-600 inline-flex items-center gap-1.5 transition-colors"
            >
              <TbRotate className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
          <div className="overflow-auto custom-scrollbar max-h-[calc(100vh-360px)] min-h-[280px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#0B1120]">
                  <th className="sticky left-0 z-30 bg-[#0B1120] px-3 py-2.5 text-left text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-500 border-b border-r border-slate-800 w-[52px]">
                    #
                  </th>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      style={{ minWidth: c.width }}
                      className={`px-3 py-2.5 text-left text-[9.5px] font-bold uppercase tracking-[0.12em] border-b border-slate-800 whitespace-nowrap ${
                        c.accent ? 'text-emerald-300 bg-[#101c19]' : 'text-slate-500 bg-[#0B1120]'
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.evaluation_id}
                    className={`${i % 2 ? 'bg-[#0E1626]' : 'bg-[#111827]'} hover:bg-slate-800/40 transition-colors align-top`}
                  >
                    <td className={`sticky left-0 z-10 px-3 py-2.5 text-[11px] font-semibold tabular-nums text-slate-500 border-b border-r border-slate-800/70 ${i % 2 ? 'bg-[#0E1626]' : 'bg-[#111827]'}`}>
                      {startIndex + i + 1}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-slate-300 whitespace-nowrap border-b border-slate-800/70">
                      {prettyDate(row.evaluation_date)}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] font-semibold text-white capitalize border-b border-slate-800/70">
                      {row.agent_name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-slate-300 border-b border-slate-800/70">
                      {row.team || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] font-mono text-slate-200 whitespace-nowrap border-b border-slate-800/70">
                      {row.phone || '—'}
                      {row.dup && row.dup !== '1' && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-bold">
                          x{row.dup}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-slate-300 text-center border-b border-slate-800/70">
                      {row.dids || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-slate-300 text-center tabular-nums whitespace-nowrap border-b border-slate-800/70">
                      {row.talk_time || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center border-b border-slate-800/70">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-slate-300 leading-relaxed border-b border-slate-800/70">
                      {row.agent_side
                        ? <span className="line-clamp-4">{row.agent_side}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-slate-300 leading-relaxed border-b border-slate-800/70">
                      {row.la_side
                        ? <span className="line-clamp-4">{row.la_side}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] font-medium text-emerald-200 bg-emerald-500/[0.04] leading-relaxed border-b border-slate-800/70">
                      {row.dropping_reason || <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-slate-800 bg-[#0B1120]">
              <p className="text-[11px] text-slate-500">
                Showing <span className="text-slate-300 font-semibold">{startIndex + 1}–{startIndex + rows.length}</span> of{' '}
                <span className="text-slate-300 font-semibold">{total}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 px-2.5 rounded-lg bg-[#111827] border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-40 inline-flex items-center gap-1 transition-colors"
                >
                  <TbChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-[11px] text-slate-500 tabular-nums">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 px-2.5 rounded-lg bg-[#111827] border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-40 inline-flex items-center gap-1 transition-colors"
                >
                  Next <TbChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-600">
        {isAgent
          ? 'Read-only view of the evaluation sheets you submitted.'
          : 'Read-only view of submitted evaluation sheets.'}
      </p>
    </div>
  );
}
