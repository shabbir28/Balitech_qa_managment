import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Phone, User, Activity, Hash, ChevronRight, AlertTriangle, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function DialerSearchPage() {
  const [phone, setPhone]       = useState('');
  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [apiError, setApiError] = useState(null);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setLoading(true);
    setApiError(null);
    setSearched(false);

    try {
      const response = await api.get(`/dialer/search?phone=${encodeURIComponent(phone)}`);
      if (response.data.success) {
        setLeads(response.data.data.leads || []);
        setSearched(true);
        const count = response.data.data.leads.length;
        if (count === 0) {
          toast.error('No leads found for this number');
        } else {
          toast.success(`Found ${count} lead${count !== 1 ? 's' : ''}`);
        }
      }
    } catch (error) {
      const errData = error.response?.data;
      const status  = error.response?.status;

      if (status === 403 || (errData && errData.fix)) {
        // API permission error — show admin fix instructions
        setApiError({
          type: 'permission',
          message: errData?.message || 'Dialer API access denied.',
          fix: errData?.fix,
        });
      } else {
        toast.error(errData?.message || 'Failed to search leads');
      }
      setSearched(true);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dialer Lead Search</h1>
          <p className="text-sm text-slate-400 mt-1">Search for a lead by phone number to view details and recordings.</p>
        </div>
      </div>

      {/* Search Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <form onSubmit={handleSearch} className="relative z-10 flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. 6365359557"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-medium"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            Search
          </button>
        </form>
      </div>

      {/* API Permission Error Card */}
      {apiError && apiError.type === 'permission' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-amber-300 font-bold text-base mb-1">Dialer API Access Not Enabled</h3>
              <p className="text-amber-400/80 text-sm mb-4">{apiError.message}</p>
              {apiError.fix && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5" /> Admin ko yeh 2 steps karne hain:
                  </p>
                  <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <div>
                        <p className="text-xs text-slate-300 font-medium">System Settings → Agent API Active = YES</p>
                        <p className="text-xs text-slate-500 mt-0.5">{apiError.fix.step1}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <div>
                        <p className="text-xs text-slate-300 font-medium">User CRM_API → Agent API Access = 1</p>
                        <p className="text-xs text-slate-500 mt-0.5">{apiError.fix.step2}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {searched && !apiError && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-400" />
              Search Results
            </h2>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              {leads.length} Found
            </span>
          </div>

          <div className="overflow-x-auto">
            {leads.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800">
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Lead ID</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">List ID</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Agent</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Call</th>
                    <th className="py-4 px-6 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {leads.map((lead) => (
                    <tr
                      key={lead.lead_id}
                      className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/dialer/lead/${lead.lead_id}`)}
                    >
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 font-mono text-sm border border-indigo-500/20">
                          {lead.lead_id}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-medium text-slate-200">{lead.name || '—'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2 py-0.5 rounded-full border text-xs ${
                          lead.status === 'CALLBK' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                          lead.status === 'SALE'   ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                          lead.status === 'DNC'    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                          'text-slate-400 bg-slate-800/50 border-slate-700'
                        }`}>
                          <Activity className="w-3 h-3" />
                          {lead.status || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-medium text-slate-200 font-mono">{lead.phone}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-slate-400">{lead.list_id}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                            <User className="w-3 h-3 text-slate-400" />
                          </div>
                          <span className="text-sm text-slate-300">{lead.last_agent || '—'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-slate-500">{lead.last_call ? new Date(lead.last_call).toLocaleString() : '—'}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="p-2 text-slate-500 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 rounded-lg transition-all">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-300">No leads found</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm">
                  We couldn't find any leads matching that phone number in the dialer.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
