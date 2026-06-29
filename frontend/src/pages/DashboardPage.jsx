import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Phone, ClipboardCheck, CheckCircle, XCircle, AlertTriangle, MessageSquare, ThumbsUp, BarChart3, Users, Activity, ArrowUpRight, ShieldAlert, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, Line } from 'recharts';

const C = ['#6366f1','#10b981','#f59e0b','#ef4444','#14b8a6','#8b5cf6'];

const CTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs font-bold" style={{ color: p.color }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="text-white ml-1">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const KpiCard = ({ title, value, sub, icon: Icon, blob, iconCls, accentBar, trend }) => (
  <div className="relative overflow-hidden rounded-2xl bg-[#0d1117] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 group cursor-default">
    {/* Top gradient accent bar */}
    <div className={`absolute top-0 left-0 right-0 h-[2px] ${accentBar} opacity-70 group-hover:opacity-100 transition-opacity`} />
    {/* Background glow blob */}
    <div className={`absolute -bottom-10 -right-10 w-36 h-36 rounded-full opacity-10 blur-3xl ${blob} group-hover:opacity-20 transition-opacity`} />
    <div className="relative z-10 p-5">
      <div className="flex items-start justify-between mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${iconCls} shadow-inner`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-[9px] font-black px-2 py-1 rounded-lg border ${
            trend >= 0
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            <ArrowUpRight className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[28px] font-black text-white tracking-tight leading-none mb-2">{value ?? '—'}</p>
      <p className="text-[11px] font-bold text-slate-300 leading-snug mb-1">{title}</p>
      {sub && <p className="text-[10px] text-slate-500 leading-relaxed">{sub}</p>}
    </div>
  </div>
);

