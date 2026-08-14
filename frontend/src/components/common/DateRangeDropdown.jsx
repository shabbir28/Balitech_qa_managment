import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CalendarRange, ChevronDown, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPresets, getEstDateString, fmtLocal } from '../../utils/dateUtils';

export default function DateRangeDropdown({ startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd]     = useState(endDate);
  
  // Find which preset matches the given dates to highlight the right label
  const presets = useMemo(() => getPresets(), []);
  
  const initialActivePreset = presets.find(p => !p.isCustom && p.start === startDate && p.end === endDate);
  const [activeLabel, setActiveLabel] = useState(initialActivePreset ? initialActivePreset.label : 'Yesterday');
  
  const [showCustom, setShowCustom]   = useState(!initialActivePreset);
  const ref = useRef(null);

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
    <div className="relative animate-in fade-in duration-300" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-[34px] px-3 bg-slate-800/80 border border-slate-700 text-slate-200 text-sm rounded-lg hover:bg-slate-700 transition-colors focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[150px] justify-between cursor-pointer"
      >
        <span className="flex items-center gap-1.5 truncate">
          <CalendarRange className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-xs truncate">{displayLabel}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 lg:right-0 lg:left-auto mt-1 w-64 bg-slate-900 border border-slate-750 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-1">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => selectPreset(preset)}
                className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                  activeLabel === preset.label
                    ? 'bg-violet-600/30 text-violet-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{preset.label}</span>
                  {!preset.isCustom && (
                    <span className="text-[9px] text-slate-500 font-mono">
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
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Custom Range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 font-medium mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || fmtLocal(new Date(getEstDateString(new Date()) + 'T00:00:00'))}
                    onChange={e => setCustomStart(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-[10px] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 font-medium mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={fmtLocal(new Date(getEstDateString(new Date()) + 'T00:00:00'))}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-[10px] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500 [color-scheme:dark]"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyCustom}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg py-1.5 transition-colors"
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
