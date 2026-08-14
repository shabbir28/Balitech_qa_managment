import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ClipboardCheck, CheckCircle, XCircle, Users, Phone,
  Database, ListChecks, Target, Send, Activity,
  ArrowRight, TrendingUp, BarChart2, Zap, AlertCircle, Clock
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import DateRangeDropdown from '../common/DateRangeDropdown';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6'];

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
    rose:    'hover:border-rose-500/30 hover:bg-rose-500/[0.03]',
    sky:     'hover:border-sky-500/30 hover:bg-sky-500/[0.03]',
    fuchsia: 'hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.03]',
  };
  const iconMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    indigo:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    teal:    'bg-teal-500/10 text-teal-400 border-teal-500/20',
    violet:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
    sky:     'bg-sky-500/10 text-sky-400 border-sky-500/20',
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  };
  const arrowMap = {
    emerald: 'group-hover:text-emerald-400', indigo: 'group-hover:text-indigo-400',
    teal: 'group-hover:text-teal-400', violet: 'group-hover:text-violet-400',
    amber: 'group-hover:text-amber-400', rose: 'group-hover:text-rose-400',
    sky: 'group-hover:text-sky-400', fuchsia: 'group-hover:text-fuchsia-400',
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
        <ArrowRight className={`w-3.5 h-3.5 text-slate-700 ${arrowMap[color]} transition-colors duration-200 group-hover:translate-x-0.5`} />
      </div>
      <p className="text-[13px] font-semibold text-slate-200 leading-snug">{title}</p>
      <p className="text-[10px] text-slate-600 mt-0.5 font-medium">{desc}</p>
    </button>
  );
};

export default function ManagerDashboard({ stats, charts, startDate, endDate, onChangeDateRange, dialer, onChangeDialer }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const kpis = [
    {
      label: 'Total Evaluations', value: stats?.totalEvaluated?.toLocaleString() ?? '0',
      icon: ClipboardCheck, accent: '#6366f1', bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/20'
    },
    {
      label: 'Calls Passed', value: stats?.passedCalls?.toLocaleString() ?? '0',
      icon: CheckCircle, accent: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20'
    },
    {
      label: 'Calls Failed', value: stats?.failedCalls?.toLocaleString() ?? '0',
      icon: XCircle, accent: '#ef4444', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20'
    },
    {
      label: 'Team Members', value: stats?.totalAgents?.toLocaleString() ?? '—',
      icon: Users, accent: '#38bdf8', bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20'
    },
  ];

  const modules = [
    { title: 'Dialer Search',  desc: 'Search & review leads',        icon: Phone,         color: 'emerald', path: '/dialer' },
    { title: 'Dialer Sales',   desc: 'Live sales by disposition',     icon: Database,      color: 'indigo',  path: '/dialer-sales' },
    { title: 'Compare Sales',  desc: 'Match client approval files',   icon: ListChecks,    color: 'teal',    path: '/dialer-sales/compare' },
    { title: 'Evaluations',    desc: 'QA evaluation records',         icon: ClipboardCheck,color: 'violet',  path: '/evaluations' },
    { title: 'Transfer QA',    desc: 'QA handoff & transfer',         icon: Activity,      color: 'amber',   path: '/transfer-qa' },
    { title: 'Assign Leads',   desc: 'Assign leads to QA agents',     icon: Send,          color: 'rose',    path: '/assign-leads' },
    { title: 'Campaigns',      desc: 'Manage active campaigns',       icon: Target,        color: 'sky',     path: '/campaigns' },
    { title: 'My Team',        desc: 'Manage users & agents',         icon: Users,         color: 'fuchsia', path: '/users' },
  ];

  return (
    <div className="space-y-5 pb-8 max-w-[1400px] mx-auto">

      {/* ── HERO ── */}
      <div className="relative rounded-2xl border border-slate-700/50 p-6">
        {/* decorative blobs */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-emerald-600/8 blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <span className="text-[11px] text-indigo-400 font-bold uppercase tracking-widest">Manager Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},{' '}
              <span className="text-indigo-400">{user?.name?.split(' ')[0] ?? 'Manager'}</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={dialer}
                onChange={(e) => onChangeDialer(e.target.value)}
                className="appearance-none w-36 sm:w-40 bg-slate-900/80 border border-slate-700/80 text-slate-200 text-[11px] sm:text-xs rounded-lg px-3 py-2 pr-8 hover:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all cursor-pointer shadow-sm font-medium"
              >
                <option value="all">All Campaigns</option>
                <option value="medicare">Medicare Only</option>
                <option value="pharmacy">Pharmacy Only</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            <div className="flex items-center">
              <DateRangeDropdown 
                startDate={startDate}
                endDate={endDate}
                onChange={onChangeDateRange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon: Icon, bg, text, border }) => (
          <div key={label} className={`bg-slate-900 border border-slate-800 hover:${border} rounded-xl p-4 flex gap-3 items-center transition-all duration-300 hover:bg-slate-800/50 hover:-translate-y-0.5 group`}>
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

      {/* ── DIALER SALES TODAY ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-400" />
          Today's Dialer Sales
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Sales', value: stats?.dialerStats?.total ?? 0, icon: Database, bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-700' },
            { label: 'Assigned', value: stats?.dialerStats?.assigned ?? 0, icon: Send, bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
            { label: 'Accepted', value: stats?.dialerStats?.accepted ?? 0, icon: CheckCircle, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
            { label: 'Rejected', value: stats?.dialerStats?.rejected ?? 0, icon: XCircle, bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
            { label: 'Flagged', value: stats?.dialerStats?.flagged ?? 0, icon: AlertCircle, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
            { label: 'Pending', value: stats?.dialerStats?.pending ?? 0, icon: Clock, bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' }
          ].map(({ label, value, icon: Icon, bg, text, border }) => (
            <div key={label} className={`bg-slate-800/50 border ${border} rounded-xl p-3 flex flex-col justify-center items-start transition-all duration-300 hover:bg-slate-800 hover:-translate-y-0.5 group`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${bg} flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${text}`} />
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
              </div>
              <p className={`text-2xl font-bold ${text}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white">Team Performance</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Average QA score · last 6 months</p>
            </div>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="h-48">
            {charts?.monthlyPerformance?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.monthlyPerformance} margin={{ top: 5, right: 0, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="avg_score" name="Score" stroke="#6366f1" strokeWidth={2} fill="url(#perfGrad)" dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 4, fill: '#a5b4fc' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-700">
                <BarChart2 className="w-7 h-7" />
                <p className="text-xs">No data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white">Leaderboard</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Top agents by score</p>
            </div>
          </div>
          <div className="h-48">
            {charts?.agentScores?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.agentScores.slice(0, 6).map(a => ({ name: a.agent_name.split(' ')[0], score: parseFloat(a.avg_score) }))}
                  layout="vertical" margin={{ left: 0, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff04' }} />
                  <Bar dataKey="score" name="Score" barSize={9} radius={[0, 3, 3, 0]}>
                    {charts.agentScores.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-700">
                <Users className="w-7 h-7" />
                <p className="text-xs">No agent data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── QUICK ACCESS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Quick Access</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {modules.map(m => <ModuleCard key={m.path} {...m} onClick={navigate} />)}
        </div>
      </div>

    </div>
  );
}
