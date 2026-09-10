import { useState } from 'react';
import { Eye, EyeOff, Check, Circle } from 'lucide-react';
import { PASSWORD_RULES, passwordStrength } from '../../utils/password';

const STRENGTH = [
  { label: '', bar: 'bg-slate-700', text: 'text-slate-500' },
  { label: 'Very weak', bar: 'bg-rose-500', text: 'text-rose-400' },
  { label: 'Weak', bar: 'bg-orange-500', text: 'text-orange-400' },
  { label: 'Fair', bar: 'bg-amber-400', text: 'text-amber-300' },
  { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-400' },
  { label: 'Very strong', bar: 'bg-emerald-400', text: 'text-emerald-300' },
];

/**
 * Password field with a show/hide toggle. Pass `showRules` to render the
 * strength bar and requirement checklist under the input.
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Minimum 8 characters',
  showRules = false,
  accent = 'indigo',
  className = '',
  autoComplete = 'new-password',
  ...rest
}) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);
  const s = STRENGTH[strength];

  const ring = accent === 'amber'
    ? 'focus:border-amber-500/60 focus:ring-amber-500/20'
    : accent === 'rose'
      ? 'focus:border-rose-500/60 focus:ring-rose-500/20'
      : 'focus:border-indigo-500/60 focus:ring-indigo-500/20';

  return (
    <div className={className}>
      <div className="relative">
        <input
          {...rest}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full h-11 rounded-xl border border-slate-800 bg-[#0D111D] pl-4 pr-11 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:ring-2 ${ring}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {showRules && (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? s.bar : 'bg-slate-800'}`}
                />
              ))}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider min-w-[70px] text-right ${s.text}`}>
              {value ? s.label : ''}
            </span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(value || '');
              return (
                <li
                  key={rule.key}
                  className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${ok ? 'text-emerald-400' : 'text-slate-500'}`}
                >
                  {ok ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3 opacity-50" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
