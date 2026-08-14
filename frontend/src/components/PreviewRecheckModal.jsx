import React from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarDays, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

const PreviewRecheckModal = ({ isOpen, onClose, previewData, onConfirm, isConfirming, startDate, endDate }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              Preview Backfill Results
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Found <strong className="text-emerald-400">{previewData?.foundCount || 0}</strong> numbers between {startDate} and {endDate}
            </p>
          </div>
          <button 
            onClick={onClose}
            disabled={isConfirming}
            className="p-2 bg-slate-800/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {previewData?.foundCount === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-400">No matching numbers found in the selected date range.</p>
            </div>
          ) : (
            Object.entries(previewData?.byDate || {}).map(([dateStr, items]) => (
              <div key={dateStr} className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-slate-200">{dateStr}</span>
                  </div>
                  <span className="text-xs font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                    {items.length} records
                  </span>
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-700/50 rounded-lg p-2 flex flex-col justify-center">
                      <span className="text-sm font-mono font-bold text-emerald-400">{item.phone}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 truncate" title={`Agent: ${item.agent} | Team: ${item.team}`}>
                        Agent: {item.agent}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {previewData?.foundCount > 0 && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-sm text-indigo-300/80">
              <strong>Note:</strong> Confirming will remove these {previewData.foundCount} numbers from your current comparison and insert them into the dates listed above.
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-slate-900 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          
          {previewData?.foundCount > 0 && (
            <button
              onClick={onConfirm}
              disabled={isConfirming}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Moving Data...</>
              ) : (
                <>Confirm & Move Data <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PreviewRecheckModal;
