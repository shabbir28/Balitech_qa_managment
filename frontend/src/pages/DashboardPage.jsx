import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getEstDateString } from '../utils/dateUtils';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import UserDashboard from '../components/dashboard/UserDashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(() => {
    const todayEST = getEstDateString(new Date());
    const baseDate = new Date(`${todayEST}T00:00:00`);
    baseDate.setDate(baseDate.getDate() - 1);
    
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  
  const [endDate, setEndDate] = useState(() => {
    const todayEST = getEstDateString(new Date());
    const baseDate = new Date(`${todayEST}T00:00:00`);
    baseDate.setDate(baseDate.getDate() - 1);
    
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const [dialer, setDialer] = useState('medicare');

  useEffect(() => {
    setLoading(true);
    const dialerParam = dialer !== 'all' ? `&dialer=${dialer}` : '';
    Promise.all([
      api.get(`/dashboard/stats?startDate=${startDate}&endDate=${endDate}${dialerParam}`), 
      api.get(`/dashboard/charts`)
    ])
      .then(([s, c]) => { 
        setStats(s.data.data); 
        setCharts(c.data.data); 
      })
      .catch(() => toast.error('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, [startDate, endDate, dialer]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">

      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading Analytics...</p>
    </div>
  );

  return (
    <>
      {['Super Admin', 'QA Admin'].includes(user?.role) ? (
        <ManagerDashboard 
          stats={stats} 
          charts={charts} 
          startDate={startDate} 
          endDate={endDate} 
          onChangeDateRange={(s, e) => { setStartDate(s); setEndDate(e); }} 
          dialer={dialer}
          onChangeDialer={setDialer}
        />
      ) : (
        <UserDashboard 
          stats={stats} 
          charts={charts} 
          startDate={startDate} 
          endDate={endDate} 
          onChangeDateRange={(s, e) => { setStartDate(s); setEndDate(e); }}
          dialer={dialer}
          onChangeDialer={setDialer}
        />
      )}
    </>
  );
}
