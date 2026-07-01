import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import UserDashboard from '../components/dashboard/UserDashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/dashboard/stats'), api.get('/dashboard/charts')])
      .then(([s, c]) => { 
        setStats(s.data.data); 
        setCharts(c.data.data); 
      })
      .catch(() => toast.error('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading Analytics...</p>
    </div>
  );

  return (
    <>
      {user?.role === 'Manager' ? (
        <ManagerDashboard stats={stats} charts={charts} />
      ) : (
        <UserDashboard stats={stats} charts={charts} />
      )}
    </>
  );
}
