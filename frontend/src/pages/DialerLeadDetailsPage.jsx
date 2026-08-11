import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Phone, Play, Calendar, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function DialerLeadDetailsPage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignment_id');
  const agentNameParam = searchParams.get('agent_name');
  const teamParam = searchParams.get('team');
  
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState(null);
  const [recordings, setRecordings] = useState([]);


  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [leadRes, recRes] = await Promise.allSettled([
          api.get(`/dialer/lead/${leadId}`),
          api.get(`/dialer/recordings/${leadId}`)
        ]);

        if (leadRes.status === 'fulfilled' && leadRes.value.data.success) {
          setLead(leadRes.value.data.data);
        } else if (leadRes.status === 'rejected') {
          const errData = leadRes.reason?.response?.data;
          const status  = leadRes.reason?.response?.status;
          if (status === 403) {
            toast.error(errData?.message || 'Dialer API access denied.');
          } else {
            toast.error('Failed to load lead info');
          }
        }

        if (recRes.status === 'fulfilled' && recRes.value.data.success) {
          setRecordings(recRes.value.data.data);
        }
      } catch (error) {
        console.error('Error fetching lead details:', error);
        toast.error('Failed to load lead details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [leadId]);


  const handleEvaluate = async (recording) => {
    try {
      if (assignmentId) {
        const toastId = toast.loading('Attaching recording to existing assignment...');
        const response = await api.put(`/calls/${assignmentId}/recording`, {
          recording_url: recording.location
        });
        toast.dismiss(toastId);
        
        if (response.data.success) {
          toast.success('Ready to evaluate!');
          navigate(`/evaluations/new?call_id=${assignmentId}`);
        }
      } else {
        const toastId = toast.loading('Importing lead for evaluation...');
        const response = await api.post('/dialer/import-lead', {
          lead_id: leadId,
          recording_url: recording.location,
          agent_name: agentNameParam
        });
        toast.dismiss(toastId);
        
        if (response.data.success) {
          toast.success('Ready to evaluate!');
          navigate(`/evaluations/new?call_id=${response.data.call_id}${teamParam ? `&team=${encodeURIComponent(teamParam)}` : ''}`);
        }
      }
    } catch (error) {
      console.error('Error handling evaluate action:', error);
      toast.error('Failed to prepare lead for evaluation');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading Lead Details...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-10 text-center text-slate-400">Lead not found or error loading data.</div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Lead Details <span className="text-emerald-400">#{leadId}</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">Information and recordings for this lead.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Lead Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-emerald-400" />
              Lead Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone</label>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-200 font-medium">{lead.phone || 'N/A'}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">List ID</label>
                  <p className="text-slate-300 font-medium mt-1">{lead.list_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent</label>
                  <p className="text-slate-300 font-medium mt-1">{lead.user || 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disposition</label>
                <div className="inline-flex mt-1 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-200">
                  {lead.disposition || 'N/A'}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Call</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300 font-medium">{lead.last_call || 'N/A'}</span>
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Called Count</label>
                <p className="text-slate-300 font-medium mt-1">{lead.called_count || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recordings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-emerald-400" />
              Recordings ({recordings.length})
            </h2>

            {recordings.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/50">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400">No recordings found for this lead.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recordings.map((rec, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-emerald-500/30 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{rec.date}</span>
                        <span className="text-xs font-bold px-2 py-1 bg-slate-800 text-slate-300 rounded-md">Length: {rec.length}s</span>
                      </div>
                      <p className="text-sm font-medium text-slate-200 truncate mb-3">{rec.filename}</p>
                      
                      {/* Native Audio Player */}
                      <audio controls className="w-full h-10 rounded-lg outline-none">
                        <source src={rec.location} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                    
                    <div className="shrink-0 flex sm:flex-col justify-end gap-2 mt-4 sm:mt-0">
                      <button 
                        onClick={() => handleEvaluate(rec)}
                        className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-500/20 transition-all text-center"
                      >
                        Evaluate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
