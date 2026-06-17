

// Stat Card
export const StatCard = ({ title, value, icon: Icon, color, sub }) => (
  <div className="card p-6 flex flex-col justify-between group">
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} bg-opacity-10 border shadow-sm transition-transform duration-300 group-hover:scale-110`}>
        <Icon className="w-6 h-6" />
      </div>
      {sub && <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">{sub}</span>}
    </div>
    <div>
      <p className="text-3xl font-bold text-white tracking-tight">{value ?? '—'}</p>
      <p className="text-sm font-medium text-slate-400 mt-1">{title}</p>
    </div>
  </div>
);

// Badge
export const Badge = ({ status }) => {
  const map = {
    Pass: 'badge-green',
    Fail: 'badge-red',
    Pending: 'badge-yellow',
    'Viewed by Agent': 'badge-blue',
    'Acknowledged by Agent': 'badge-green',
    'Coaching Required': 'badge-orange',
    Closed: 'badge-gray',
    Critical: 'badge-red',
    High: 'badge-orange',
    Medium: 'badge-yellow',
    Low: 'badge-blue',
    Admin: 'badge-purple',
    'QA Officer': 'badge-blue',
    'Team Lead': 'badge-blue',
    Agent: 'badge-gray',
    completed: 'badge-green',
    processing: 'badge-yellow',
    failed: 'badge-red',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
};

// Loading Spinner
export const Spinner = ({ size = 'md' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={`${sizes[size]} border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin`} />
  );
};

// Loading Page
export const LoadingPage = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <Spinner size="lg" />
      <p className="text-slate-400 text-sm font-medium">Loading...</p>
    </div>
  </div>
);

// Empty State
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-slate-900/50 border border-slate-800 border-dashed">
    {Icon && (
      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-emerald-500/60" />
      </div>
    )}
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    {description && <p className="text-sm text-slate-400 max-w-md mb-6">{description}</p>}
    {action}
  </div>
);

// Pagination
export const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-slate-900/50">
      <p className="text-sm font-medium text-slate-400">Showing <span className="text-slate-200">{from}</span> to <span className="text-slate-200">{to}</span> of <span className="text-slate-200">{total}</span> results</p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm font-medium border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300"
        >
          Previous
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page - 2 + i;
          if (p < 1 || p > pages) return null;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 flex items-center justify-center text-sm font-medium rounded-lg border transition-colors ${p === page ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 text-sm font-medium border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300"
        >
          Next
        </button>
      </div>
    </div>
  );
};

// Confirm Modal
export const ConfirmModal = ({ open, title, message, onConfirm, onCancel, danger }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-8">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Score Bar
export const ScoreBar = ({ score, max = 100 }) => {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-semibold w-9 text-right ${textColor}`}>
        {score}%
      </span>
    </div>
  );
};

