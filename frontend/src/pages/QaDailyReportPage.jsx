import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TbDownload, TbRefresh, TbChevronDown, TbInbox,
  TbDeviceFloppy, TbClockHour4, TbArrowLeft, TbArrowsMaximize,
  TbPhoneCall, TbCircleCheck, TbCircleX, TbFlag,
  TbUsers, TbHeadset, TbFileSpreadsheet, TbRotate,
  TbUsersGroup,
} from 'react-icons/tb';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import api from '../services/api';
import DateRangeDropdown from '../components/common/DateRangeDropdown';
import { getPresets } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { campaignFamily } from '../utils/campaignAccess';

const ENVIRONMENT = 'QA / Production';

function prettyDate(iso) {
  const d = String(iso || '').slice(0, 10);
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

const pct = (n) => `${(Number(n) || 0).toFixed(2)}%`;

const KPI_ROWS = (src) => [
  { label: 'Agent-side Calls Evaluated', value: src.agent_side },
  { label: 'LA-side Calls Evaluated', value: src.la_side },
  { label: 'Total Calls Evaluated', value: src.total, strong: true },
  { label: 'Accepted', value: src.accepted, tone: 'text-emerald-300' },
  { label: 'Rejected', value: src.rejected, tone: 'text-rose-300' },
  { label: 'Flagged', value: src.flagged, tone: 'text-amber-300' },
  { label: 'Pass Rate', value: pct(src.pass_rate), tone: 'text-emerald-300' },
  { label: 'Fail Rate', value: pct(src.fail_rate), tone: 'text-rose-300' },
];

const selectCls =
  'h-9 w-full bg-[#0B1120] border border-slate-800 text-xs text-slate-200 pl-3 pr-8 rounded-lg outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500/20 cursor-pointer appearance-none [color-scheme:dark] hover:border-slate-700 transition-colors';

function SelectWrap({ children }) {
  return (
    <div className="relative">
      {children}
      <TbChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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

function initialsOf(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || '?';
}

function SectionBanner({ children, compact }) {
  return (
    <div className={`bg-[#0B1120] text-slate-400 font-bold uppercase border-y border-slate-800 ${compact ? 'text-[9px] tracking-[0.14em] px-3 py-1.5' : 'text-[10px] tracking-[0.16em] px-4 py-2'}`}>
      {children}
    </div>
  );
}

function ExcelReport({
  title = 'Daily QA Report',
  period, executive, campaign, environment, stats,
  summary, onSummaryChange, onSave, saving, dirty,
  compact = false,
  onOpen,
}) {
  const rows = KPI_ROWS(stats);
  const cell = compact ? 'px-3 py-[5px] text-[11px]' : 'px-4 py-2 text-[13px]';
  return (
    <div className="bg-[#111827] text-slate-200 overflow-hidden border border-slate-800 rounded-xl h-full flex flex-col shadow-lg shadow-black/20 transition-colors hover:border-slate-700">
      {compact ? (
        <div className="bg-gradient-to-r from-[#0B1120] via-[#131d33] to-[#0B1120] border-b border-slate-800 px-3 py-2.5 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0">
            {initialsOf(executive)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white truncate capitalize">{title}</p>
            <p className="text-[10px] text-slate-400 truncate">{campaign} · {period}</p>
          </div>
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              title="Open full report"
              className="h-7 w-7 rounded-lg bg-[#111827] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 flex items-center justify-center shrink-0 transition-colors"
            >
              <TbArrowsMaximize className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-r from-[#0B1120] via-[#131d33] to-[#0B1120] border-b border-slate-800 py-3 text-center">
          <p className="text-[15px] font-bold text-white tracking-tight">Daily QA Report</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{campaign} · {period}</p>
        </div>
      )}

      {!compact && (
        <table className="w-full border-collapse">
          <tbody>
            {[
              ['Reporting Period', period],
              ['QA Executive', executive],
              ['Campaign', campaign],
              ['Environment', environment],
            ].map(([label, value], i) => (
              <tr key={label} className={i % 2 ? 'bg-[#0E1626]' : 'bg-[#111827]'}>
                <td className={`w-[42%] border-b border-slate-800/70 font-medium text-slate-400 ${cell}`}>{label}</td>
                <td className={`border-b border-slate-800/70 text-slate-100 truncate ${cell}`}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SectionBanner compact={compact}>Daily Totals</SectionBanner>
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={i % 2 ? 'bg-[#0E1626]' : 'bg-[#111827]'}>
              <td className={`border-b border-slate-800/70 ${cell} ${row.strong ? 'font-semibold text-white' : 'text-slate-400'}`}>{row.label}</td>
              <td className={`border-b border-slate-800/70 text-right tabular-nums font-semibold ${cell} ${row.strong ? 'text-white' : row.tone || 'text-slate-200'}`}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionBanner compact={compact}>Summary</SectionBanner>
      <div className={`bg-[#0E1626] flex-1 ${compact ? 'p-2.5' : 'p-4'}`}>
        <textarea
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          placeholder="Write the daily summary here…"
          rows={compact ? 3 : 6}
          className={`w-full resize-y bg-[#111827] border border-slate-800 rounded-lg leading-relaxed text-slate-200 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500/20 placeholder:text-slate-600 transition-colors ${compact ? 'min-h-[62px] px-2.5 py-2 text-[11px]' : 'min-h-[130px] px-3 py-2.5 text-[13px]'}`}
        />
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-[10px] text-slate-600">
            {dirty ? 'Unsaved changes' : summary ? 'Saved' : 'Not written yet'}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="h-8 px-3.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 transition-colors"
          >
            <TbDeviceFloppy className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Summary'}
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, tint }) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-4 border ${tint.card}`}>
      <Icon className={`absolute -right-3 -bottom-3 w-20 h-20 pointer-events-none ${tint.wash}`} />
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${tint.box}`}>
          <Icon className={`w-3.5 h-3.5 ${tint.icon}`} />
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${tint.label}`}>{label}</span>
      </div>
      <p className="relative text-2xl font-black text-white leading-none tabular-nums">{value}</p>
      {sub && <p className="relative text-[10px] text-slate-500 mt-1.5 truncate">{sub}</p>}
    </div>
  );
}

const TINT = {
  sky: {
    card: 'bg-gradient-to-br from-sky-500/15 via-[#111827] to-[#111827] border-sky-500/30',
    box: 'bg-sky-500/15 border-sky-500/30',
    icon: 'text-sky-400',
    label: 'text-sky-300',
    wash: 'text-sky-500/10',
  },
  slateSky: {
    card: 'bg-[#111827] border-slate-800',
    box: 'bg-sky-500/10 border-sky-500/25',
    icon: 'text-sky-400',
    label: 'text-slate-400',
    wash: 'text-slate-500/[0.06]',
  },
  emerald: {
    card: 'bg-[#111827] border-slate-800',
    box: 'bg-emerald-500/10 border-emerald-500/25',
    icon: 'text-emerald-400',
    label: 'text-slate-400',
    wash: 'text-slate-500/[0.06]',
  },
  rose: {
    card: 'bg-gradient-to-br from-rose-500/15 via-[#111827] to-[#111827] border-rose-500/30',
    box: 'bg-rose-500/15 border-rose-500/30',
    icon: 'text-rose-400',
    label: 'text-rose-300',
    wash: 'text-rose-500/10',
  },
  amber: {
    card: 'bg-[#111827] border-slate-800',
    box: 'bg-amber-500/10 border-amber-500/25',
    icon: 'text-amber-400',
    label: 'text-slate-400',
    wash: 'text-slate-500/[0.06]',
  },
  violet: {
    card: 'bg-[#111827] border-slate-800',
    box: 'bg-violet-500/10 border-violet-500/25',
    icon: 'text-violet-400',
    label: 'text-slate-400',
    wash: 'text-slate-500/[0.06]',
  },
};

const EXCEL_GREEN = 'FF3F7D4A';
const EXCEL_PALE = 'FFE8F5E9';
const EXCEL_WHITE = 'FFFFFFFF';
const EXCEL_BORDER = {
  top: { style: 'thin', color: { argb: 'FFC5D0C5' } },
  left: { style: 'thin', color: { argb: 'FFC5D0C5' } },
  bottom: { style: 'thin', color: { argb: 'FFC5D0C5' } },
  right: { style: 'thin', color: { argb: 'FFC5D0C5' } },
};

function paintPair(ws, row, fill, font, align) {
  [1, 2].forEach((col) => {
    const cell = ws.getCell(row, col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = font;
    cell.alignment = align;
    cell.border = EXCEL_BORDER;
  });
}

function addStyledReportSheet(wb, name, { period, executive, campaign, stats, summary }) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 38 }, { width: 20 }];
  ws.views = [{ showGridLines: false }];

  const bannerFont = { name: 'Calibri', bold: true, color: { argb: EXCEL_WHITE }, size: 14 };
  const labelFont = { name: 'Calibri', size: 11, color: { argb: 'FF1F2937' } };
  const valueFont = { name: 'Calibri', size: 11, color: { argb: 'FF111827' } };
  const strongFont = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF111827' } };

  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = 'Daily QA Report';
  ws.getRow(1).height = 26;
  paintPair(ws, 1, EXCEL_GREEN, bannerFont, { horizontal: 'center', vertical: 'middle' });

  [
    ['Reporting Period', period],
    ['QA Executive', executive],
    ['Campaign', campaign],
    ['Environment', ENVIRONMENT],
  ].forEach(([label, value], i) => {
    const r = i + 2;
    const pale = i % 2 === 1;
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 2).value = value;
    paintPair(
      ws,
      r,
      pale ? EXCEL_PALE : EXCEL_WHITE,
      labelFont,
      { vertical: 'middle', horizontal: 'left' },
    );
    ws.getCell(r, 1).font = { ...labelFont, bold: true };
    ws.getCell(r, 2).font = valueFont;
    ws.getRow(r).height = 20;
  });

  ws.mergeCells('A7:B7');
  ws.getCell('A7').value = 'Daily Totals';
  ws.getRow(7).height = 24;
  paintPair(ws, 7, EXCEL_GREEN, bannerFont, { horizontal: 'center', vertical: 'middle' });

  ws.getCell('A8').value = 'KPI';
  ws.getCell('B8').value = 'Total';
  paintPair(ws, 8, EXCEL_PALE, { ...strongFont, size: 11 }, { vertical: 'middle' });
  ws.getCell('B8').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(8).height = 20;

  KPI_ROWS(stats).forEach((row, i) => {
    const r = 9 + i;
    ws.getCell(r, 1).value = row.label;
    ws.getCell(r, 2).value = row.value;
    paintPair(
      ws,
      r,
      i % 2 ? EXCEL_PALE : EXCEL_WHITE,
      row.strong ? strongFont : labelFont,
      { vertical: 'middle' },
    );
    ws.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 20;
  });

  ws.mergeCells('A18:B18');
  ws.getCell('A18').value = 'Summary';
  ws.getRow(18).height = 24;
  paintPair(ws, 18, EXCEL_GREEN, bannerFont, { horizontal: 'center', vertical: 'middle' });

  ws.mergeCells('A19:B19');
  ws.getCell('A19').value = summary || '';
  ws.getRow(19).height = 96;
  paintPair(ws, 19, EXCEL_PALE, { name: 'Calibri', size: 11, color: { argb: 'FF1F2937' } }, {
    wrapText: true,
    vertical: 'top',
    horizontal: 'left',
  });
}

function campaignForUser(user, campaigns) {
  const name = user?.campaign_name || '';
  if (!name) return '';
  const exact = campaigns.find((c) => c.name === name);
  if (exact) return exact.name;
  const family = campaignFamily(name);
  if (family) {
    const match = campaigns.find((c) => campaignFamily(c.name) === family);
    if (match) return match.name;
  }
  return name;
}

function safeSheetName(raw, used) {
  let name = String(raw || 'QA').replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || 'QA';
  let n = 2;
  while (used.has(name.toLowerCase())) name = `${name.slice(0, 25)} ${n++}`;
  used.add(name.toLowerCase());
  return name;
}

export default function QaDailyReportPage() {
  const { user } = useAuth();
  const isAgent = user?.role === 'QA Agent';
  const today = useMemo(() => getPresets().find((p) => p.label === 'Today'), []);

  const [agents, setAgents] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(isAgent ? (user?.campaign_name || '') : '');
  const [qaUsers, setQaUsers] = useState([]);
  const [selectedQa, setSelectedQa] = useState('');
  const [dateRange, setDateRange] = useState({ start: today?.start || '', end: today?.end || '' });
  const [summaries, setSummaries] = useState({});
  const [savedSummaries, setSavedSummaries] = useState({});
  const [savingKey, setSavingKey] = useState(null);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCampaign) params.campaign_name = selectedCampaign;
      if (selectedQa) params.qa_user_id = selectedQa;
      if (dateRange.start) params.from_date = dateRange.start;
      if (dateRange.end) params.to_date = dateRange.end;
      const res = await api.get('/evaluations/reports/daily', { params });
      if (res.data.success) {
        setAgents(res.data.agents || []);
        setTotals(res.data.totals || null);
        const loaded = res.data.summaries || {};
        setSummaries(loaded);
        setSavedSummaries(loaded);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load QA daily report.');
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, selectedQa, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pickQa = (id, fallbackCampaign = '') => {
    setSelectedQa(id);
    if (!id) {
      setSelectedCampaign('');
      return;
    }
    const u = qaUsers.find((x) => String(x.id) === String(id));
    setSelectedCampaign(campaignForUser(u, campaigns) || fallbackCampaign || '');
  };

  const rangeLabel = useMemo(() => {
    if (!dateRange.start) return 'All time';
    if (dateRange.start === dateRange.end) return prettyDate(dateRange.start);
    return `${prettyDate(dateRange.start)} – ${prettyDate(dateRange.end)}`;
  }, [dateRange]);

  const filterCampaignLabel = selectedCampaign || (isAgent ? (user?.campaign_name || 'Assigned Campaign') : 'All Campaigns');
  const agentCampaignLabel = (a) => a.campaign_name || selectedCampaign || 'Unassigned';
  const focused = Boolean(selectedQa) || isAgent;
  const focusAgent = agents[0] || null;
  const kpiSrc = focused && focusAgent ? focusAgent : totals;

  const summaryKey = (qaUserId) => String(qaUserId ?? 0);
  const draftOf = (qaUserId) => summaries[summaryKey(qaUserId)] ?? '';
  const isDirty = (qaUserId) => (summaries[summaryKey(qaUserId)] ?? '') !== (savedSummaries[summaryKey(qaUserId)] ?? '');

  const saveSummary = async (qaUserId) => {
    const key = summaryKey(qaUserId);
    setSavingKey(key);
    try {
      await api.put('/evaluations/reports/daily/summary', {
        qa_user_id: qaUserId,
        from_date: dateRange.start || null,
        to_date: dateRange.end || null,
        campaign_name: selectedCampaign || '',
        summary: summaries[key] || '',
      });
      setSavedSummaries((prev) => ({ ...prev, [key]: summaries[key] || '' }));
      toast.success('Summary saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save summary.');
    } finally {
      setSavingKey(null);
    }
  };

  const setDraft = (qaUserId, value) => {
    const key = summaryKey(qaUserId);
    setSummaries((prev) => ({ ...prev, [key]: value }));
  };

  const exportExcel = async () => {
    if (!agents.length) return toast.error('No data to export.');
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'QA Daily Report';
      const used = new Set();

      if (agents.length > 1 && totals) {
        addStyledReportSheet(wb, safeSheetName('Team', used), {
          period: rangeLabel,
          executive: 'All QA Executives',
          campaign: filterCampaignLabel,
          stats: totals,
          summary: draftOf(0),
        });
      }

      agents.forEach((a) => {
        addStyledReportSheet(wb, safeSheetName(a.qa_name, used), {
          period: rangeLabel,
          executive: a.qa_name,
          campaign: agentCampaignLabel(a),
          stats: a,
          summary: draftOf(a.qa_user_id),
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileTag = `${dateRange.start || 'all'}${dateRange.start === dateRange.end ? '' : `_${dateRange.end || 'all'}`}`;
      a.href = url;
      a.download = `qa_daily_report_${fileTag}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Report exported to Excel');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel.');
    }
  };

  const hasFilters = Boolean(selectedQa || selectedCampaign);
  const resetFilters = () => { setSelectedQa(''); setSelectedCampaign(''); };

  return (
    <div className="font-sans space-y-4 pb-10 max-w-[1280px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <TbFileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">QA Daily Report</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Every evaluated call counts twice — once agent-side and once LA-side.
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
            <TbRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={!agents.length}
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
          >
            <TbDownload className="w-4 h-4" /> Download Excel
          </button>
        </div>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label="QA Executive">
              {!isAgent ? (
                <SelectWrap>
                  <select className={selectCls} value={selectedQa} onChange={(e) => pickQa(e.target.value)}>
                    <option className="bg-[#0B1120] text-slate-200" value="">All QA Executives</option>
                    {qaUsers.map((u) => <option className="bg-[#0B1120] text-slate-200" key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </SelectWrap>
              ) : (
                <div className="h-9 px-3 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 flex items-center truncate capitalize">
                  {user?.name}
                </div>
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
                    <option className="bg-[#0B1120] text-slate-200" value="">All Campaigns</option>
                    {campaigns.map((c) => <option className="bg-[#0B1120] text-slate-200" key={c.id} value={c.name}>{c.name}</option>)}
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
          {!isAgent && hasFilters && (
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

      {loading && !totals ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[104px] bg-[#111827] border border-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-[420px] bg-[#111827] border border-slate-800 rounded-2xl animate-pulse" />
        </div>
      ) : !agents.length ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto mb-3">
            <TbInbox className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-300">No evaluations in this period</p>
          <p className="text-xs text-slate-500 mt-1">Try a different date range or campaign.</p>
          {!isAgent && hasFilters && (
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              label="Total Evaluated"
              value={kpiSrc?.total ?? 0}
              sub="Agent + LA side"
              icon={TbPhoneCall}
              tint={TINT.sky}
            />
            <KpiCard
              label="Agent-side"
              value={kpiSrc?.agent_side ?? 0}
              sub="Unique calls reviewed"
              icon={TbHeadset}
              tint={TINT.violet}
            />
            <KpiCard
              label="LA-side"
              value={kpiSrc?.la_side ?? 0}
              sub="Same calls, LA review"
              icon={TbUsers}
              tint={TINT.slateSky}
            />
            <KpiCard
              label="Accepted"
              value={kpiSrc?.accepted ?? 0}
              sub={`${pct(kpiSrc?.pass_rate)} pass rate`}
              icon={TbCircleCheck}
              tint={TINT.emerald}
            />
            <KpiCard
              label="Rejected"
              value={kpiSrc?.rejected ?? 0}
              sub={`${pct(kpiSrc?.fail_rate)} fail rate`}
              icon={TbCircleX}
              tint={TINT.rose}
            />
            <KpiCard
              label="Flagged"
              value={kpiSrc?.flagged ?? 0}
              sub="Marked for review"
              icon={TbFlag}
              tint={TINT.amber}
            />
          </div>

          {focused ? (
            <div className="max-w-[880px] mx-auto space-y-3">
              {!isAgent && (
                <button
                  type="button"
                  onClick={() => pickQa('')}
                  className="h-8 px-3 rounded-lg bg-[#111827] border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-white hover:border-slate-600 inline-flex items-center gap-1.5 transition-colors"
                >
                  <TbArrowLeft className="w-3.5 h-3.5" /> All QA executives
                </button>
              )}
              <ExcelReport
                period={rangeLabel}
                executive={focusAgent?.qa_name || user?.name}
                campaign={focusAgent ? agentCampaignLabel(focusAgent) : filterCampaignLabel}
                environment={ENVIRONMENT}
                stats={focusAgent || totals}
                summary={draftOf(focusAgent?.qa_user_id)}
                onSummaryChange={(v) => setDraft(focusAgent?.qa_user_id, v)}
                onSave={() => saveSummary(focusAgent?.qa_user_id)}
                saving={savingKey === summaryKey(focusAgent?.qa_user_id)}
                dirty={isDirty(focusAgent?.qa_user_id)}
              />
            </div>
          ) : (
            <>
              {totals && (
                <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
                  <div className="bg-gradient-to-r from-[#0B1120] via-[#131d33] to-[#0B1120] px-3 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/25 flex items-center justify-center shrink-0">
                        <TbUsersGroup className="w-[18px] h-[18px] text-violet-300" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-white">Team Summary</p>
                        <p className="text-[10px] text-slate-400 truncate">{filterCampaignLabel} · {rangeLabel}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveSummary(0)}
                      disabled={savingKey === '0' || !isDirty(0)}
                      className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <TbDeviceFloppy className="w-4 h-4" />
                      {savingKey === '0' ? 'Saving…' : 'Save Summary'}
                    </button>
                  </div>
                  <div className="p-3">
                    <textarea
                      value={draftOf(0)}
                      onChange={(e) => setDraft(0, e.target.value)}
                      placeholder="Write the daily team summary here…"
                      rows={3}
                      className="w-full resize-y min-h-[76px] bg-[#0B1120] border border-slate-800 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed text-slate-200 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500/20 placeholder:text-slate-600 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  QA Executives · {agents.length}
                </p>
                <p className="text-[10px] text-slate-600">Open a card for the full report</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {agents.map((a) => (
                  <ExcelReport
                    key={a.qa_user_id}
                    title={a.qa_name}
                    compact
                    onOpen={() => pickQa(String(a.qa_user_id), a.campaign_name)}
                    period={rangeLabel}
                    executive={a.qa_name}
                    campaign={agentCampaignLabel(a)}
                    environment={ENVIRONMENT}
                    stats={a}
                    summary={draftOf(a.qa_user_id)}
                    onSummaryChange={(v) => setDraft(a.qa_user_id, v)}
                    onSave={() => saveSummary(a.qa_user_id)}
                    saving={savingKey === summaryKey(a.qa_user_id)}
                    dirty={isDirty(a.qa_user_id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
