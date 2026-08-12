import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, AlertCircle, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function DialerSalesPage() {
  const navigate = useNavigate();
  const [dialerType, setDialerType] = useState('pharmacy');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sales, setSales] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [error, setError] = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/dialer-sales?dialer=${encodeURIComponent(dialerType)}`);
      if (res.data.success) {
        setSales(res.data.data);
        setStatuses(res.data.statuses || []);
        if (res.data.data.length === 0) {
          toast('No recent sales found for this dialer.', { icon: 'ℹ️' });
        }
      } else {
        setError(res.data.message || 'Failed to fetch sales');
      }
    } catch (err) {
      console.error(err);
      setError('Error communicating with the server.');
    } finally {
      setLoading(false);
    }
  }, [dialerType]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/dialer-sales/sync', { dialer: dialerType });
      if (res.data.success) {
        toast.success(`Synced statuses: ${res.data.statuses.join(', ')}`);
        fetchSales();
      } else {
        toast.error('Failed to sync statuses');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error syncing statuses');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-500" />
            Dialer Sales
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Automatically tracks and displays leads with a "Sale: Y" status in Vicidial.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dialerType}
            onChange={(e) => setDialerType(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="pharmacy">Pharmacy Dialer</option>
            <option value="medicare">Medicare Dialer</option>
          </select>
          <button
            onClick={fetchSales}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50 border border-emerald-500/20"
            title="Force a re-scrape of the campaign statuses from Vicidial"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Sync Statuses
          </button>
        </div>
      </div>

      {statuses.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
          <span className="font-semibold text-slate-300">Tracking Statuses:</span>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s, idx) => (
              <span key={idx} className="bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono border border-slate-700/50">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading && !sales.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="animate-pulse">Fetching sales from {dialerType} dialer...</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Lead ID</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Phone</th>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Agent</th>
                  <th className="px-6 py-4 font-semibold">Last Call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {sales.length === 0 && !loading && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-8 h-8 text-slate-600" />
                        <p>No sales found for the tracked statuses.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {sales.map((lead) => (
                  <tr 
                    key={lead.lead_id}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/dialer/lead/${lead.lead_id}?dialer=${encodeURIComponent(dialerType)}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                        {lead.lead_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300 group-hover:text-white transition-colors">
                      {lead.phone}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {lead.name}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {lead.last_agent}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {lead.last_call}
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
