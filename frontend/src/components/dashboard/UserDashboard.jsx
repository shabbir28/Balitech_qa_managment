import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, ClipboardCheck, CheckCircle, XCircle, Award,
  Database, ArrowRight, AlertCircle, Clock,
  ShoppingCart, Flag, ChevronDown, ArrowUpRight, FileText, Send,
  Activity, Check, BarChart3, Zap
} from 'lucide-react';
import {
  AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import DateRangeDropdown from '../common/DateRangeDropdown';
import UserProfileDropdown from '../common/UserProfileDropdown';
import { getEstFormattedDate, getEstTimeOfDay } from '../../utils/dateUtils';

const CustomPerformanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0E18]/95 border border-slate-800 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-2xl text-xs font-sans">
      <p className="text-slate-400 font-bold mb-1.5 border-b border-slate-800 pb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-slate-400">{p.name}:</span>
          </div>
          <span className="text-white font-black">
            {p.name.toLowerCase().includes('score') || p.name.toLowerCase().includes('rate')
              ? `${p.value}%`
              : Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function UserDashboard({ stats, charts, startDate, endDate, onChangeDateRange, dialer, onChangeDialer }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const timeOfDay = useMemo(() => getEstTimeOfDay(new Date()), []);
  const currentDateString = useMemo(() => getEstFormattedDate(new Date()), []);

  // Chart interaction states
  const [chartMetric, setChartMetric] = useState('score'); // 'score' | 'volume'
  const [chartTimeframe, setChartTimeframe] = useState('monthly'); // 'monthly' | 'daily'

  // Performance calculations
  const activeChartData = useMemo(() => {
    if (chartTimeframe === 'daily') {
      if (charts?.dailyPerformance?.length) {
        return charts.dailyPerformance.map(d => {
          const passed = parseInt(d.passed || 0);
          const failed = parseInt(d.failed || 0);
          const judged = passed + failed;
          return {
            period: d.short_date || d.day_label,
            full_label: d.day_label,
            volume: parseInt(d.total_volume || 0),
            passed,
            // Daily rows carry no score column; the pass rate is the honest stand-in.
            avg_score: judged ? Math.round((passed / judged) * 100) : 0,
          };
        });
      }
    }

    // Default: monthly performance from database
    if (charts?.monthlyPerformance?.length) {
      return charts.monthlyPerformance.map(m => ({
        period: m.month,
        full_label: `${m.month} Performance`,
        volume: parseInt(m.total_volume || m.total || 0),
        passed: parseInt(m.passed || 0),
        avg_score: Math.round(Number(m.avg_score) || 0),
      }));
    }

    return [];
  }, [charts, chartTimeframe]);

  const { avgScore, peakScore, totalVolume, trendPercent, isTrendUp } = useMemo(() => {
    if (!activeChartData.length) {
      return { avgScore: 0, peakScore: 0, totalVolume: 0, trendPercent: '0%', isTrendUp: true };
    }
    const scores = activeChartData.map(d => d.avg_score);
    const volumes = activeChartData.map(d => d.volume);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const peak = chartMetric === 'volume' ? Math.max(...volumes) : Math.max(...scores);
    const totalVol = volumes.reduce((a, b) => a + b, 0);

    const metricKey = chartMetric === 'volume' ? 'volume' : 'avg_score';
    const lastVal = activeChartData[activeChartData.length - 1]?.[metricKey] || 0;
    const prevVal = activeChartData[activeChartData.length - 2]?.[metricKey] ?? lastVal;
    const isUp = lastVal >= prevVal;
    const delta = prevVal ? ((lastVal - prevVal) / prevVal) * 100 : 0;

    return {
      avgScore: avg,
      peakScore: peak,
      totalVolume: totalVol,
      trendPercent: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
      isTrendUp: isUp,
    };
  }, [activeChartData, chartMetric]);

  const salesItems = [
    {
      label: 'TOTAL SALES',
      value: stats?.dialerStats?.total ?? 0,
      icon: ShoppingCart,
      color: 'text-white',
      barColor: 'bg-slate-600',
      onClick: () => navigate(`/dialer-sales/history?start=${startDate}&end=${endDate}&dialer=${dialer === 'all' ? 'medicare' : dialer}&qaStatus=All`)
    },
    {
      label: 'ASSIGNED',
      value: stats?.dialerStats?.assigned ?? 0,
      icon: Send,
      color: 'text-sky-400',
      barColor: 'bg-sky-500',
      onClick: () => navigate('/my-assignments')
    },
    {
      label: 'ACCEPTED',
      value: stats?.dialerStats?.accepted ?? 0,
      icon: CheckCircle,
      color: 'text-emerald-400',
      barColor: 'bg-emerald-500',
      onClick: () => navigate(`/dialer-sales/history?start=${startDate}&end=${endDate}&dialer=${dialer === 'all' ? 'medicare' : dialer}&qaStatus=Accepted`)
    },
    {
      label: 'REJECTED',
      value: stats?.dialerStats?.rejected ?? 0,
      icon: XCircle,
      color: 'text-rose-500',
      barColor: 'bg-rose-500',
      onClick: () => navigate(`/dialer-sales/history?start=${startDate}&end=${endDate}&dialer=${dialer === 'all' ? 'medicare' : dialer}&qaStatus=Rejected`)
    },
    {
      label: 'FLAGGED',
      value: stats?.dialerStats?.flagged ?? 0,
      icon: Flag,
      color: 'text-amber-400',
      barColor: 'bg-amber-500',
      onClick: () => navigate(`/dialer-sales/history?start=${startDate}&end=${endDate}&dialer=${dialer === 'all' ? 'medicare' : dialer}&qaStatus=Flagged`)
    },
    {
      label: 'PENDING',
      value: stats?.dialerStats?.pending ?? 0,
      icon: Clock,
      color: 'text-slate-300',
      barColor: 'bg-slate-600',
      onClick: () => navigate(`/dialer-sales/history?start=${startDate}&end=${endDate}&dialer=${dialer === 'all' ? 'medicare' : dialer}&qaStatus=Pending`)
    }
  ];

  return (
    <div className="space-y-5 pb-10 max-w-[1440px] mx-auto text-slate-100 font-sans">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-500/5 text-amber-400 text-[10px] font-bold tracking-wider uppercase mb-2">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>AGENT DASHBOARD</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-200 tracking-tight">
            Good {timeOfDay},{' '}
            <span className="font-black text-white">{user?.name || 'Agent'}</span>
          </h1>
          <p className="text-slate-400 text-xs font-normal mt-1">
            {currentDateString}
          </p>
        </div>

        {/* Filters + Top Bar User Widget */}
        <div className="flex items-center gap-4 sm:gap-6 self-start lg:self-auto flex-wrap sm:flex-nowrap">
          {/* Left-shifted Filters */}
          <div className="flex items-center gap-2.5">
            {/* Dialer Dropdown */}
            <div className="relative">
              <select
                value={dialer}
                onChange={(e) => onChangeDialer(e.target.value)}
                className="appearance-none bg-[#0D111D] border border-slate-800 text-slate-300 text-xs font-medium rounded-xl px-4 py-2.5 pr-9 hover:border-slate-700 focus:outline-none focus:border-amber-500/50 transition-all cursor-pointer shadow-sm"
              >
                <option value="all">All Campaigns</option>
                <option value="medicare">Medicare Only</option>
                <option value="pharmacy">Pharmacy Only</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Date Range Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
                <Clock className="w-3 h-3 text-amber-400" /> EST
              </span>
              <DateRangeDropdown 
                startDate={startDate}
                endDate={endDate}
                onChange={onChangeDateRange}
              />
            </div>
          </div>

          {/* Profile Icon Dropdown with Person Emoji (Separated on the Right) */}
          <div className="pl-3 sm:pl-4 border-l border-slate-800/80">
            <UserProfileDropdown />
          </div>
        </div>
      </div>

      {/* ── 4 KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* My Evaluations */}
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <ClipboardCheck className="w-4 h-4 text-slate-400" />
            <span className="bg-slate-800/60 text-slate-400 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase">
              Today
            </span>
          </div>
          <div className="my-3">
            <p className="text-4xl font-extrabold text-white tracking-tight">
              {stats?.totalEvaluated?.toLocaleString() ?? '0'}
            </p>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            MY EVALUATIONS
          </p>
        </div>

        {/* Calls Passed - Neon Green Glow */}
        <div className="bg-[#0D111D] border border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.18)] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="bg-slate-800/60 text-slate-400 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase">
              Today
            </span>
          </div>
          <div className="my-3">
            <p className="text-4xl font-extrabold text-emerald-400 tracking-tight">
              {stats?.passedCalls?.toLocaleString() ?? '0'}
            </p>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            CALLS PASSED
          </p>
        </div>

        {/* Calls Failed - Neon Red Glow */}
        <div className="bg-[#0D111D] border border-rose-500/70 shadow-[0_0_25px_rgba(239,68,68,0.18)] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <XCircle className="w-4 h-4 text-rose-500" />
            <span className="bg-slate-800/60 text-slate-400 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase">
              Today
            </span>
          </div>
          <div className="my-3">
            <p className="text-4xl font-extrabold text-rose-500 tracking-tight">
              {stats?.failedCalls?.toLocaleString() ?? '0'}
            </p>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            CALLS FAILED
          </p>
        </div>

        {/* My QA Score - Neon Amber Glow */}
        <div className="bg-[#0D111D] border border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.18)] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="bg-slate-800/60 text-slate-400 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase">
              Today
            </span>
          </div>
          <div className="my-3">
            <p className="text-4xl font-extrabold text-amber-400 tracking-tight">
              {stats?.avgScore ? `${Math.round(stats.avgScore)}%` : '—'}
            </p>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            MY QA SCORE
          </p>
        </div>
      </div>

      {/* ── TODAY'S DIALER SALES ── */}
      <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Today's Dialer Sales
            </h2>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
          </div>
        </div>

        {/* 6 Mini Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {salesItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full text-left bg-[#0A0E18] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {item.label}
                </span>
                <item.icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
              </div>
              <p className={`text-2xl font-bold ${item.color}`}>
                {item.value}
              </p>
              {/* Mini 5-bar visualizer */}
              <div className="flex items-end gap-1 mt-3 h-4">
                <div className={`w-1 h-1.5 rounded-sm ${item.barColor} opacity-90`} />
                <div className={`w-1 h-3 rounded-sm ${item.barColor} opacity-90`} />
                <div className={`w-1 h-4 rounded-sm ${item.barColor} opacity-90`} />
                <div className={`w-1 h-2.5 rounded-sm ${item.barColor} opacity-90`} />
                <div className={`w-1 h-3.5 rounded-sm ${item.barColor} opacity-90`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── HIGH-PERFORMANCE INTERACTIVE CHART ── */}
      <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between relative shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">My Performance & Quality Trends</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                <Activity className="w-3 h-3" />
                PERSONAL TRACKER
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {chartMetric === 'score' ? 'Your personal QA score trajectory over time' : 'Total calls and evaluated volume'}
            </p>
          </div>

          {/* Interactive Metric Mode & Timeframe Switchers */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Metric Mode Switcher */}
            <div className="flex items-center bg-[#0A0E18] border border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                onClick={() => setChartMetric('score')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  chartMetric === 'score'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Quality (%)
              </button>
              <button
                onClick={() => setChartMetric('volume')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  chartMetric === 'volume'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Volume
              </button>
            </div>

            {/* Timeframe Switcher */}
            <div className="flex items-center bg-[#0A0E18] border border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                onClick={() => setChartTimeframe('monthly')}
                className={`px-2 py-1 rounded-md transition-all ${
                  chartTimeframe === 'monthly'
                    ? 'bg-slate-700 text-white font-black'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                6M
              </button>
              <button
                onClick={() => setChartTimeframe('daily')}
                className={`px-2 py-1 rounded-md transition-all ${
                  chartTimeframe === 'daily'
                    ? 'bg-slate-700 text-white font-black'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                14D
              </button>
            </div>
          </div>
        </div>

        {/* Render Chart */}
        <div className="h-56 sm:h-60 w-full">
          {activeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {chartMetric === 'score' ? (
                <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="agentAmberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="60%" stopColor="#f59e0b" stopOpacity={0.10} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#161C2C" vertical={false} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#475569" 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    ticks={[0, 25, 50, 75, 100]} 
                    stroke="#475569" 
                    tick={{ fill: '#64748b', fontSize: 10 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip content={<CustomPerformanceTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="avg_score" 
                    name="My QA Score"
                    stroke="#f59e0b" 
                    strokeWidth={2.8} 
                    fill="url(#agentAmberGrad)" 
                    dot={{ r: 3.5, fill: '#f59e0b', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} 
                  />
                </AreaChart>
              ) : (
                <ComposedChart data={activeChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="agentVolGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#161C2C" vertical={false} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#475569" 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#475569" 
                    tick={{ fill: '#64748b', fontSize: 10 }} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip content={<CustomPerformanceTooltip />} />
                  <Bar 
                    dataKey="volume" 
                    name="Total Volume" 
                    fill="url(#agentVolGrad)" 
                    radius={[4, 4, 0, 0]} 
                    barSize={18}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="passed" 
                    name="Passed Calls" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
              <BarChart3 className="w-8 h-8" />
              <p className="text-xs">No performance records in selected range</p>
            </div>
          )}
        </div>

        {/* Bottom Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 mt-3 border-t border-slate-800/60">
          <div className="bg-[#0A0E18] border border-slate-800/60 rounded-xl px-3.5 py-2">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">AVG SCORE</p>
            <p className="text-lg sm:text-xl font-bold text-white">{avgScore}%</p>
          </div>
          <div className="bg-[#0A0E18] border border-slate-800/60 rounded-xl px-3.5 py-2">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              {chartMetric === 'volume' ? 'PEAK VOLUME' : 'PEAK SCORE'}
            </p>
            <p className="text-lg sm:text-xl font-bold text-white">
              {chartMetric === 'volume' ? peakScore.toLocaleString() : `${peakScore}%`}
            </p>
          </div>
          <div className="bg-[#0A0E18] border border-slate-800/60 rounded-xl px-3.5 py-2">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">VOLUME</p>
            <p className="text-lg sm:text-xl font-bold text-amber-400">{totalVolume.toLocaleString()}</p>
          </div>
          <div className="bg-[#0A0E18] border border-slate-800/60 rounded-xl px-3.5 py-2">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">TREND</p>
            <p className={`text-lg sm:text-xl font-bold ${isTrendUp ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-1`}>
              <ArrowUpRight className="w-4 h-4" />
              {trendPercent}
            </p>
          </div>
        </div>
      </div>

      {/* ── AGENT QA WORKBENCH & LIVE ACTIVITY STREAM (Replaces Quick Access) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
        {/* Left 2 Cols: Next Lead in Queue + Recent Audited Calls Stream */}
        <div className="lg:col-span-2 space-y-4">
          {/* Next in Queue Priority Action Card */}
          {stats?.nextPendingCall ? (
            <div className="bg-gradient-to-r from-amber-500/15 via-[#0D111D] to-[#0A0E18] border border-amber-500/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(245,158,11,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black border border-amber-500/40">
                    <Zap className="w-3 h-3" />
                    NEXT IN QUEUE
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {stats.nextPendingCall.campaign_name || 'Medicare Campaign'}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📞 {stats.nextPendingCall.customer_phone || 'Customer Lead'}</span>
                  {stats.nextPendingCall.customer_name && (
                    <span className="text-slate-400 font-normal text-xs">({stats.nextPendingCall.customer_name})</span>
                  )}
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ready for evaluation. Listen to call recording and submit scorecard.
                </p>
              </div>
              <button
                onClick={() => navigate('/my-assignments')}
                className="self-start sm:self-center px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 hover:-translate-y-0.5 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>⚡ Start Evaluation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Queue Clear</h4>
                  <p className="text-[10px] text-slate-400">All assigned calls evaluated. Great job!</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/my-assignments')}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                View Assignments →
              </button>
            </div>
          )}

          {/* Recent Evaluations Feed */}
          <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">My Recent Evaluated Calls</h3>
                  <p className="text-[11px] text-slate-400">Your latest audit submissions and scoring results</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/my-assignments')}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                View All →
              </button>
            </div>

            <div className="space-y-2">
              {stats?.recentEvaluations && stats.recentEvaluations.length > 0 ? (
                stats.recentEvaluations.slice(0, 5).map((evalItem, idx) => {
                  const score = Math.round(Number(evalItem.total_score) || 0);
                  const isPass = evalItem.status === 'Accepted' || evalItem.status === 'Pass';
                  const isFail = evalItem.status === 'Rejected' || evalItem.status === 'Fail';
                  
                  return (
                    <div
                      key={evalItem.evaluation_id || idx}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0E18] border border-slate-800/70 hover:border-slate-700 hover:bg-[#0c111f] rounded-xl px-4 py-3 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isPass ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                          isFail ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                          'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>
                          {isPass ? '✓' : isFail ? '✕' : '•'}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors truncate">
                              📞 {evalItem.customer_phone || 'Call Audit'}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                              {evalItem.campaign_name || 'Medicare'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>Agent: {evalItem.agent_name || 'Sales Rep'}</span>
                            {evalItem.call_duration && (
                              <span className="text-[10px] text-slate-500">⏱ {evalItem.call_duration}s</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md ${
                          isPass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          isFail ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {evalItem.status || 'Evaluated'}
                        </span>

                        <div className="text-right min-w-[45px]">
                          <span className={`text-xs font-black ${
                            score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {score > 0 ? `${score}%` : 'Scorecard'}
                          </span>
                        </div>

                        <button
                          onClick={() => navigate('/my-assignments')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center bg-[#0A0E18] border border-slate-800/60 rounded-xl">
                  <ClipboardCheck className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-300">No Evaluated Calls Yet Today</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 max-w-[220px]">
                    Your audited calls and scores will appear here after you submit evaluations.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Daily Target & Accuracy Health */}
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">Daily Goal & Quality</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">
              Track daily evaluation quota and quality compliance status
            </p>

            {/* Daily Target Progress Bar */}
            <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-300 font-bold">Today's Target</span>
                <span className="text-amber-400 font-black">
                  {stats?.todayEvaluated || 0} / {stats?.dailyTarget || 30} calls
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      (((stats?.todayEvaluated || 0) / (stats?.dailyTarget || 30)) * 100),
                      100
                    )}%`
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                <span>
                  {Math.round(((stats?.todayEvaluated || 0) / (stats?.dailyTarget || 30)) * 100)}% completed
                </span>
                <span>
                  {Math.max(0, (stats?.dailyTarget || 30) - (stats?.todayEvaluated || 0))} calls remaining
                </span>
              </div>
            </div>

            {/* Quality Compliance Badges */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">Critical Errors</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {stats?.criticalErrors ?? 0}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">Recorded errors</p>
              </div>

              <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">Feedback</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {stats?.pendingFeedback ?? 0}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">Pending response</p>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800/60 space-y-2">
            <button
              onClick={() => navigate('/my-assignments')}
              className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Go to My Assignments ({stats?.pendingQueueCount ?? 0} in queue)</span>
            </button>
            <button
              onClick={() => navigate('/dialer-sales')}
              className="w-full py-2 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Browse Live Sales</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
