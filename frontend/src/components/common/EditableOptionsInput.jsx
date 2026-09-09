import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, X, Trash2, Check } from 'lucide-react';

/**
 * Text input backed by a datalist, with a pencil button that opens an editor
 * where the user can add options to (and, when permitted, remove from) the list.
 *
 * The option list itself lives in the parent (see useEvaluationOptions) so
 * several inputs on the sheet can share and persist the same lists.
 */
export default function EditableOptionsInput({
  id,
  field,
  label,
  value,
  onChange,
  options = [],
  onAddOption,
  onRemoveOption,
  canRemove = false,
  placeholder,
  className = '',
  disabled = false,
  onBlur,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-stretch gap-1 w-full">
      <input
        list={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} min-w-0 flex-1`}
      />
      <datalist id={id}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Edit ${label || 'options'}`}
        aria-label={`Edit ${label || 'options'}`}
        className="shrink-0 px-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/50 transition-colors"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <OptionsEditorModal
          field={field}
          label={label}
          options={options}
          onAdd={onAddOption}
          onRemove={onRemoveOption}
          canRemove={canRemove}
          onSelect={(opt) => { onChange(opt); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function OptionsEditorModal({ field, label, options, onAdd, onRemove, canRemove, onSelect, onClose }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmed = draft.trim();
  const duplicate = trimmed && options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const handleAdd = async () => {
    if (!trimmed || duplicate || !onAdd) return;
    setBusy(true);
    const ok = await onAdd(field, trimmed);
    setBusy(false);
    if (ok) setDraft('');
  };

  const handleRemove = async (opt) => {
    if (!onRemove) return;
    setBusy(true);
    await onRemove(field, opt);
    setBusy(false);
    setPendingRemove(null);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Edit {label || 'options'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {canRemove ? 'Add new options or remove existing ones.' : 'Add new options to this dropdown.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-slate-800/70">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              placeholder="Type a new option..."
              maxLength={255}
              className="flex-1 bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!trimmed || duplicate || busy}
              className="btn-primary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} className="mr-1" /> Add
            </button>
          </div>
          {duplicate && (
            <p className="text-[11px] text-amber-400 mt-1.5">This option already exists.</p>
          )}
        </div>

        <ul className="overflow-y-auto custom-scrollbar px-2 py-2 flex-1">
          {options.length === 0 && (
            <li className="text-sm text-slate-500 text-center py-6">No options yet.</li>
          )}
          {options.map((opt) => (
            <li
              key={opt}
              className="group flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              <button
                type="button"
                onClick={() => onSelect(opt)}
                title="Use this value"
                className="flex-1 text-left text-sm text-slate-200 truncate"
              >
                {opt}
              </button>
              {canRemove && (
                pendingRemove === opt ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRemove(opt)}
                      disabled={busy}
                      className="p-1 rounded text-rose-300 hover:bg-rose-500/20"
                      title="Confirm remove"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemove(null)}
                      className="p-1 rounded text-slate-400 hover:bg-slate-700"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingRemove(opt)}
                    className="p-1 rounded text-slate-500 opacity-0 group-hover:opacity-100 hover:text-rose-300 hover:bg-rose-500/10 transition-all shrink-0"
                    title="Remove option"
                  >
                    <Trash2 size={14} />
                  </button>
                )
              )}
            </li>
          ))}
        </ul>

        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2">Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
