import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { StatCard, LoadingPage, Badge } from '../components/ui';
import {
  Phone, ClipboardCheck, TrendingUp, CheckCircle, XCircle,
  AlertTriangle, MessageSquare, ThumbsUp, BarChart3, Users,
  Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['#10b981', '#14b8a6', '#0ea5e9', '#6366f1', '#f59e0b', '#ef4444'];

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, chartsRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/charts'),
        ]);
        setStats(statsRes.data.data);
        setCharts(chartsRes.data.data);
      } catch {
        toast.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingPage />;

  const statCards = [
    { title: 'Total Evaluated', value: stats?.totalEvaluated, icon: ClipboardCheck, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', sub: 'Total QA forms submitted' },
    { title: 'Average QA Score', value: `${stats?.avgScore}%`, icon: Activity, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', sub: 'Across all campaigns' },
    { title: 'Passed Calls', value: stats?.passedCalls, icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', sub: 'Score > 75% & No CE' },
    { title: 'Failed Calls', value: stats?.failedCalls, icon: XCircle, color: 'bg-red-500/10 text-red-400 border border-red-500/20', sub: 'Score < 75% or CE found' },
    { title: 'Critical Errors', value: stats?.criticalErrors, icon: AlertTriangle, color: 'bg-orange-500/10 text-orange-400 border border-orange-500/20', sub: 'Severe compliance flags' },
    { title: 'Pending Feedback', value: stats?.pendingFeedback, icon: MessageSquare, color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', sub: 'Awaiting agent review' },
    { title: 'Total Leads/Calls', value: stats?.totalCalls, icon: Phone, color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', sub: 'Uploaded system records' },
    { title: 'Acknowledged', value: stats?.acknowledgedFeedback, icon: ThumbsUp, color: 'bg-teal-500/10 text-teal-400 border border-teal-500/20', sub: 'Agent signed off' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-5 py-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
            <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Global Score</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-emerald-400">{stats?.avgScore}%</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Charts Section 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Monthly Performance (Span 2) */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                Performance Matrix
              </h3>
              <p className="text-sm text-slate-400 mt-1">Average score and pass/fail distribution</p>
            </div>
          </div>
          {charts?.monthlyPerformance?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={charts.monthlyPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2028" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #222630', backgroundColor: '#16191f', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 700 }}
                  labelStyle={{ color: '#a1a1aa', fontWeight: 700, marginBottom: '8px', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 700, color: '#a1a1aa' }} />
                <Area type="monotone" dataKey="avg_score" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" name="Avg Score (%)" />
                <Line type="monotone" dataKey="passed" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: '#16191f' }} name="Passed Calls" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: '#16191f' }} name="Failed Calls" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-slate-600 text-[10px] font-bold uppercase tracking-widest bg-dark border border-dark-border rounded-xl">Insufficient data</div>
          )}
        </div>

        {/* Feedback Status (Span 1) */}
        <div className="card">
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-500" />
              Feedback Protocol
            </h3>
            <p className="text-sm text-slate-400 mt-1">Status of agent coaching</p>
          </div>
          {charts?.feedbackStatus?.length > 0 ? (
            <div className="flex flex-col items-center justify-center h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.feedbackStatus.map(d => ({ name: d.feedback_status, value: parseInt(d.count) }))}
                    cx="50%" cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {charts.feedbackStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #222630', backgroundColor: '#16191f' }}
                    itemStyle={{ fontSize: '11px', fontWeight: 700 }}
                  />
                  <Legend iconType="circle" layout="vertical" verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', fontWeight: 700, color: '#a1a1aa' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-slate-600 text-[10px] font-bold uppercase tracking-widest bg-dark border border-dark-border rounded-xl">No feedback data</div>
          )}
        </div>
      </div>

      {/* Charts Section 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Agent-wise Score */}
        <div className="card">
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Top Operators
            </h3>
            <p className="text-sm text-slate-400 mt-1">Average score by agent</p>
          </div>
          {charts?.agentScores?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.agentScores.map(a => ({ name: a.agent_name.split(' ')[0], score: parseFloat(a.avg_score) }))} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1c2028" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip 
                  cursor={{ fill: '#1c2028' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #222630', backgroundColor: '#16191f' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 700 }}
                />
                <Bar dataKey="score" fill="#10b981" radius={[0, 4, 4, 0]} name="Avg Score (%)" barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-slate-600 text-[10px] font-bold uppercase tracking-widest bg-dark border border-dark-border rounded-xl">No operator data</div>
          )}
        </div>

        {/* Campaign-wise Score */}
        <div className="card">
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Campaign Diagnostics
            </h3>
            <p className="text-sm text-slate-400 mt-1">Pass vs Fail ratio</p>
          </div>
          {charts?.campaignScores?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.campaignScores.map(c => ({ name: c.campaign_name, passed: parseInt(c.passed), failed: parseInt(c.failed) }))} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2028" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#1c2028' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #222630', backgroundColor: '#16191f' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 700 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px', fontWeight: 700, color: '#a1a1aa' }} />
                <Bar dataKey="passed" stackId="a" fill="#14b8a6" radius={[0, 0, 4, 4]} name="Passed" barSize={20} />
                <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Failed" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-slate-600 text-[10px] font-bold uppercase tracking-widest bg-dark border border-dark-border rounded-xl">No campaign data</div>
          )}
        </div>
      </div>

      {/* Critical Error Summary Table */}
      {charts?.criticalErrorSummary?.length > 0 && (
        <div className="card overflow-hidden !p-0">
          <div className="p-6 border-b border-slate-800">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Critical Incident Logs
            </h3>
            <p className="text-sm text-slate-400 mt-1">Most frequent compliance errors</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">Incident Signature</th>
                  <th className="th w-32">Threat Level</th>
                  <th className="th w-32 text-right">Frequency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border bg-dark-card/30">
                {charts.criticalErrorSummary.map((err, i) => (
                  <tr key={i} className="tr">
                    <td className="td font-bold text-white">{err.error_type}</td>
                    <td className="td"><Badge status={err.severity} /></td>
                    <td className="td text-right">
                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-500/10 text-red-400 font-bold border border-red-500/20 text-xs">
                        {err.count}
                      </div>
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
};

export default DashboardPage;
