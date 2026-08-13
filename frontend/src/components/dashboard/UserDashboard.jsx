import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ClipboardCheck, CheckCircle, XCircle, Phone,
  Database, ListChecks, Activity, ArrowRight,
  TrendingUp, BarChart2, Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-950 border border-slate-700/60 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-500 font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const ModuleCard = ({ title, desc, icon: Icon, color, path, onClick }) => {
  const colorMap = {
    emerald: 'hover:border-emerald-500/30 hover:bg-emerald-500/[0.03]',
    indigo:  'hover:border-indigo-500/30 hover:bg-indigo-500/[0.03]',
    teal:    'hover:border-teal-500/30 hover:bg-teal-500/[0.03]',
    violet:  'hover:border-violet-500/30 hover:bg-violet-500/[0.03]',
    amber:   'hover:border-amber-500/30 hover:bg-amber-500/[0.03]',
  };
  const iconMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    indigo:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    teal:    'bg-teal-500/10 text-teal-400 border-teal-500/20',
    violet:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  const arrowMap = {
    emerald: 'group-hover:text-emerald-400', indigo: 'group-hover:text-indigo-400',
    teal: 'group-hover:text-teal-400', violet: 'group-hover:text-violet-400',
    amber: 'group-hover:text-amber-400',
  };

  return (
    <button
      onClick={() => onClick(path)}
      className={`group w-full text-left bg-slate-900/80 border border-slate-800 ${colorMap[color]} rounded-xl p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${iconMap[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <ArrowRight className={`w-3.5 h-3.5 text-slate-700 ${arrowMap[color]} transition-colors duration-200`} />
      </div>
      <p className="text-[13px] font-semibold text-slate-200 leading-snug">{title}</p>
      <p className="text-[10px] text-slate-600 mt-0.5 font-medium">{desc}</p>
    </button>
  );
};

export default function UserDashboard({ stats, charts }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const passRate = stats?.totalEvaluated > 0
    ? Math.round((stats.passedCalls / stats.totalEvaluated) * 100) : 0;

  const kpis = [
    {
      label: 'My Evaluations', value: stats?.totalEvaluated?.toLocaleString() ?? '0',
      icon: ClipboardCheck, bg: 'bg-indigo-500/10', text: 'text-indigo-300',
    },
    {
      label: 'Calls Passed', value: stats?.passedCalls?.toLocaleString() ?? '0',
      icon: CheckCircle, bg: 'bg-emerald-500/10', text: 'text-emerald-300',
    },
    {
      label: 'Calls Failed', value: stats?.failedCalls?.toLocaleString() ?? '0',
      icon: XCircle, bg: 'bg-rose-500/10', text: 'text-rose-300',
    },
  ];

  const modules = [
    { title: 'Dialer Search',   desc: 'Search & review leads',       icon: Phone,          color: 'emerald', path: '/dialer' },
    { title: 'Dialer Sales',    desc: 'Live sales by disposition',    icon: Database,       color: 'indigo',  path: '/dialer-sales' },
    { title: 'Compare Sales',   desc: 'Match client approval files',  icon: ListChecks,     color: 'teal',    path: '/dialer-sales/compare' },
    { title: 'My Assignments',  desc: 'Leads assigned to me',         icon: ClipboardCheck, color: 'violet',  path: '/my-assignments' },
    { title: 'Transfer QA',     desc: 'QA handoff & transfer',        icon: Activity,       color: 'amber',   path: '/transfer-qa' },
  ];

  return (
    <div className="space-y-5 pb-8 max-w-[1400px] mx-auto">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700/50 p-6">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-emerald-600/8 blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <span className="text-[11px] text-violet-400 font-bold uppercase tracking-widest">Agent Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},{' '}
              <span className="text-violet-400">{user?.name?.split(' ')[0] ?? 'Agent'}</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center bg-slate-800/70 border border-slate-700/50 rounded-xl px-5 py-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">My Score</span>
              <span className="text-xl font-bold text-white">{stats?.avgScore ?? 0}%</span>
            </div>
            <div className="flex flex-col items-center bg-emerald-900/20 border border-emerald-500/20 rounded-xl px-5 py-3">
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-0.5">Pass Rate</span>
              <span className="text-xl font-bold text-emerald-300">{passRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3 items-center hover:bg-slate-800/50 hover:-translate-y-0.5 transition-all duration-300">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg} flex-shrink-0`}>
              <Icon className={`w-[18px] h-[18px] ${text}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-xl font-bold ${text}`}>{value}</p>
              <p className="text-[11px] text-slate-500 font-medium truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── PERFORMANCE CHART ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-white">My Performance Trend</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Average QA score · last 6 months</p>
          </div>
          <TrendingUp className="w-4 h-4 text-violet-400" />
        </div>
        <div className="h-44">
          {charts?.monthlyPerformance?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.monthlyPerformance} margin={{ top: 5, right: 0, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="userPerfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="avg_score" name="Score" stroke="#8b5cf6" strokeWidth={2} fill="url(#userPerfGrad)" dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 4, fill: '#c4b5fd' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-700">
              <BarChart2 className="w-7 h-7" />
              <p className="text-xs">No data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── QUICK ACCESS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Quick Access</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {modules.map(m => <ModuleCard key={m.path} {...m} onClick={navigate} />)}
        </div>
      </div>

    </div>
  );
}