const CC = ({ title, sub, icon: Icon, icls, children, className = '' }) => (
  <div className={`bg-[#0d1117] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-all duration-300 ${className}`}>
    <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-white/[0.05]">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-inner ${icls}`}><Icon className="w-4 h-4" /></div>
      <div>
        <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{sub}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const Empty = ({ msg = 'Insufficient data' }) => (
  <div className="h-[210px] flex flex-col items-center justify-center gap-3 border border-dashed border-white/[0.04] rounded-xl bg-white/[0.01]">
    <Zap className="w-6 h-6 text-slate-700" />
    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{msg}</p>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/dashboard/stats'), api.get('/dashboard/charts')])
      .then(([s, c]) => { setStats(s.data.data); setCharts(c.data.data); })
      .catch(() => toast.error('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading Analytics...</p>
    </div>
  );

  const passRate = stats?.totalEvaluated > 0 ? Math.round((stats.passedCalls / stats.totalEvaluated) * 100) : 0;

  const kpis = [
    { title: 'Evaluations Completed', value: stats?.totalEvaluated?.toLocaleString(), sub: 'Total QA evaluations submitted', icon: ClipboardCheck, blob: 'bg-indigo-500', iconCls: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400', accentBar: 'bg-gradient-to-r from-indigo-500 to-indigo-400', trend: 12 },
    { title: 'Overall QA Score', value: `${stats?.avgScore ?? 0}%`, sub: 'Weighted average across campaigns', icon: Activity, blob: 'bg-emerald-500', iconCls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', accentBar: 'bg-gradient-to-r from-emerald-500 to-teal-400', trend: 4 },
    { title: 'Calls Passed', value: stats?.passedCalls?.toLocaleString(), sub: 'Score ≥ 75% with no critical errors', icon: CheckCircle, blob: 'bg-teal-500', iconCls: 'bg-teal-500/10 border-teal-500/20 text-teal-400', accentBar: 'bg-gradient-to-r from-teal-500 to-emerald-400', trend: 8 },
    { title: 'Calls Failed', value: stats?.failedCalls?.toLocaleString(), sub: 'Score < 75% or critical error found', icon: XCircle, blob: 'bg-rose-500', iconCls: 'bg-rose-500/10 border-rose-500/20 text-rose-400', accentBar: 'bg-gradient-to-r from-rose-500 to-rose-400', trend: -3 },
    { title: 'Critical Errors', value: stats?.criticalErrors?.toLocaleString(), sub: 'Severe compliance violations flagged', icon: ShieldAlert, blob: 'bg-orange-500', iconCls: 'bg-orange-500/10 border-orange-500/20 text-orange-400', accentBar: 'bg-gradient-to-r from-orange-500 to-amber-400' },
    { title: 'Pending Feedback', value: stats?.pendingFeedback?.toLocaleString(), sub: 'Awaiting agent acknowledgment', icon: MessageSquare, blob: 'bg-amber-500', iconCls: 'bg-amber-500/10 border-amber-500/20 text-amber-400', accentBar: 'bg-gradient-to-r from-amber-500 to-yellow-400' },
    { title: 'Total Call Records', value: stats?.totalCalls?.toLocaleString(), sub: 'System-wide uploaded call records', icon: Phone, blob: 'bg-blue-500', iconCls: 'bg-blue-500/10 border-blue-500/20 text-blue-400', accentBar: 'bg-gradient-to-r from-blue-500 to-sky-400' },
    { title: 'Acknowledged', value: stats?.acknowledgedFeedback?.toLocaleString(), sub: 'Agents signed off on feedback', icon: ThumbsUp, blob: 'bg-violet-500', iconCls: 'bg-violet-500/10 border-violet-500/20 text-violet-400', accentBar: 'bg-gradient-to-r from-violet-500 to-purple-400' },
  ];

  return (
    <div className="space-y-7 pb-10">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-4">
            <Activity className="w-3 h-3" /> Live Analytics Dashboard
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Performance Overview</h1>
          <p className="text-slate-400 text-xs mt-1.5 font-medium leading-relaxed">Real-time QA metrics, campaign health, and agent performance diagnostics.</p>
        </div>

        {/* Score Pill Cards */}
        <div className="flex items-stretch gap-3 flex-shrink-0">
          {[
            { label: 'Pass Rate', val: `${passRate}%`, numVal: passRate, sub: 'of total evaluations', gradient: 'from-indigo-500 via-violet-500 to-indigo-400', valCls: 'text-white', glowCls: 'shadow-[0_0_30px_rgba(99,102,241,0.15)]' },
            { label: 'Avg QA Score', val: `${stats?.avgScore ?? 0}%`, numVal: stats?.avgScore ?? 0, sub: 'weighted average', gradient: 'from-emerald-500 to-teal-400', valCls: 'text-emerald-400', glowCls: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]' },
          ].map(pill => (
            <div key={pill.label} className={`bg-[#0d1117] border border-white/[0.07] rounded-2xl px-6 py-4 min-w-[155px] hover:border-white/[0.12] transition-all ${pill.glowCls}`}>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">{pill.label}</p>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className={`text-3xl font-black tracking-tight ${pill.valCls}`}>{pill.val}</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-3">{pill.sub}</p>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${pill.gradient} rounded-full transition-all duration-700`} style={{ width: `${Math.min(pill.numVal, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => <KpiCard key={k.title} {...k} />)}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <CC className="lg:col-span-2" title="Performance Trend" sub="Monthly avg score & pass/fail distribution" icon={Activity} icls="bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
          {charts?.monthlyPerformance?.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={charts.monthlyPerformance} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} dy={8} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CTip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 700, color: '#64748b' }} />
                <Area type="monotone" dataKey="avg_score" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#gS)" name="Avg Score (%)" dot={{ r: 2.5, fill: '#6366f1', strokeWidth: 0 }} />
                <Line type="monotone" dataKey="passed" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5, fill: '#10b981', strokeWidth: 0 }} name="Passed" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5, fill: '#ef4444', strokeWidth: 0 }} name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </CC>
        <CC title="Feedback Status" sub="Agent coaching pipeline" icon={MessageSquare} icls="bg-violet-500/10 border-violet-500/20 text-violet-400">
          {charts?.feedbackStatus?.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={charts.feedbackStatus.map(d => ({ name: d.feedback_status, value: parseInt(d.count) }))} cx="50%" cy="42%" innerRadius={55} outerRadius={78} paddingAngle={4} dataKey="value" stroke="none">
                  {charts.feedbackStatus.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                </Pie>
                <Tooltip content={<CTip />} />
                <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', fontWeight: 700, color: '#64748b', paddingTop: '6px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty msg="No feedback data" />}
        </CC>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CC title="Agent Leaderboard" sub="Average QA score — top performers" icon={Users} icls="bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
          {charts?.agentScores?.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={charts.agentScores.map(a => ({ name: a.agent_name.split(' ')[0], score: parseFloat(a.avg_score) }))} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="#ffffff08" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<CTip />} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} name="Avg Score (%)" barSize={13}>
                  {charts.agentScores.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty msg="No agent data" />}
        </CC>
        <CC title="Campaign Diagnostics" sub="Pass vs fail ratio per campaign" icon={BarChart3} icls="bg-teal-500/10 border-teal-500/20 text-teal-400">
          {charts?.campaignScores?.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={charts.campaignScores.map(c => ({ name: c.campaign_name, passed: parseInt(c.passed), failed: parseInt(c.failed) }))} margin={{ bottom: 14, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CTip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '14px', fontWeight: 700, color: '#64748b' }} />
                <Bar dataKey="passed" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} name="Passed" barSize={22} />
                <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Failed" barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty msg="No campaign data" />}
        </CC>
      </div>

      {/* Critical Error Table */}
      {charts?.criticalErrorSummary?.length > 0 && (
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-400"><AlertTriangle className="w-4 h-4" /></div>
            <div>
              <h3 className="text-sm font-bold text-white">Critical Incident Log</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Most frequent compliance violations</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02]">
                  {['#', 'Incident Type', 'Severity', 'Frequency'].map((h, i) => (
                    <th key={h} className={`py-3 px-6 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {charts.criticalErrorSummary.map((err, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-6 text-xs text-slate-600 font-bold">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-3.5 px-6 text-xs font-bold text-white">{err.error_type}</td>
                    <td className="py-3.5 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${err.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : err.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>{err.severity}</span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 font-black border border-rose-500/20 text-xs">{err.count}</span>
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
