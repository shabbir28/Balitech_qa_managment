import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Play, Pause, Volume2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const CHECKBOX_FIELDS = [
  { key: 'md', label: 'MD' },
  { key: 'medicaid', label: 'MEDICAID' },
  { key: 'age', label: 'Age' },
  { key: 'name', label: 'Name' },
  { key: 'zip', label: 'Zip' },
  { key: 'triCareVa', label: 'Tri-care VA' },
  { key: 'dm', label: 'DM' },
  { key: 'nursingHome', label: 'Nursing home' },
  { key: 'bank', label: 'BANK' },
  { key: 'copays', label: 'Copays' },
  { key: 'interestInBenefits', label: 'Interest in Benefits' },
  { key: 'medicareCard', label: 'medicare card' },
  { key: 'dis', label: 'Dis' },
];

const INITIAL_METADATA = {
  teams: '',
  dup: '',
  dids: '',
  agentSideFeedback: '',
  laSideFeedback: '',
  md: false, medicaid: false, age: false, name: false, zip: false,
  triCareVa: false, dm: false, nursingHome: false, bank: false,
  copays: false, interestInBenefits: false, medicareCard: false, dis: false,
  errorCategory: '',
  laSideErrorCategory: '',
};

const EvaluationFormPage = () => {
  const [searchParams] = useSearchParams();
  const callId = searchParams.get('call_id');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [call, setCall] = useState(null);
  const [metadata, setMetadata] = useState(INITIAL_METADATA);
  const [qaStatus, setQaStatus] = useState('Accepted');
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (callId) {
      api.get(`/calls/${callId}`).then(res => setCall(res.data.data)).catch(() => toast.error('Failed to load call details.'));
    }
  }, [callId]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => toast.error('Could not play audio.'));
    setIsPlaying(!isPlaying);
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleMetadataChange = (key, value) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!call) return toast.error('No call selected.');
    
    setLoading(true);
    try {
      await api.post('/evaluations', {
        call_lead_id: call.id,
        status: qaStatus === 'Accepted' ? 'Pass' : 'Fail',
        qa_remarks: metadata.laSideFeedback || 'Evaluated via spreadsheet',
        evaluation_date: evaluationDate,
        metadata: metadata,
        // Send zeroes for legacy columns to satisfy backend schema
        opening_script_score: 0, verification_score: 0, product_knowledge_score: 0,
        compliance_score: 0, communication_score: 0, closing_score: 0, call_handling_score: 0,
        critical_errors: []
      });
      toast.success('Evaluation submitted successfully!');
      navigate('/my-assignments');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!call) return <div className="p-10 text-center text-slate-400">Loading call data...</div>;

  return (
    <div className="w-full min-h-[90vh] pb-10 flex flex-col">
      <div className="px-8 mt-4 flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Call Evaluation</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">Listen to the recording and fill out the QA sheet below</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/my-assignments')} className="btn-secondary px-5 py-2.5">
            <ArrowLeft size={16} className="mr-2" /> Back
          </button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary px-6 py-2.5 shadow-indigo-500/20 shadow-lg">
            {loading ? 'Saving...' : <><Save size={18} className="mr-2" /> Save & Submit</>}
          </button>
        </div>
      </div>

      {/* Top Panel: Audio Player */}
      <div className="px-8 mb-8 shrink-0">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-2xl flex gap-8 items-center w-full max-w-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
          
          <button 
            onClick={togglePlay} 
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white flex items-center justify-center shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
          
          <div className="flex-1 min-w-0 pr-4">
            {call.recording_url ? (
              <>
                <audio
                  ref={audioRef} src={call.recording_url}
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                  onEnded={() => setIsPlaying(false)} preload="metadata"
                />
                <div className="flex justify-between text-xs text-slate-400 font-bold tracking-wide mb-3">
                  <span className="text-indigo-400">{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="relative w-full h-2 bg-slate-800/80 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-100 ease-linear"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                  <input
                    type="range" min={0} max={duration || 100} value={currentTime}
                    onChange={(e) => {
                      const t = parseFloat(e.target.value);
                      setCurrentTime(t);
                      if (audioRef.current) audioRef.current.currentTime = t;
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center text-slate-500 text-sm font-medium gap-3">
                <div className="p-3 bg-slate-800/50 rounded-xl"><Volume2 className="w-6 h-6 opacity-50" /></div>
                No recording available for this call
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spreadsheet Form */}
      <div className="flex-1 w-full px-8 relative pb-10">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden w-full h-full relative">
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar h-full w-full">
            <table className="w-max text-left border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-slate-950/50">
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-36">Date of call</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-40">Date of Eval</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-40">QA Name</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-40">Agent Name</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-36">Team's</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-40">Numbers</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-24 text-center">Dup</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-24 text-center">DID's</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-28 text-center">Talk Time</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-36">QA Status</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[300px]">Agentside Feedback</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[350px]">LA side</th>
                  {CHECKBOX_FIELDS.map(f => (
                    <th key={f.key} className="px-3 py-5 border-b border-r border-slate-800/50 text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-24 text-center">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-48">Error Category</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-48">LA Side Error</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-800/30 transition-colors group">
                  {/* Read-only Data styling: clean badges/text */}
                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-300 text-sm font-medium w-full">
                      {call.call_date ? format(new Date(call.call_date), 'dd MMM yyyy') : '—'}
                    </div>
                  </td>
                  
                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <input type="date" value={evaluationDate} onChange={e => setEvaluationDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all" />
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-sm font-semibold w-full truncate">
                      {user?.name || 'Unknown'}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-200 text-sm font-medium w-full truncate">
                      {call.agent_name}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <input type="text" value={metadata.teams} onChange={e => handleMetadataChange('teams', e.target.value)} placeholder="Enter Team..." className="w-full bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600" />
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-300 text-sm font-mono w-full truncate">
                      {call.customer_phone}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top text-center">
                    <select value={metadata.dup} onChange={e => handleMetadataChange('dup', e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-sm px-2 py-2 rounded-lg outline-none text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-center">
                      <option value="">—</option>
                      <option value="D">D</option>
                      <option value="ND">ND</option>
                    </select>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top text-center">
                    <select value={metadata.dids} onChange={e => handleMetadataChange('dids', e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-sm px-2 py-2 rounded-lg outline-none text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-center">
                      <option value="">—</option>
                      <option value="D">D</option>
                      <option value="ND">ND</option>
                    </select>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-400 text-sm font-medium w-full text-center">
                      {call.call_duration || '0'}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <select value={qaStatus} onChange={e => setQaStatus(e.target.value)} className={`w-full bg-slate-950 border text-sm font-bold px-3 py-2 rounded-lg outline-none transition-all focus:ring-1 ${qaStatus === 'Accepted' ? 'text-emerald-400 border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/50 bg-emerald-500/5' : 'text-rose-400 border-rose-500/30 focus:border-rose-500/50 focus:ring-rose-500/50 bg-rose-500/5'}`}>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <textarea
                      value={metadata.agentSideFeedback}
                      onChange={e => handleMetadataChange('agentSideFeedback', e.target.value)}
                      placeholder="Agent side remarks..."
                      className="w-full h-[140px] bg-slate-950 border border-slate-800 text-sm p-3 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none placeholder:text-slate-600 custom-scrollbar"
                    />
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <textarea
                      value={metadata.laSideFeedback}
                      onChange={e => handleMetadataChange('laSideFeedback', e.target.value)}
                      placeholder="LA side review..."
                      className="w-full h-[140px] bg-slate-950 border border-slate-800 text-sm p-3 rounded-lg outline-none text-slate-200 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none placeholder:text-slate-600 custom-scrollbar"
                    />
                  </td>

                  {/* Checkboxes */}
                  {CHECKBOX_FIELDS.map(f => (
                    <td key={f.key} className="p-3 border-r border-slate-800/50 align-top pt-5">
                      <div className="flex justify-center w-full">
                        <label className="relative flex items-center p-1 rounded-full cursor-pointer hover:bg-slate-800/50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={metadata[f.key]} 
                            onChange={e => handleMetadataChange(f.key, e.target.checked)} 
                            className="peer relative appearance-none w-6 h-6 border-2 border-slate-700 rounded-md bg-slate-950 checked:bg-indigo-500 checked:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all cursor-pointer"
                          />
                          <svg
                            className="absolute w-4 h-4 mt-1 ml-1 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity text-white top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="1"
                          >
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                          </svg>
                        </label>
                      </div>
                    </td>
                  ))}

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <select value={metadata.errorCategory} onChange={e => handleMetadataChange('errorCategory', e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all">
                      <option value="">— Select Category —</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Scripting">Scripting</option>
                      <option value="Product Knowledge">Product Knowledge</option>
                      <option value="Other">Other</option>
                    </select>
                  </td>

                  <td className="p-3 border-slate-800/50 align-top">
                    <select value={metadata.laSideErrorCategory} onChange={e => handleMetadataChange('laSideErrorCategory', e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all">
                      <option value="">— Select Category —</option>
                      <option value="Missing Information">Missing Information</option>
                      <option value="Incorrect Entry">Incorrect Entry</option>
                      <option value="Verification Failed">Verification Failed</option>
                      <option value="Other">Other</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaluationFormPage;
