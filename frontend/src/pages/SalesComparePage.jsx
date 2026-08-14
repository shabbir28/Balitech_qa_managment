import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, FileSpreadsheet, Upload, Search, Phone, CalendarRange, CalendarDays, ChevronDown, Loader2, Download } from 'lucide-react';
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

// ─── DateRangeDropdown component ─────────────────────────────────────────────
function DateRangeDropdown({ startDate, endDate, onChange, customTrigger, placement = 'right' }) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd]     = useState(endDate);
  const [activeLabel, setActiveLabel] = useState('Yesterday');
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
          className="flex items-center gap-2 h-[34px] px-3 bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-w-[160px] justify-between shadow-inner"
        >
          <span className="flex items-center gap-1.5 truncate">
            <CalendarRange className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
                    ? 'bg-emerald-600/30 text-emerald-300 font-semibold'
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

          {/* Custom date range pickers */}
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
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyCustom}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg py-1.5 transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => { setShowCustom(false); setActiveLabel('Yesterday'); }}
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

export default function SalesComparePage() {
  const navigate = useNavigate();
  const [dialerType, setDialerType] = useState('medicare');
  
  const getInitialDates = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return { start: fmt(d), end: fmt(d) };
  };

  const [startDate, setStartDate] = useState(getInitialDates().start);
  const [endDate, setEndDate]     = useState(getInitialDates().end);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [savedHistoryId, setSavedHistoryId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState('All');

  const [previewData, setPreviewData] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [previewDates, setPreviewDates] = useState({ start: '', end: '' });

  const handlePreviewRecheck = async (start, end) => {
    if (!savedHistoryId) return;
    setLoading(true);
    try {
      const res = await api.post(`/dialer-sales/compare-history/${savedHistoryId}/preview-recheck`, {
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
    if (!savedHistoryId) return;
    setIsConfirming(true);
    try {
      const res = await api.post(`/dialer-sales/compare-history/${savedHistoryId}/recheck`, {
        startDate: previewDates.start,
        endDate: previewDates.end
      });
      if (res.data.success) {
        toast.success(res.data.message);
        const updatedRecord = res.data.data;
        const newResultData = typeof updatedRecord.result_data === 'string' 
          ? JSON.parse(updatedRecord.result_data) 
          : updatedRecord.result_data;

        setResult(prev => ({
          data: newResultData,
          summary: {
            ...prev.summary,
            total_found: updatedRecord.total_found,
            total_uploaded: updatedRecord.total_uploaded
          },
          notFoundCount: updatedRecord.not_found
        }));
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

  const onDrop = (acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      toast.error('Invalid file. Please upload a .csv or .txt file');
      return;
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setSelectedStatus('All');
      setSelectedTeam('All');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt', '.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleCompare = async () => {
    if (!file) {
      toast.error('Please select a file to compare.');
      return;
    }

    setLoading(true);
    setResult(null);
    setSelectedStatus('All');
    setSelectedTeam('All');
    
    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const phones = [];

      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          rows.forEach(row => {
            row.forEach(cell => {
              const digits = String(cell).replace(/\D/g, '');
              if (digits.length >= 10) {
                phones.push(digits.slice(-10));
              }
            });
          });
        });
      } else {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        lines.forEach(line => {
          const parts = line.split(/[,;\t]/);
          parts.forEach(p => {
            const digits = p.replace(/\D/g, '');
            if (digits.length >= 10) {
              phones.push(digits.slice(-10));
            }
          });
        });
      }

      const uniquePhones = [...new Set(phones)];

      if (uniquePhones.length === 0) {
        toast.error('No 10-digit phone numbers found in the file.');
        setLoading(false);
        return;
      }

      const res = await api.post('/dialer-sales/compare', {
        dialer: dialerType,
        startDate: startDate,
        endDate: endDate,
        phones: uniquePhones
      });

      if (res.data.success) {
        const foundPhones = new Set(res.data.data.map(d => d.phone));
        const notFound = uniquePhones.filter(p => !foundPhones.has(p));
        
        const notFoundData = notFound.map(p => ({
           phone: p,
           status: 'Not Found',
           agent: '-',
           team: '-',
           sale_date: '-'
        }));

        const combinedData = [...res.data.data, ...notFoundData];
        
        setResult({
          data: combinedData,
          summary: res.data.summary,
          notFoundCount: notFound.length
        });
        
        toast.success(`Found ${res.data.summary.total_found} matches out of ${uniquePhones.length} numbers.`);

        try {
          const saveRes = await api.post('/dialer-sales/compare-history', {
            file_name: file.name,
            dialer_type: dialerType,
            compare_date: startDate,
            total_uploaded: uniquePhones.length,
            total_found: res.data.summary.total_found,
            not_found: notFound.length,
            uploaded_data: uniquePhones,
            result_data: combinedData
          });
          if (saveRes.data.success && saveRes.data.data?.id) {
            setSavedHistoryId(saveRes.data.data.id);
          }
        } catch (saveErr) {
          console.error('Failed to save compare history:', saveErr);
        }

      } else {
        toast.error('Comparison failed');
      }

    } catch (err) {
      console.error(err);
      toast.error('Error during comparison');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (e, teamFilter) => {
    e.stopPropagation();
    if (!result) return;

    let exportData = result.data;
    if (teamFilter !== 'All') {
      exportData = exportData.filter(d => (d.team || '-') === teamFilter);
    }

    if (exportData.length === 0) {
      toast.error('No data to download for this team');
      return;
    }

    const formattedData = exportData.map(row => ({
      'Phone Number': row.phone,
      'Status': row.status,
      'Agent': row.agent,
      'Team': row.team
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison Results");
    
    let filename = `compare_results_${dialerType}_${startDate}`;
    if (teamFilter !== 'All') filename += `_${teamFilter.replace(/[^a-z0-9]/gi, '_')}`;
    filename += '.xlsx';

    XLSX.writeFile(wb, filename);
  };

  const { filteredData, statusCounts, teamCounts } = useMemo(() => {
    if (!result) return { filteredData: [], statusCounts: {}, teamCounts: {} };
    
    const sCounts = {};
    const tCounts = {};
    result.data.forEach(item => {
      sCounts[item.status] = (sCounts[item.status] || 0) + 1;
      const teamName = item.team || '-';
      tCounts[teamName] = (tCounts[teamName] || 0) + 1;
    });

    let filtered = result.data;
    if (selectedStatus !== 'All') {
      filtered = filtered.filter(d => d.status === selectedStatus);
    }
    if (selectedTeam !== 'All') {
      filtered = filtered.filter(d => (d.team || '-') === selectedTeam);
    }

    return { filteredData: filtered, statusCounts: sCounts, teamCounts: tCounts };
  }, [result, selectedStatus, selectedTeam]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER SECTION */}
      <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700/50 p-5 shadow-lg">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 rounded-t-2xl" />
        
        <div className="flex items-center gap-4 z-10">
          <button 
            onClick={() => navigate('/dialer-sales')}
            className="p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-emerald-400 text-slate-300 transition-all duration-300 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 leading-tight">
              Compare Client Sales
            </h1>
            <p className="text-slate-400 text-xs flex items-center gap-1 mt-1 font-medium">
               Cross-match uploaded phone numbers with live dialer sales
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <div className="relative">
            <DateRangeDropdown
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => { setStartDate(start); setEndDate(end); }}
            />
          </div>
          <div className="w-px h-8 bg-slate-700 mx-1 rounded-full"></div>
          <div className="relative">
            <select
              value={dialerType}
              onChange={(e) => setDialerType(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-700 text-slate-200 text-sm font-medium rounded-xl pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all cursor-pointer hover:border-slate-600 shadow-inner"
            >
              <option value="medicare">Medicare Dialer</option>
              <option value="pharmacy">Pharmacy Dialer</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {!result && (
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-8 max-w-xl mx-auto mt-12 shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/15 transition-all duration-700"></div>
          <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/15 transition-all duration-700"></div>
          
          <div className="relative z-10 flex flex-col gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <FileSpreadsheet className="w-7 h-7 text-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-wide">Upload Client File</h3>
              <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
                Select your CSV, TXT, or Excel file with lead phone numbers to run instant matches against dialer history.
              </p>
            </div>
            
            <div
              {...getRootProps()}
              className={`border border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[180px]
                ${isDragActive 
                  ? 'border-emerald-400 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] scale-[1.01]' 
                  : 'border-slate-800 bg-slate-950/30 hover:border-slate-700 hover:bg-slate-900/30'
                }
                ${file ? 'border-emerald-500/30 bg-emerald-950/10' : ''}`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex flex-col items-center gap-3 animate-in zoom-in-95 duration-300">
                  <div className="p-4 bg-slate-900 rounded-2xl border border-emerald-500/20 shadow-md">
                    <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-100 text-base max-w-[280px] truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">{(file.size / 1024).toFixed(1)} KB &bull; Ready for check</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/30 px-3.5 py-1.5 rounded-lg mt-2 transition-colors border border-rose-500/10"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3.5">
                  <div className={`p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 transition-transform duration-500 ${isDragActive ? 'animate-bounce text-emerald-400' : 'text-slate-400'}`}>
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">
                      {isDragActive ? 'Drop file here to upload' : 'Click or drag file here'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium">Supports CSV, TXT, XLSX, XLS</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCompare}
              disabled={!file || loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none text-sm cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                   <Loader2 className="w-4 h-4 animate-spin text-white" />
                   Running comparison...
                </div>
              ) : (
                <><Search size={16} /> Run Comparison</>
              )}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition-colors"></div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Uploaded</p>
                <p className="text-2xl font-bold text-white font-mono">{result.summary.total_uploaded}</p>
             </div>
             <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-500/20 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full group-hover:bg-emerald-500/20 transition-colors"></div>
                <p className="text-[11px] text-emerald-400/80 font-bold uppercase tracking-wider mb-1">Matches Found</p>
                <p className="text-2xl font-bold text-emerald-400 font-mono">{result.summary.total_found}</p>
             </div>
             <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center relative">
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <p className="text-xs uppercase font-bold text-rose-500/80">Not Found</p>
                   {result.notFoundCount > 0 && savedHistoryId && (
                     <DateRangeDropdown
                       startDate={startDate}
                       endDate={endDate}
                       placement="left"
                       onChange={(start, end) => handlePreviewRecheck(start, end)}
                       customTrigger={(onClick, isOpen) => (
                         <button
                           onClick={onClick}
                           className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-[10px] font-bold uppercase transition-colors"
                           title="Search database for these missing numbers in another date range"
                         >
                           <Search className="w-3 h-3" /> Find
                         </button>
                       )}
                     />
                   )}
                 </div>
                 <p className="text-2xl font-mono font-bold text-rose-400">{result.notFoundCount}</p>
               </div>
             </div>
             <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center">
                <button 
                  onClick={() => { setFile(null); setResult(null); }}
                  className="bg-slate-800 hover:bg-slate-700 hover:shadow-sm text-slate-200 text-xs font-semibold py-2 px-4 rounded-lg transition-all duration-300 w-full hover:-translate-y-0.5 border border-slate-700"
                >
                  Upload New File
                </button>
             </div>
          </div>

          {/* Interactive Disposition Cards */}
          <div className="space-y-6">
            <div>
              <h2 className="text-slate-300 font-medium mb-3 text-sm px-1">Filter by Disposition</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div
                    onClick={() => { setSelectedStatus('All'); setSelectedTeam('All'); }}
                    className={`cursor-pointer transition-all duration-300 rounded-lg p-3 border flex flex-col justify-center gap-1 group hover:-translate-y-0.5 ${
                      selectedStatus === 'All'
                        ? 'bg-slate-800 border-slate-500 shadow-md shadow-slate-900/50'
                        : 'bg-slate-900 border-slate-800/80 hover:border-slate-600'
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedStatus === 'All' ? 'text-white' : 'text-slate-400'}`}>
                      All Records
                    </span>
                    <span className="text-lg font-bold text-slate-100 font-mono">{result.data.length}</span>
                </div>

                {Object.entries(statusCounts)
                  .sort((a,b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const isSelected = selectedStatus === status;
                    const isNotFound = status === 'Not Found';
                    return (
                      <div
                        key={status}
                        onClick={() => { setSelectedStatus(status); setSelectedTeam('All'); }}
                        className={`cursor-pointer transition-all duration-300 rounded-lg p-3 border flex flex-col justify-center gap-1 group hover:-translate-y-0.5 relative overflow-hidden ${
                          isSelected
                            ? isNotFound 
                                ? 'bg-red-950/40 border-red-500 shadow-md shadow-red-900/20' 
                                : 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-900/20'
                            : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {isSelected && (
                          <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-full opacity-20 ${isNotFound ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        )}
                        
                        <div className="flex items-center justify-between z-10">
                          <span className={`text-[10px] font-bold uppercase tracking-wider truncate pr-1 ${
                            isSelected 
                              ? (isNotFound ? 'text-red-300' : 'text-emerald-300') 
                              : 'text-slate-400'
                          }`}>
                            {status}
                          </span>
                          <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${
                            isNotFound ? 'bg-red-500 shadow-red-500/50' : 'bg-emerald-500 shadow-emerald-500/50'
                          }`} />
                        </div>
                        <span className={`text-lg font-bold font-mono z-10 ${
                          isSelected 
                            ? (isNotFound ? 'text-red-400' : 'text-emerald-400') 
                            : 'text-slate-200'
                        }`}>
                          {count}
                        </span>
                      </div>
                    );
                })}
              </div>
            </div>

            {/* Interactive Team Cards */}
            <div>
              <h2 className="text-slate-300 font-medium mb-3 text-sm px-1">Filter by Team</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div
                    onClick={() => { setSelectedTeam('All'); setSelectedStatus('All'); }}
                    className={`cursor-pointer transition-all duration-300 rounded-lg p-3 border flex flex-col justify-center gap-1 group hover:-translate-y-0.5 ${
                      selectedTeam === 'All'
                        ? 'bg-slate-800 border-slate-500 shadow-md shadow-slate-900/50'
                        : 'bg-slate-900 border-slate-800/80 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedTeam === 'All' ? 'text-white' : 'text-slate-400'}`}>
                        All Teams
                      </span>
                      <button 
                        onClick={(e) => handleDownload(e, 'All')}
                        className="text-slate-500 hover:text-emerald-400 transition-colors p-1 rounded-md hover:bg-slate-800/50"
                        title="Download All Teams"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-lg font-bold text-slate-100 font-mono">{result.data.length}</span>
                </div>

                {Object.entries(teamCounts)
                  .sort((a,b) => b[1] - a[1])
                  .map(([team, count]) => {
                    const isSelected = selectedTeam === team;
                    const isNoTeam = team === '-' || team === 'Unknown';
                    const displayName = team === '-' ? 'No Team' : team;
                    return (
                      <div
                        key={team}
                        onClick={() => { setSelectedTeam(team); setSelectedStatus('All'); }}
                        className={`cursor-pointer transition-all duration-300 rounded-lg p-3 border flex flex-col justify-center gap-1 group hover:-translate-y-0.5 relative overflow-hidden ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-900/20'
                            : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-0 right-0 w-8 h-8 rounded-bl-full opacity-20 bg-indigo-500" />
                        )}
                        
                        <div className="flex items-center justify-between z-10">
                          <span className={`text-[10px] font-bold uppercase tracking-wider truncate pr-1 ${
                            isSelected ? 'text-indigo-300' : 'text-slate-400'
                          }`}>
                            {displayName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={(e) => handleDownload(e, team)}
                              className="text-slate-500 hover:text-indigo-400 transition-colors p-1 rounded-md hover:bg-slate-800/50"
                              title={`Download ${displayName} data`}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${
                              isNoTeam ? 'bg-slate-600' : 'bg-indigo-500'
                            }`} />
                          </div>
                        </div>
                        <span className={`text-lg font-bold font-mono z-10 ${
                          isSelected ? 'text-indigo-400' : 'text-slate-200'
                        }`}>
                          {count}
                        </span>
                      </div>
                    );
                })}
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden shadow-md flex flex-col mt-2" style={{ height: 'calc(100vh - 420px)', minHeight: '350px' }}>
            <div className="px-5 py-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
              <h3 className="text-slate-200 text-xs font-semibold flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold font-mono">
                  {filteredData.length}
                </span>
                {selectedStatus !== 'All'
                  ? `Showing ${selectedStatus} Records`
                  : selectedTeam !== 'All'
                    ? `Showing ${selectedTeam === '-' ? 'No Team' : selectedTeam} Records`
                    : 'Showing All Records'}
              </h3>
            </div>
            
            <div className="overflow-auto flex-1 bg-slate-950/40 custom-scrollbar">
              <table className="w-full text-left text-sm text-slate-300 border-collapse">
                <thead className="bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Phone Number</th>
                    <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Status</th>
                    <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Agent</th>
                    <th className="px-6 py-4 font-bold text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">Team</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-24 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                          <Search className="w-8 h-8 text-slate-600" />
                          <p className="font-medium">No records match the selected filter.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-3 font-mono text-slate-300 flex items-center gap-2 group-hover:text-emerald-400 transition-colors">
                           <Phone className="w-4 h-4 text-slate-500 group-hover:text-emerald-500" /> {row.phone}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                            row.status === 'Not Found' 
                              ? 'bg-red-950/50 text-red-400 border-red-500/30'
                              : 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-400 font-medium group-hover:text-slate-300 transition-colors">{row.agent}</td>
                        <td className="px-6 py-3">
                           {row.team !== '-' ? (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                               {row.team}
                             </span>
                           ) : (
                             <span className="text-slate-600">-</span>
                           )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
