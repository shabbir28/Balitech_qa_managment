import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { History, CalendarRange, CalendarDays, ChevronDown, Download, Eye, FileSpreadsheet, Phone, Search, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import api from '../services/api';
import PreviewRecheckModal from '../components/PreviewRecheckModal';

// ─── Date helpers ────────────────────────────────────────────────────────────
const fmt = (d) => d.toISOString().slice(0, 10);

const getPresets = () => {
  const now = new Date();
  const today = fmt(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = fmt(yesterday);

  // Monday of current week
  const dow = now.getDay();
  const mondayThis = new Date(now);
  mondayThis.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const sundayThis = new Date(mondayThis);
  sundayThis.setDate(mondayThis.getDate() + 6);

  // Last week Mon–Sun
  const mondayLast = new Date(mondayThis);
  mondayLast.setDate(mondayThis.getDate() - 7);
  const sundayLast = new Date(mondayLast);
  sundayLast.setDate(mondayLast.getDate() + 6);

  // This month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

  return [
    { label: 'Today',       start: today,              end: today },
    { label: 'Yesterday',   start: yd,                 end: yd },
    { label: 'This Week',   start: fmt(mondayThis),    end: fmt(sundayThis) },
    { label: 'Last Week',   start: fmt(mondayLast),    end: fmt(sundayLast) },
    { label: 'This Month',  start: fmt(monthStart),    end: fmt(monthEnd) },
    { label: 'Last Month',  start: fmt(lastMonthStart),end: fmt(lastMonthEnd) },
    { label: 'Custom Range',start: null,               end: null, isCustom: true },
  ];
};

function DateRangeDropdown({ startDate, endDate, onChange, customTrigger, placement = 'right' }) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd]     = useState(endDate);
  const [activeLabel, setActiveLabel] = useState('Today');
  const [showCustom, setShowCustom]   = useState(false);
  const ref = useRef(null);

  const presets = useMemo(() => getPresets(), []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectPreset = (preset) => {
    if (preset.isCustom) {
      setShowCustom(true);
      setActiveLabel('Custom Range');
      return;
    }
    setShowCustom(false);
    setActiveLabel(preset.label);
    setCustomStart(preset.start);
    setCustomEnd(preset.end);
    onChange(preset.start, preset.end);
    setOpen(false);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (customStart > customEnd) {
      toast.error('Start date cannot be after end date');
      return;
    }
    onChange(customStart, customEnd);
    setOpen(false);
  };

  const displayLabel = showCustom && startDate && endDate && startDate !== endDate
    ? `${startDate} → ${endDate}`
    : activeLabel === 'Custom Range' && startDate
      ? `${startDate}${endDate !== startDate ? ` → ${endDate}` : ''}`
      : activeLabel;

  return (
    <div className="relative" ref={ref}>
      {customTrigger ? customTrigger(() => setOpen(o => !o), open) : (
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 h-[34px] px-3 bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-w-[160px] justify-between shadow-inner"
        >
          <span className="flex items-center gap-1.5 truncate">
            <CalendarRange className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-sm truncate">{displayLabel}</span>
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && (
        <div className={`absolute ${placement === 'right' ? 'right-0' : 'left-0'} mt-1 w-72 bg-slate-900 border border-slate-750 rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden`}>
          <div className="p-1">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => selectPreset(preset)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeLabel === preset.label
                    ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{preset.label}</span>
                  {!preset.isCustom && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {preset.start === preset.end ? preset.start : `${preset.start} – ${preset.end}`}
                    </span>
                  )}
                  {preset.isCustom && <CalendarDays className="w-3.5 h-3.5 text-slate-500" />}
                </div>
              </button>
            ))}
          </div>

          {showCustom && (
            <div className="border-t border-slate-800 p-3 space-y-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom Range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || fmt(new Date())}
                    onChange={e => setCustomStart(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={fmt(new Date())}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyCustom}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg py-1.5 transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => { setShowCustom(false); setActiveLabel('Today'); }}
                  className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg py-1.5 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompareHistoryPage() {
  const navigate = useNavigate();
  
  const getInitialDates = () => {
    const d = new Date();
    return { start: fmt(d), end: fmt(d) };
  };

  const [startDate, setStartDate] = useState(getInitialDates().start);
  const [endDate, setEndDate]     = useState(getInitialDates().end);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalStatus, setModalStatus] = useState('All');
  const [modalTeam, setModalTeam] = useState('All');

  const [previewData, setPreviewData] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [previewDates, setPreviewDates] = useState({ start: '', end: '' });

  const openModal = (record) => {
    setModalStatus('All');
    setModalTeam('All');
    setSelectedRecord(record);
  };

  const { filteredData, statusCounts, teamCounts } = useMemo(() => {
    if (!selectedRecord || !selectedRecord.result_data) return { filteredData: [], statusCounts: {}, teamCounts: {} };
    
    const sCounts = {};
    const tCounts = {};
    selectedRecord.result_data.forEach(item => {
      sCounts[item.status] = (sCounts[item.status] || 0) + 1;
      const teamName = item.team || '-';
      tCounts[teamName] = (tCounts[teamName] || 0) + 1;
    });

    let filtered = selectedRecord.result_data;
    if (modalStatus !== 'All') {
      filtered = filtered.filter(d => d.status === modalStatus);
    }
    if (modalTeam !== 'All') {
      filtered = filtered.filter(d => (d.team || '-') === modalTeam);
    }

    return { filteredData: filtered, statusCounts: sCounts, teamCounts: tCounts };
  }, [selectedRecord, modalStatus, modalTeam]);

  const handlePreviewRecheck = async (start, end) => {
    if (!selectedRecord) return;
    setLoading(true);
    try {
      const res = await api.post(`/dialer-sales/compare-history/${selectedRecord.id}/preview-recheck`, {
        startDate: start,
        endDate: end
      });
      if (res.data.success) {
        setPreviewData(res.data.data);
        setPreviewDates({ start, end });
        setIsPreviewOpen(true);
      } else {
        toast.error(res.data.message || 'Failed to preview recheck');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error previewing missing numbers');
    } finally {
      setLoading(false);
    }
  };

  const confirmRecheck = async () => {
    if (!selectedRecord) return;
    setIsConfirming(true);
    try {
      const res = await api.post(`/dialer-sales/compare-history/${selectedRecord.id}/recheck`, {
        startDate: previewDates.start,
        endDate: previewDates.end
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setSelectedRecord(res.data.data); // Update modal view
        // Update history list as well
        setHistory(prev => prev.map(item => item.id === res.data.data.id ? res.data.data : item));
        setIsPreviewOpen(false);
      } else {
        toast.error(res.data.message || 'Failed to recheck');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error rechecking missing numbers');
    } finally {
      setIsConfirming(false);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dialer-sales/compare-history', {
        params: { startDate, endDate }
      });
      if (res.data.success) {
        setHistory(res.data.data);
      } else {
        toast.error('Failed to fetch history');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error fetching history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate]);

  const handleDownloadUploaded = (record) => {
    if (!record.uploaded_data || record.uploaded_data.length === 0) {
      toast.error('No uploaded data available');
      return;
    }
    const formatted = record.uploaded_data.map(p => ({ 'Phone Number': p }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Uploaded Numbers");
    XLSX.writeFile(wb, `uploaded_${record.file_name}.xlsx`);
  };

  const handleDownloadResult = (record, teamFilter) => {
    const rec = record || selectedRecord;
    if (!rec) return;

    let exportData = rec.result_data || [];
    const filter = teamFilter !== undefined ? teamFilter : modalTeam;

    if (filter !== 'All') {
      exportData = exportData.filter(d => (d.team || '-') === filter);
    }
    if (exportData.length === 0) {
      toast.error('No result data available for this team');
      return;
    }
    const formatted = exportData.map(row => ({
      'Phone Number': row.phone,
      'Status': row.status,
      'Agent': row.agent,
      'Team': row.team
    }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison Results");
    let filename = `result_${rec.file_name}`;
    if (filter !== 'All') filename += `_${filter.replace(/[^a-z0-9]/gi, '_')}`;
    filename += '.xlsx';

    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER SECTION */}
      <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700/50 p-5 shadow-lg">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-t-2xl" />
        
        <div className="flex items-center gap-4 z-10">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 leading-tight">
              Compare History
            </h1>
            <p className="text-slate-400 text-xs flex items-center gap-1 mt-1 font-medium">
               View and download past sales comparisons
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <DateRangeDropdown
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => { setStartDate(start); setEndDate(end); }}
          />
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden shadow-md flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
          <h3 className="text-slate-200 text-xs font-semibold flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold font-mono">
              {history.length}
            </span>
            History Records
          </h3>
        </div>
        
        <div className="overflow-auto flex-1 bg-slate-950/40 custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-300 border-collapse">
            <thead className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Date</th>
                <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">File Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Dialer</th>
                <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Total</th>
                <th className="px-6 py-4 font-bold text-emerald-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Found</th>
                <th className="px-6 py-4 font-bold text-rose-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Not Found</th>
                <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-24 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-24 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="w-8 h-8 text-slate-600" />
                      <p className="font-medium">No history records found for this date range.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-indigo-300 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                      {row.file_name}
                    </td>
                    <td className="px-6 py-4 uppercase text-[10px] font-bold text-slate-400">
                      {row.dialer_type}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">{row.total_uploaded}</td>
                    <td className="px-6 py-4 font-mono text-emerald-400 font-bold">{row.total_found}</td>
                    <td className="px-6 py-4 font-mono text-rose-400">{row.not_found}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(row)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          onClick={() => { setModalTeam('All'); setModalStatus('All'); handleDownloadResult(row, 'All'); }}
                          className="px-2.5 py-1.5 bg-indigo-900/30 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" /> Result
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Detail Modal */}
      {selectedRecord && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{selectedRecord.file_name}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Compared on {new Date(selectedRecord.created_at).toLocaleString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex gap-4 shrink-0">
               <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Total Uploaded</p>
                    <p className="text-xl font-mono font-bold text-slate-200">{selectedRecord.total_uploaded}</p>
                  </div>
                  <button onClick={() => handleDownloadUploaded(selectedRecord)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300" title="Download Uploaded Numbers">
                    <Download className="w-4 h-4" />
                  </button>
               </div>
               <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-emerald-500/80 mb-0.5">Matches Found</p>
                    <p className="text-xl font-mono font-bold text-emerald-400">{selectedRecord.total_found}</p>
                  </div>
               </div>
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center relative">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[10px] uppercase font-bold text-rose-500/80">Not Found</p>
                      {selectedRecord.not_found > 0 && (
                        <DateRangeDropdown
                          startDate={startDate}
                          endDate={endDate}
                          placement="left"
                          onChange={(start, end) => handlePreviewRecheck(start, end)}
                          customTrigger={(onClick, isOpen) => (
                            <button
                              onClick={onClick}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-[9px] font-bold uppercase transition-colors"
                              title="Search database for these missing numbers in another date range"
                            >
                              <Search className="w-2.5 h-2.5" /> Find
                            </button>
                          )}
                        />
                      )}
                    </div>
                    <p className="text-xl font-mono font-bold text-rose-400">{selectedRecord.not_found}</p>
                  </div>
               </div>
               <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-indigo-500/80 mb-0.5">Result Data</p>
                    <p className="text-xl font-mono font-bold text-indigo-400">{selectedRecord.result_data?.length || 0}</p>
                  </div>
                  <button onClick={() => handleDownloadResult(null, modalTeam)} className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-lg" title="Download Results">
                    <Download className="w-4 h-4" />
                  </button>
               </div>
            </div>

            <div className="p-4 bg-slate-950/30 border-b border-slate-800 flex flex-col gap-4 overflow-y-auto max-h-[40vh] custom-scrollbar shrink-0">
               <div>
                  <h2 className="text-slate-300 font-medium mb-3 text-xs px-1">Filter by Disposition</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    <div
                        onClick={() => { setModalStatus('All'); setModalTeam('All'); }}
                        className={`cursor-pointer transition-all duration-200 rounded-lg p-2 border flex flex-col justify-center gap-1 group hover:-translate-y-0.5 ${
                          modalStatus === 'All'
                            ? 'bg-slate-800 border-slate-500 shadow-sm shadow-slate-900/50'
                            : 'bg-slate-900 border-slate-800/80 hover:border-slate-600'
                        }`}
                      >
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${modalStatus === 'All' ? 'text-white' : 'text-slate-400'}`}>
                          All Records
                        </span>
                        <span className="text-base font-bold text-slate-100 font-mono">{selectedRecord.result_data?.length || 0}</span>
                    </div>
                    {Object.entries(statusCounts).sort((a,b) => b[1] - a[1]).map(([status, count]) => {
                        const isSelected = modalStatus === status;
                        const isNotFound = status === 'Not Found';
                        return (
                          <div
                            key={status}
                            onClick={() => { setModalStatus(status); setModalTeam('All'); }}
                            className={`cursor-pointer transition-all duration-200 rounded-lg p-2 border flex flex-col justify-center gap-1 group hover:-translate-y-0.5 relative overflow-hidden ${
                              isSelected
                                ? isNotFound 
                                    ? 'bg-rose-950/40 border-rose-500 shadow-sm shadow-rose-900/20' 
                                    : 'bg-emerald-950/40 border-emerald-500 shadow-sm shadow-emerald-900/20'
                                : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            {isSelected && (
                              <div className={`absolute top-0 right-0 w-6 h-6 rounded-bl-full opacity-20 ${isNotFound ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            )}
                            <div className="flex items-center justify-between z-10">
                              <span className={`text-[9px] font-bold uppercase tracking-wider truncate pr-1 ${
                                isSelected ? (isNotFound ? 'text-rose-300' : 'text-emerald-300') : 'text-slate-400'
                              }`}>{status}</span>
                              <div className={`w-1.5 h-1.5 rounded-full shadow-sm shrink-0 ${
                                isNotFound ? 'bg-rose-500 shadow-rose-500/50' : 'bg-emerald-500 shadow-emerald-500/50'
                              }`} />
                            </div>
                            <span className={`text-base font-bold font-mono z-10 ${
                              isSelected ? (isNotFound ? 'text-rose-400' : 'text-emerald-400') : 'text-slate-200'
                            }`}>{count}</span>
                          </div>
                        );
                    })}
                  </div>
               </div>

               <div>
                  <h2 className="text-slate-300 font-medium mb-3 text-xs px-1">Filter by Team</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    <div
                        onClick={() => { setModalTeam('All'); setModalStatus('All'); }}
                        className={`cursor-pointer transition-all duration-200 rounded-lg p-2 border flex flex-col justify-center gap-1 group hover:-translate-y-0.5 ${
                          modalTeam === 'All'
                            ? 'bg-slate-800 border-slate-500 shadow-sm shadow-slate-900/50'
                            : 'bg-slate-900 border-slate-800/80 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${modalTeam === 'All' ? 'text-white' : 'text-slate-400'}`}>
                            All Teams
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadResult(null, 'All'); }} className="text-slate-500 hover:text-indigo-400 transition-colors p-0.5 rounded-md hover:bg-slate-800/50">
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-base font-bold text-slate-100 font-mono">{selectedRecord.result_data?.length || 0}</span>
                    </div>

                    {Object.entries(teamCounts).sort((a,b) => b[1] - a[1]).map(([team, count]) => {
                        const isSelected = modalTeam === team;
                        const isNoTeam = team === '-' || team === 'Unknown';
                        const displayName = team === '-' ? 'No Team' : team;
                        return (
                          <div
                            key={team}
                            onClick={() => { setModalTeam(team); setModalStatus('All'); }}
                            className={`cursor-pointer transition-all duration-200 rounded-lg p-2 border flex flex-col justify-center gap-1 group hover:-translate-y-0.5 relative overflow-hidden ${
                              isSelected
                                ? 'bg-indigo-950/40 border-indigo-500 shadow-sm shadow-indigo-900/20'
                                : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-0 right-0 w-6 h-6 rounded-bl-full opacity-20 bg-indigo-500" />
                            )}
                            <div className="flex items-center justify-between z-10 w-full">
                              <span className={`text-[9px] font-bold uppercase tracking-wider truncate pr-1 ${
                                isSelected ? 'text-indigo-300' : 'text-slate-400'
                              }`}>{displayName}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); setModalTeam(team); handleDownloadResult(null, team); }} className="text-slate-500 hover:text-indigo-400 transition-colors p-0.5 rounded-md hover:bg-slate-800/50">
                                  <Download className="w-3 h-3" />
                                </button>
                                <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${isNoTeam ? 'bg-slate-600' : 'bg-indigo-500'}`} />
                              </div>
                            </div>
                            <span className={`text-base font-bold font-mono z-10 ${
                              isSelected ? 'text-indigo-400' : 'text-slate-200'
                            }`}>{count}</span>
                          </div>
                        );
                    })}
                  </div>
               </div>
            </div>

            <div className="overflow-auto flex-1 bg-slate-950 p-4 custom-scrollbar">
              <table className="w-full text-left text-sm text-slate-300 border-collapse">
                <thead className="bg-slate-900 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Phone Number</th>
                    <th className="px-4 py-3 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Status</th>
                    <th className="px-4 py-3 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Agent</th>
                    <th className="px-4 py-3 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Team</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-500 text-xs">No records match the selected filter.</td>
                    </tr>
                  ) : filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2 font-mono text-slate-300 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500" /> {row.phone}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                            row.status === 'Not Found' 
                              ? 'bg-rose-950/50 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {row.status}
                          </span>
                      </td>
                      <td className="px-4 py-2 text-slate-400 font-medium">{row.agent}</td>
                      <td className="px-4 py-2">
                         {row.team !== '-' ? (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                               {row.team}
                             </span>
                           ) : (
                             <span className="text-slate-600">-</span>
                           )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}

      <PreviewRecheckModal 
        isOpen={isPreviewOpen}
        onClose={() => !isConfirming && setIsPreviewOpen(false)}
        previewData={previewData}
        onConfirm={confirmRecheck}
        isConfirming={isConfirming}
        startDate={previewDates.start}
        endDate={previewDates.end}
      />
    </div>
  );
}
