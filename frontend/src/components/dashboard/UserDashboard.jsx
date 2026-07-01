import { ClipboardCheck, CheckCircle, XCircle, AlertTriangle, MessageSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const C = ['#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs font-bold" style={{ color: p.color }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </div>
          <span className="text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const MetricCard = ({ title, value, sub, icon: Icon, color, trend, trendLabel }) => (
  <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-500">
    <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 bg-${color}-500`} />
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-${color}-500/10 text-${color}-400 border border-${color}-500/20 shadow-inner`}>
        <Icon className="w-6 h-6" />
      </div>
      {trend !== undefined && (
        <div className={`flex flex-col items-end`}>
          <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
          {trendLabel && <span className="text-[9px] text-slate-500 mt-1 font-medium">{trendLabel}</span>}
        </div>
      )}
    </div>
    <div className="relative z-10">
      <h3 className="text-4xl font-black text-white tracking-tight mb-1">{value ?? '—'}</h3>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  </div>
);

const ChartContainer = ({ title, sub, children }) => (
  <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-all duration-500">
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
      {sub && <p className="text-xs text-slate-400 font-medium mt-1">{sub}</p>}
    </div>
    <div className="h-[280px]">
      {children}
    </div>
  </div>
);

export default function UserDashboard({ stats, charts }) {
  const passRate = stats?.totalEvaluated > 0 ? Math.round((stats.passedCalls / stats.totalEvaluated) * 100) : 0;

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-2">
            My Performance
          </h1>
          <p className="text-slate-400 font-medium text-sm">Your personal QA scores, evaluations, and feedback.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-indigo-500/10 border border-indigo-500/20 px-6 py-3 rounded-2xl flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 mb-1">My Avg Score</span>
            <span className="text-2xl font-black text-white">{stats?.avgScore ?? 0}%</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-1">My Pass Rate</span>
            <span className="text-2xl font-black text-white">{passRate}%</span>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="Evaluations" value={stats?.totalEvaluated?.toLocaleString()} sub="Total forms submitted on my calls" icon={ClipboardCheck} color="indigo" />
        <MetricCard title="Passed Calls" value={stats?.passedCalls?.toLocaleString()} sub="Score >= 75%" icon={CheckCircle} color="emerald" />
        <MetricCard title="Failed Calls" value={stats?.failedCalls?.toLocaleString()} sub="Score < 75% or critical error" icon={XCircle} color="rose" />
        <MetricCard title="Pending Feedback" value={stats?.pendingFeedback?.toLocaleString()} sub="Requires my signature" icon={MessageSquare} color="amber" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer title="My Monthly Trend" sub="Average QA score over the last 6 months">
            {charts?.monthlyPerformance?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.monthlyPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAvgUser" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="avg_score" name="My Score (%)" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorAvgUser)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-500 font-medium">No trend data</div>}
          </ChartContainer>
        </div>
        
        <div>
          <ChartContainer title="My Feedback Status" sub="Acknowledgment pipeline">
            {charts?.feedbackStatus?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.feedbackStatus.map(d => ({ name: d.feedback_status, value: parseInt(d.count) }))} cx="50%" cy="45%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                    {charts.feedbackStatus.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-500 font-medium">No feedback data</div>}
          </ChartContainer>
        </div>
      </div>

      {charts?.criticalErrorSummary?.length > 0 && (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-all duration-500">
          <div className="px-8 py-6 border-b border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertTriangle className="w-6 h-6" /></div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">My Critical Errors</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">Violations flagged on my evaluations</p>
            </div>
          </div>
          <div className="p-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  {['Incident Type', 'Severity', 'Frequency'].map((h, i) => (
                    <th key={h} className={`py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 ${i === 2 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {charts.criticalErrorSummary.map((err, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 text-sm font-bold text-slate-200">{err.error_type}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${err.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : err.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>{err.severity}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-sm font-black text-white">{err.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
