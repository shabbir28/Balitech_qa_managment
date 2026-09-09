import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CalendarRange, CalendarDays, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPresets, getEstDateString } from '../../utils/dateUtils';

/**
 * Range picker over US Eastern calendar days.
 *
 * Same contract as the dashboard picker: the label is derived from the applied
 * range on every render, so it cannot drift from what the page is querying.
 * `customTrigger` lets a caller render its own button, and an empty range is
 * shown as "All dates" for screens where the filter is optional.
 */
export function DateRangeDropdown({ startDate, endDate, onChange, customTrigger, placement = 'right' }) {
  const [open, setOpen] = useState(false);
  const presets = useMemo(() => getPresets(), []);
  const today = useMemo(() => getEstDateString(new Date()), []);

  const matchedPreset = presets.find(
    (p) => !p.isCustom && p.start === startDate && p.end === endDate
  );
  const isCustomRange = !matchedPreset && Boolean(startDate);

  const displayLabel = matchedPreset
    ? matchedPreset.label
    : startDate
      ? (startDate === endDate ? startDate : `${startDate} → ${endDate}`)
      : 'All dates';

  const [showCustom, setShowCustom] = useState(isCustomRange);
  const [customStart, setCustomStart] = useState(startDate || today);
  const [customEnd, setCustomEnd] = useState(endDate || today);
  const ref = useRef(null);

  useEffect(() => {
    setCustomStart(startDate || today);
    setCustomEnd(endDate || startDate || today);
  }, [startDate, endDate, today]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectPreset = (preset) => {
    if (preset.isCustom) {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
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

  const clearRange = () => {
    setShowCustom(false);
    onChange('', '');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {customTrigger ? customTrigger(() => setOpen(o => !o), open) : (
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 h-[38px] px-3 bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-w-[160px] justify-between shadow-inner"
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
            {presets.map((preset) => {
              const active = preset.isCustom ? isCustomRange : (preset.start === startDate && preset.end === endDate);
              return (
                <button
                  key={preset.label}
                  onClick={() => selectPreset(preset)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
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
              );
            })}
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
                    max={customEnd || today}
                    onChange={e => setCustomStart(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={today}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
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
                  onClick={clearRange}
                  className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg py-1.5 transition-colors"
                  title="Remove the date filter"
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
