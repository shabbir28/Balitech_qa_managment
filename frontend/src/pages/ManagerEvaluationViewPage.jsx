import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Play, Pause, Volume2 } from 'lucide-react';
import { format } from 'date-fns';

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

const ManagerEvaluationViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [evaluation, setEvaluation] = useState(null);
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (id) {
      api.get(`/evaluations/${id}`).then(res => setEvaluation(res.data.data)).catch(() => toast.error('Failed to load evaluation details.'));
    }
  }, [id]);

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

  if (!evaluation) return <div className="p-10 text-center text-slate-400">Loading evaluation data...</div>;

  const metadata = evaluation.metadata || {};

  return (
    <div className="w-full min-h-[90vh] pb-10 flex flex-col">
      <div className="px-8 mt-4 flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Manager View: Call Evaluation</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">Read-only view of the exact submitted QA sheet</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/evaluations')} className="btn-secondary px-5 py-2.5">
            <ArrowLeft size={16} className="mr-2" /> Back to Users
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
            {evaluation.recording_url ? (
              <>
                <audio
                  ref={audioRef} src={evaluation.recording_url}
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

      {/* Spreadsheet Form (READ ONLY) */}
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
                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-300 text-sm font-medium w-full">
                      {evaluation.call_date ? format(new Date(evaluation.call_date), 'dd MMM yyyy') : '—'}
                    </div>
                  </td>
                  
                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm opacity-80">
                      {evaluation.evaluation_date ? format(new Date(evaluation.evaluation_date), 'yyyy-MM-dd') : '—'}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-sm font-semibold w-full truncate opacity-80">
                      {evaluation.evaluator_name || 'Unknown'}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-200 text-sm font-medium w-full truncate">
                      {evaluation.agent_name}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm opacity-80 w-full min-h-[38px]">
                      {metadata.teams || ''}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-300 text-sm font-mono w-full truncate">
                      {evaluation.customer_phone || ''}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top text-center">
                    <div className="px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-sm opacity-80 w-full min-h-[38px] text-center">
                      {metadata.dup || '—'}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top text-center">
                    <div className="px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-sm opacity-80 w-full min-h-[38px] text-center">
                      {metadata.dids || '—'}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-400 text-sm font-medium w-full text-center">
                      {evaluation.call_duration || '0'}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className={`px-3 py-2 rounded-lg border text-sm font-bold text-center ${evaluation.status === 'Pass' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' : 'text-rose-400 border-rose-500/30 bg-rose-500/5'}`}>
                      {evaluation.status === 'Pass' ? 'Accepted' : 'Rejected'}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="w-full h-[140px] bg-slate-950 border border-slate-800 text-sm p-3 rounded-lg text-slate-200 opacity-80 overflow-y-auto custom-scrollbar">
                      {metadata.agentSideFeedback || ''}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="w-full h-[140px] bg-slate-950 border border-slate-800 text-sm p-3 rounded-lg text-slate-200 opacity-80 overflow-y-auto custom-scrollbar">
                      {metadata.laSideFeedback || ''}
                    </div>
                  </td>

                  {/* Checkboxes */}
                  {CHECKBOX_FIELDS.map(f => (
                    <td key={f.key} className="p-3 border-r border-slate-800/50 align-top pt-5">
                      <div className="flex justify-center w-full">
                        <label className="relative flex items-center p-1 rounded-full opacity-80">
                          <input 
                            type="checkbox" 
                            checked={metadata[f.key] || false} 
                            disabled
                            className="peer relative appearance-none w-6 h-6 border-2 border-slate-700 rounded-md bg-slate-950 checked:bg-indigo-500 checked:border-indigo-500"
                          />
                          <svg
                            className="absolute w-4 h-4 mt-1 ml-1 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity text-white top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            strokeWidth="1"
                          >
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                          </svg>
                        </label>
                      </div>
                    </td>
                  ))}

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-sm opacity-80 w-full min-h-[38px]">
                      {metadata.errorCategory || '—'}
                    </div>
                  </td>

                  <td className="p-3 border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-sm opacity-80 w-full min-h-[38px]">
                      {metadata.laSideErrorCategory || '—'}
                    </div>
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

export default ManagerEvaluationViewPage;
