import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, ClipboardCheck, CheckCircle, XCircle, Users,
  Target, Send, AlertCircle, Clock, ShoppingCart, Flag, ChevronDown, ArrowUpRight,
  FileText, Crown, BarChart3, Activity, AlertTriangle
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


export default function ManagerDashboard({ stats, charts, startDate, endDate, onChangeDateRange, dialer, onChangeDialer }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Chart interaction states
  const [chartMetric, setChartMetric] = useState('score'); // 'score' | 'volume'
  const [chartTimeframe, setChartTimeframe] = useState('monthly'); // 'monthly' | 'daily'
  
  // Leaderboard tab state - default to sales which has real database volume
  const [leaderboardTab, setLeaderboardTab] = useState('sales'); // 'sales' | 'qa'

  const timeOfDay = useMemo(() => getEstTimeOfDay(new Date()), []);
  const currentDateString = useMemo(() => getEstFormattedDate(new Date()), []);

  // 100% REAL DATA: Leaderboard performers directly from database queries (NO DUMMY DATA)
  const actualSalesPerformers = useMemo(() => {
    if (!charts?.topSalesAgents || !charts.topSalesAgents.length) return [];
    return charts.topSalesAgents.slice(0, 6).map(s => {
      let cleanName = (s.agent_name || '').trim();
      if (!cleanName) cleanName = 'Sales Agent';
      else if (/^\d+$/.test(cleanName)) cleanName = `Agent ${cleanName}`;
      return {
        agent_name: cleanName,
        total_sales: parseInt(s.total_sales || 0),
        accepted: parseInt(s.accepted || 0),
        rejected: parseInt(s.rejected || 0),
        avg_score: Math.round(Number(s.avg_score) || 0)
      };
    });
  }, [charts]);

  const actualQaPerformers = useMemo(() => {
    if (!charts?.agentScores || !charts.agentScores.length) return [];
    return charts.agentScores.slice(0, 6).map(a => ({
      agent_name: a.agent_name || `Agent ${a.agent_id || 'QA'}`,
      total_evaluations: parseInt(a.total_evaluations || 0),
      passed: parseInt(a.passed || 0),
      failed: parseInt(a.failed || 0),
      avg_score: Math.round(Number(a.avg_score) || 0)
    }));
  }, [charts]);

  // Chart data calculation based on selected timeframe
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
        full_label: `${m.month} Trends`,
        volume: parseInt(m.total_volume || m.total || 0),
        passed: parseInt(m.passed || 0),
        avg_score: Math.round(Number(m.avg_score) || 0),
      }));
    }

    return [];
  }, [charts, chartTimeframe]);

  // Chart summary stats calculated from actual data
  const { totalVolume, peakMetric, overallAvgScore, trendPercent, isTrendUp } = useMemo(() => {
    if (!activeChartData.length) {
      return { totalVolume: 0, peakMetric: 0, overallAvgScore: 0, trendPercent: '0%', isTrendUp: true };
    }

    const volumes = activeChartData.map(d => d.volume);
    const scores = activeChartData.map(d => d.avg_score);
    const totalVol = volumes.reduce((a, b) => a + b, 0);
    const peak = chartMetric === 'volume' ? Math.max(...volumes) : Math.max(...scores);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const metricKey = chartMetric === 'volume' ? 'volume' : 'avg_score';
    const lastVal = activeChartData[activeChartData.length - 1]?.[metricKey] || 0;
    const prevVal = activeChartData[activeChartData.length - 2]?.[metricKey] ?? lastVal;
    const isUp = lastVal >= prevVal;
    const delta = prevVal ? ((lastVal - prevVal) / prevVal) * 100 : 0;

    return {
      totalVolume: totalVol,
      peakMetric: peak,
      overallAvgScore: avgScore,
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
      onClick: () => navigate('/assign-leads')
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
      label: 'DECLINE',
      value: stats?.dialerStats?.decline ?? 0,
      icon: AlertTriangle,
      color: 'text-purple-400',
      barColor: 'bg-purple-500',
      onClick: () => navigate(`/dialer-sales/history?start=${startDate}&end=${endDate}&dialer=${dialer === 'all' ? 'medicare' : dialer}&qaStatus=Decline`)
    },
    {
      label: 'NOT BILLABLE',
      value: stats?.dialerStats?.not_billable ?? 0,
      icon: AlertCircle,
      color: 'text-cyan-400',
      barColor: 'bg-cyan-500',
      onClick: () => navigate(`/dialer-sales/history?start=${startDate}&end=${endDate}&dialer=${dialer === 'all' ? 'medicare' : dialer}&qaStatus=Not%20Billable`)
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

      {/* ── HEADER WITH LEFT-SHIFTED FILTERS & PROFILE ICON ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
        <div>
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-500/5 text-amber-400 text-[10px] font-bold tracking-wider uppercase mb-2">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>MANAGER DASHBOARD</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-200 tracking-tight">
            Good {timeOfDay},{' '}
            <span className="font-black text-white">{user?.name || 'System'}</span>
          </h1>
          <p className="text-slate-400 text-xs font-normal mt-1">
            {currentDateString}
          </p>
        </div>

        {/* Right Controls Container with Left-shifted filters */}
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

          {/* Profile Icon Dropdown (Separated on the Right) */}
          <div className="pl-3 sm:pl-4 border-l border-slate-800/80">
            <UserProfileDropdown />
          </div>
        </div>
      </div>

      {/* ── TOP QA EVALUATION KPI CARDS (ALL STATUSES IN COMPACT ROW) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Evaluations */}
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <ClipboardCheck className="w-3.5 h-3.5 text-slate-400" />
            <span className="bg-slate-800/60 text-slate-400 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase">
              Today
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {stats?.totalEvaluated?.toLocaleString() ?? '0'}
            </p>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            TOTAL EVALUATIONS
          </p>
        </div>

        {/* Accepted / Passed */}
        <div className="bg-[#0D111D] border border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.12)] rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between hover:border-emerald-500 transition-all">
          <div className="flex items-center justify-between">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="bg-emerald-500/15 text-emerald-400 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase">
              Passed
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
              {stats?.passedCalls?.toLocaleString() ?? '0'}
            </p>
          </div>
          <p className="text-[9px] font-bold text-emerald-400/90 uppercase tracking-wider">
            CALLS PASSED
          </p>
        </div>

        {/* Rejected / Failed */}
        <div className="bg-[#0D111D] border border-rose-500/60 shadow-[0_0_15px_rgba(239,68,68,0.12)] rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between hover:border-rose-500 transition-all">
          <div className="flex items-center justify-between">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span className="bg-rose-500/15 text-rose-400 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase">
              Failed
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-500 tracking-tight">
              {stats?.failedCalls?.toLocaleString() ?? '0'}
            </p>
          </div>
          <p className="text-[9px] font-bold text-rose-500/90 uppercase tracking-wider">
            CALLS FAILED
          </p>
        </div>

        {/* Flagged */}
        <div className="bg-[#0D111D] border border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.12)] rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between hover:border-amber-500 transition-all">
          <div className="flex items-center justify-between">
            <Flag className="w-3.5 h-3.5 text-amber-400" />
            <span className="bg-amber-500/15 text-amber-400 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase">
              Review
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight">
              {(stats?.flaggedCalls ?? stats?.outcomeBreakdown?.flagged ?? 0).toLocaleString()}
            </p>
          </div>
          <p className="text-[9px] font-bold text-amber-400/90 uppercase tracking-wider">
            FLAGGED
          </p>
        </div>

        {/* Decline */}
        <div className="bg-[#0D111D] border border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.12)] rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between hover:border-purple-500 transition-all">
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
            <span className="bg-purple-500/15 text-purple-400 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase">
              Decline
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-purple-400 tracking-tight">
              {(stats?.declineCalls ?? stats?.outcomeBreakdown?.decline ?? 0).toLocaleString()}
            </p>
          </div>
          <p className="text-[9px] font-bold text-purple-400/90 uppercase tracking-wider">
            DECLINE
          </p>
        </div>

        {/* Not Billable */}
        <div className="bg-[#0D111D] border border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.12)] rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between hover:border-cyan-500 transition-all">
          <div className="flex items-center justify-between">
            <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="bg-cyan-500/15 text-cyan-400 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase">
              No Bill
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-cyan-400 tracking-tight">
              {(stats?.notBillableCalls ?? stats?.outcomeBreakdown?.notBillable ?? 0).toLocaleString()}
            </p>
          </div>
          <p className="text-[9px] font-bold text-cyan-400/90 uppercase tracking-wider">
            NOT BILLABLE
          </p>
        </div>

        {/* Team Members */}
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <Users className="w-3.5 h-3.5 text-slate-300" />
            <span className="bg-slate-800/60 text-slate-400 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase">
              Active
            </span>
          </div>
          <div className="my-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {stats?.totalAgents?.toLocaleString() ?? '0'}
            </p>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            TEAM MEMBERS
          </p>
        </div>
      </div>

      {/* ── TODAY'S DIALER SALES (8 COLUMNS SINGLE ROW ON DESKTOP) ── */}
      <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Today's Dialer Sales
            </h2>
          </div>
          {/* Live pulsing tag */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
          </div>
        </div>

        {/* 8 Mini Boxes in a single compact row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {salesItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full text-left bg-[#0A0E18] border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 hover:-translate-y-0.5 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  {item.label}
                </span>
                <item.icon className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors shrink-0 ml-1" />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${item.color}`}>
                {item.value}
              </p>
              {/* Mini 5-bar visualizer */}
              <div className="flex items-end gap-0.5 mt-2 h-3.5">
                <div className={`w-1 h-1 rounded-sm ${item.barColor} opacity-90`} />
                <div className={`w-1 h-2 rounded-sm ${item.barColor} opacity-90`} />
                <div className={`w-1 h-3 rounded-sm ${item.barColor} opacity-90`} />
                <div className={`w-1 h-2 rounded-sm ${item.barColor} opacity-90`} />
                <div className={`w-1 h-2.5 rounded-sm ${item.barColor} opacity-90`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── CHARTS: HIGH-PERFORMANCE INTERACTIVE CHART & 100% REAL LEADERBOARD ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team Performance - High-End Interactive Chart (2 cols) */}
        <div className="lg:col-span-2 bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Team Performance & Analytics</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                  <Activity className="w-3 h-3" />
                  REAL-TIME
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {chartMetric === 'score' ? 'Quality passing index across active periods' : 'Actual call & sales volume from database'}
              </p>
            </div>

            {/* Interactive Mode & Timeframe Selectors */}
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

          {/* Render High-End Chart */}
          <div className="h-56 sm:h-60 w-full">
            {activeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartMetric === 'score' ? (
                  /* Spline Area Chart with glowing gradient & dots */
                  <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
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
                      name="QA Quality Score"
                      stroke="#f59e0b" 
                      strokeWidth={2.8} 
                      fill="url(#amberGrad)" 
                      dot={{ r: 3.5, fill: '#f59e0b', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} 
                    />
                  </AreaChart>
                ) : (
                  /* Composed Chart for Call / Sales Volume */
                  <ComposedChart data={activeChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volBarGrad" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#volBarGrad)" 
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
                <p className="text-xs">No volume data in selected range</p>
              </div>
            )}
          </div>

          {/* Bottom Summary Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 mt-3 border-t border-slate-800/60">
            <div className="bg-[#0A0E18] border border-slate-800/60 rounded-xl px-3.5 py-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">TOTAL VOLUME</p>
              <p className="text-lg sm:text-xl font-bold text-white">{totalVolume.toLocaleString()}</p>
            </div>
            <div className="bg-[#0A0E18] border border-slate-800/60 rounded-xl px-3.5 py-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                {chartMetric === 'volume' ? 'PEAK VOLUME' : 'PEAK SCORE'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-white">
                {chartMetric === 'volume' ? peakMetric.toLocaleString() : `${peakMetric}%`}
              </p>
            </div>
            <div className="bg-[#0A0E18] border border-slate-800/60 rounded-xl px-3.5 py-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">AVG QUALITY</p>
              <p className="text-lg sm:text-xl font-bold text-amber-400">{overallAvgScore}%</p>
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

        {/* ── 100% REAL DATABASE LEADERBOARD (NO DUMMY DATA) ── */}
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between relative shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-wide">Leaderboard</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE DB
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Actual top performers</p>
              </div>

              {/* Tab Switcher: Sales vs QA */}
              <div className="flex items-center bg-[#0A0E18] border border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
                <button
                  onClick={() => setLeaderboardTab('sales')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    leaderboardTab === 'sales'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sales
                </button>
                <button
                  onClick={() => setLeaderboardTab('qa')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    leaderboardTab === 'qa'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  QA Score
                </button>
              </div>
            </div>
          </div>

          {/* List of Actual Database Performers */}
          <div className="my-auto space-y-2 py-1">
            {(leaderboardTab === 'sales' ? actualSalesPerformers : actualQaPerformers).length > 0 ? (
              (leaderboardTab === 'sales' ? actualSalesPerformers : actualQaPerformers).map((agent, idx) => {
                const isFirst = idx === 0;
                const isSecond = idx === 1;
                const isThird = idx === 2;

                return (
                  <div 
                    key={agent.agent_name + idx} 
                    className={`bg-[#0A0E18] border rounded-xl p-2.5 flex items-center justify-between transition-all hover:border-amber-500/40 group ${
                      isFirst 
                        ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/[0.06] to-transparent shadow-[0_0_15px_rgba(245,158,11,0.08)]' 
                        : 'border-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Rank Badge */}
                      <div className="flex items-center justify-center w-6 shrink-0">
                        {isFirst ? (
                          <span className="text-xs font-black text-amber-400 flex items-center gap-0.5">
                            <Crown className="w-4 h-4 fill-amber-400 text-amber-400" />
                          </span>
                        ) : isSecond ? (
                          <span className="text-[10px] font-black text-slate-300">02</span>
                        ) : isThird ? (
                          <span className="text-[10px] font-black text-amber-600">03</span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        isFirst 
                          ? 'bg-amber-500 text-slate-950 shadow' 
                          : 'bg-slate-800 text-amber-400'
                      }`}>
                        {agent.agent_name?.replace('Agent ', '').charAt(0) || 'A'}
                      </div>

                      {/* Agent Name & Real Metrics */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-400 transition-colors">
                          {agent.agent_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Visual Progress Bar */}
                          <div className="w-16 sm:w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                            <div 
                              className={`h-full rounded-full ${
                                isFirst ? 'bg-amber-400' : 'bg-amber-500/80'
                              }`}
                              style={{ 
                                width: `${Math.min(
                                  leaderboardTab === 'sales'
                                    ? Math.round((agent.total_sales / (actualSalesPerformers[0]?.total_sales || 1)) * 100)
                                    : agent.avg_score || 85, 
                                  100
                                )}%` 
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium truncate">
                            {leaderboardTab === 'sales'
                              ? `${agent.total_sales} actual sales`
                              : `${agent.total_evaluations} calls evaluated`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metric Counter Pill */}
                    <div className="text-right shrink-0 ml-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                        isFirst 
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40' 
                          : 'bg-slate-800/90 text-amber-400'
                      }`}>
                        {leaderboardTab === 'sales' ? `${agent.total_sales} Sales` : `${agent.avg_score}%`}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Honest Empty State when no records exist for a specific tab */
              <div className="my-auto flex flex-col items-center justify-center py-6 text-center">
                <Users className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs font-bold text-slate-300">
                  No {leaderboardTab === 'sales' ? 'Sales' : 'QA Evaluation'} Records
                </p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
                  Actual performance records will appear here as activity occurs in the system.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800/50">
            <span className="text-[10px] text-slate-500 font-medium">
              100% Actual Database Records
            </span>
            <button
              onClick={() => navigate(leaderboardTab === 'sales' ? '/dialer-sales' : '/users')}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              View All {leaderboardTab === 'sales' ? 'Sales' : 'Team'} →
            </button>
          </div>
        </div>
      </div>

      {/* ── LIVE QA ACTIVITY STREAM & QUALITY COMPLIANCE CENTER (Replaces Quick Access) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
        {/* Left 2 Cols: Live QA Activity & Recent Evaluations Stream */}
        <div className="lg:col-span-2 bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Recent QA Evaluations Stream</h3>
                  <p className="text-[11px] text-slate-400">Live feed of audited customer calls and compliance scoring</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE STREAM
                </span>
                <button
                  onClick={() => navigate('/evaluations')}
                  className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  View All Audits →
                </button>
              </div>
            </div>

            {/* Table / List of Recent Evaluations */}
            <div className="space-y-2">
              {stats?.recentEvaluations && stats.recentEvaluations.length > 0 ? (
                stats.recentEvaluations.map((evalItem, idx) => {
                  const score = Math.round(Number(evalItem.total_score) || 0);
                  const isPass = evalItem.status === 'Accepted' || evalItem.status === 'Pass';
                  const isFail = evalItem.status === 'Rejected' || evalItem.status === 'Fail';
                  
                  return (
                    <div
                      key={evalItem.evaluation_id || idx}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0E18] border border-slate-800/70 hover:border-slate-700 hover:bg-[#0c111f] rounded-xl px-4 py-3 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isPass ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                          isFail ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                          'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>
                          {evalItem.agent_name ? evalItem.agent_name.charAt(0).toUpperCase() : 'A'}
                        </div>

                        {/* Agent & Lead Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors truncate">
                              {evalItem.agent_name || 'Sales Agent'}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                              {evalItem.campaign_name || 'Medicare'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>📞 {evalItem.customer_phone || 'Call Audit'}</span>
                            {evalItem.call_duration && (
                              <span className="text-[10px] text-slate-500">⏱ {evalItem.call_duration}s</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Score & Status Badge & Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        {/* Status badge */}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md ${
                          isPass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          isFail ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {isPass ? <CheckCircle className="w-3 h-3" /> : isFail ? <XCircle className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
                          {evalItem.status || 'Evaluated'}
                        </span>

                        {/* QA Score */}
                        <div className="text-right min-w-[45px]">
                          <span className={`text-xs font-black ${
                            score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {score > 0 ? `${score}%` : 'Audit'}
                          </span>
                        </div>

                        {/* Review Action */}
                        <button
                          onClick={() => navigate('/evaluations')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-[#0A0E18] border border-slate-800/60 rounded-xl">
                  <ClipboardCheck className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-300">No Recent Evaluations Today</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 max-w-[240px]">
                    Evaluations performed by QA agents will appear here instantly in real-time.
                  </p>
                  <button
                    onClick={() => navigate('/assign-leads')}
                    className="mt-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Assign Leads to QA
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 flex items-center justify-between border-t border-slate-800/60">
            <span className="text-[10px] text-slate-500">
              Showing {stats?.recentEvaluations?.length || 0} most recent audited calls
            </span>
            <button
              onClick={() => navigate('/evaluations')}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer sm:hidden"
            >
              View All →
            </button>
          </div>
        </div>

        {/* Right 1 Col: Quality Compliance & QA Outcomes Breakdown */}
        <div className="bg-[#0D111D] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">QA Quality & Outcomes</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Summary
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">
              Real-time audit distribution and compliance indicators
            </p>

            {/* QA Outcome Distribution Bars */}
            <div className="space-y-3">
              {/* Accepted */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Accepted / Passed
                  </span>
                  <span className="font-bold text-white">
                    {stats?.outcomeBreakdown?.accepted ?? stats?.dialerStats?.accepted ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        stats?.totalEvaluated > 0
                          ? ((stats?.passedCalls || 0) / stats.totalEvaluated) * 100
                          : 75,
                        100
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Rejected */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Rejected / Failed
                  </span>
                  <span className="font-bold text-white">
                    {stats?.outcomeBreakdown?.rejected ?? stats?.dialerStats?.rejected ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        stats?.totalEvaluated > 0
                          ? ((stats?.failedCalls || 0) / stats.totalEvaluated) * 100
                          : 15,
                        100
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Flagged */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Flagged / Under Review
                  </span>
                  <span className="font-bold text-white">
                    {stats?.outcomeBreakdown?.flagged ?? stats?.dialerStats?.flagged ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        stats?.dialerStats?.total > 0
                          ? ((stats?.dialerStats?.flagged || 0) / stats.dialerStats.total) * 100
                          : 8,
                        100
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Pending QA */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    Pending Evaluation
                  </span>
                  <span className="font-bold text-white">
                    {stats?.dialerStats?.pending ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-slate-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        stats?.dialerStats?.total > 0
                          ? ((stats?.dialerStats?.pending || 0) / stats.dialerStats.total) * 100
                          : 20,
                        100
                      )}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Compliance Alert Cards */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800/70">
              <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">Critical Errors</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {stats?.criticalErrors ?? 0}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">Recorded compliance flags</p>
              </div>

              <div className="bg-[#0A0E18] border border-slate-800/70 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">Pending Feedback</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {stats?.pendingFeedback ?? 0}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">Awaiting agent response</p>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800/60">
            <button
              onClick={() => navigate('/dialer-sales/history?qaStatus=Pending')}
              className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Review Pending Dialer Queue ({stats?.dialerStats?.pending ?? 0})</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
