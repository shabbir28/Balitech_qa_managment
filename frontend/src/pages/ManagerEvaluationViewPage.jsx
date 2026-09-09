import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Play, Pause, Volume2, Save } from 'lucide-react';
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

function RecordingPlayerCard({ rec, index, total, isPlaying, onTogglePlay, onEnded }) {
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(rec.length ? parseFloat(rec.length) : 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(e => console.error('Audio play error:', e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleRateChange = (newRate) => {
    setPlaybackRate(newRate);
    if (audioRef.current) audioRef.current.playbackRate = newRate;
  };

  return (
    <div className={`bg-slate-900/90 backdrop-blur-md border rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center relative overflow-hidden transition-all ${
      isPlaying ? 'border-indigo-500/60 ring-1 ring-indigo-500/30 bg-slate-900' : 'border-slate-800 hover:border-slate-750'
    }`}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${
        index === 0 ? 'bg-gradient-to-b from-indigo-500 to-purple-500' : 'bg-gradient-to-b from-emerald-500 to-teal-500'
      }`} />
      
      <button 
        type="button"
        onClick={() => onTogglePlay(index)} 
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg transition-all hover:scale-105 active:scale-95 ${
          index === 0
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
        }`}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 w-full">
        <audio
          ref={audioRef}
          src={rec.location}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || (rec.length ? parseFloat(rec.length) : 0))}
          onEnded={() => onEnded(index)}
          preload="metadata"
        />
        
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
              index === 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              Recording {index + 1}{total > 1 ? ` of ${total}` : ''}
            </span>
            <span className="text-xs font-mono text-slate-300 truncate max-w-[280px] sm:max-w-[450px]" title={rec.filename}>
              {rec.filename || `Recording ${index + 1}`}
            </span>
            {rec.date && <span className="text-[10px] text-slate-500">({rec.date})</span>}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-indigo-400">{formatTime(currentTime)}</span>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-xs font-mono text-slate-400">{formatTime(duration)}</span>
            
            <select
              value={playbackRate}
              onChange={e => handleRateChange(parseFloat(e.target.value))}
              className="bg-slate-800 text-white text-[10px] rounded px-2 py-1 outline-none border border-slate-700 ml-1 cursor-pointer"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>
        </div>

        <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-100 ease-linear ${
              index === 0 ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
            }`}
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={e => {
              const t = parseFloat(e.target.value);
              setCurrentTime(t);
              if (audioRef.current) audioRef.current.currentTime = t;
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

const ManagerEvaluationViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [evaluation, setEvaluation] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [qaStatus, setQaStatus] = useState('Accepted');
  const [saving, setSaving] = useState(false);
  const [recordingsList, setRecordingsList] = useState([]);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!id) {
      setLoadError('No evaluation selected.');
      return;
    }
    setLoadError(null);
    if (id) {
      api.get(`/evaluations/${id}`).then(res => {
        const data = res.data.data;
        setEvaluation(data);
        setMetadata(data.metadata || {});
        const savedStatus = data.metadata?.qa_status || (data.status === 'Pass' ? 'Accepted' : data.status === 'Fail' ? 'Rejected' : data.status);
        setQaStatus(savedStatus);

        const normalizeRecList = (arr) => {
          if (!arr) return [];
          if (typeof arr === 'string') {
            try { arr = JSON.parse(arr); } catch { return []; }
          }
          return Array.isArray(arr) ? arr.filter(r => r && r.location) : [];
        };

        const mergeUniqueRecs = (...lists) => {
          const seen = new Set();
          const merged = [];
          lists.forEach(list => {
            normalizeRecList(list).forEach(item => {
              if (!seen.has(item.location)) {
                seen.add(item.location);
                merged.push(item);
              }
            });
          });
          return merged;
        };

        let recs = mergeUniqueRecs(
          data.recordings,
          data.metadata?.recordings,
          data.recording_url ? [{ location: data.recording_url, filename: data.recording_url.split('/').pop() || 'Call Recording' }] : []
        );
        setRecordingsList(recs);
      }).catch(() => {
        toast.error('Failed to load evaluation details.');
        setLoadError('Failed to load evaluation details.');
      });
    }
  }, [id]);

  const handleTogglePlay = (idx) => {
    if (playingIndex === idx) {
      setPlayingIndex(null);
    } else {
      setPlayingIndex(idx);
    }
  };

  const handleEnded = (idx) => {
    if (playingIndex === idx) {
      setPlayingIndex(null);
    }
  };

  const handleMetadataChange = (key, value) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!evaluation) return;
    setSaving(true);
    try {
      const finalBackendStatus = 
        qaStatus === 'Accepted' ? 'Pass' : 
        qaStatus === 'Rejected' ? 'Fail' : 
        qaStatus;

      await api.put(`/evaluations/${id}`, {
        status: finalBackendStatus,
        qa_remarks: metadata.laSideFeedback || 'Updated via manager sheet',
        metadata: {
          ...metadata,
          qa_status: qaStatus,
          recordings: recordingsList
        },
        // Send zeroes for legacy scores since we are using spreadsheet layout
        opening_script_score: evaluation.opening_script_score || 0,
        verification_score: evaluation.verification_score || 0,
        product_knowledge_score: evaluation.product_knowledge_score || 0,
        compliance_score: evaluation.compliance_score || 0,
        communication_score: evaluation.communication_score || 0,
        closing_score: evaluation.closing_score || 0,
        call_handling_score: evaluation.call_handling_score || 0
      });
      toast.success('Evaluation changes saved successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-400 mb-4">{loadError}</p>
        <button onClick={() => navigate(user?.role === 'QA Agent' ? '/my-assignments' : '/evaluations')} className="btn-secondary">Go back</button>
      </div>
    );
  }
  if (!evaluation) return <div className="p-10 text-center text-slate-400">Loading evaluation data...</div>;

  return (
    <div className="w-full min-h-[90vh] pb-10 flex flex-col">
      <div className="px-8 mt-4 flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Manager View: Call Evaluation</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">Review and edit the submitted QA sheet</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/evaluations')} className="btn-secondary px-5 py-2.5">
            <ArrowLeft size={16} className="mr-2" /> Back to List
          </button>
          {user?.role !== 'QA Agent' && (
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Top Panel: Audio Player(s) */}
      <div className="px-8 mb-8 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-indigo-400" />
            Recordings ({recordingsList.length})
          </h2>
          {recordingsList.length > 1 && (
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              All {recordingsList.length} recordings loaded
            </span>
          )}
        </div>

        {recordingsList.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-sm">
            No recording available for this call
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {recordingsList.map((rec, idx) => (
              <RecordingPlayerCard
                key={rec.location || idx}
                rec={rec}
                index={idx}
                total={recordingsList.length}
                isPlaying={playingIndex === idx}
                onTogglePlay={handleTogglePlay}
                onEnded={handleEnded}
              />
            ))}
          </div>
        )}
      </div>

      {/* Spreadsheet Form (EDITABLE) */}
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
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-28 text-center">Talk Time (sec)</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-36">QA Status</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[300px]">Agentside Feedback</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[350px]">LA side</th>
                  <th className="px-4 py-5 border-b border-r border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-48">LA Side Error</th>
                  {CHECKBOX_FIELDS.map(f => (
                    <th key={f.key} className="px-3 py-5 border-b border-r border-slate-800/50 text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-24 text-center">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-4 py-5 border-b border-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-48">Error Category</th>
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
                    <input 
                      className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-sm w-full min-h-[38px] focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all disabled:opacity-50"
                      value={metadata.teams || ''}
                      onChange={e => handleMetadataChange('teams', e.target.value)}
                      placeholder="Enter Team..."
                      disabled={user?.role === 'QA Agent'}
                    />
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-300 text-sm font-mono w-full truncate">
                      {evaluation.customer_phone || ''}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top text-center">
                    <div className="flex flex-col items-center gap-1">
                      <input 
                        className={`px-2 py-2 bg-slate-950 border rounded-lg text-sm w-full min-h-[38px] text-center font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
                          metadata.dup && metadata.dup !== '1' && metadata.dup !== '0'
                            ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                            : 'border-slate-700 text-slate-300'
                        }`}
                        value={metadata.dup || ''}
                        onChange={e => handleMetadataChange('dup', e.target.value)}
                        placeholder="—"
                      />
                      {metadata.dup && metadata.dup !== '1' && metadata.dup !== '0' && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400/90">
                          Duplicate
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top text-center">
                    <input 
                      list="manager-did-options"
                      className="px-2 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-sm w-full min-h-[38px] text-center font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-600"
                      value={metadata.dids || ''}
                      onChange={e => handleMetadataChange('dids', e.target.value)}
                      placeholder="Select or type DID..."
                    />
                    <datalist id="manager-did-options">
                      <option value="D1" />
                      <option value="D3" />
                      <option value="D4" />
                      <option value="D5" />
                      <option value="D6cpl" />
                      <option value="Hi" />
                      <option value="Hi main" />
                    </datalist>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <input 
                      className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-sm w-full min-h-[38px] text-center font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                      value={metadata.talkTime !== undefined ? metadata.talkTime : (evaluation.call_duration || '')}
                      onChange={e => handleMetadataChange('talkTime', e.target.value)}
                      placeholder="0"
                    />
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <select
                      className={`px-3 py-2 rounded-lg border text-sm font-bold w-full outline-none focus:ring-2 cursor-pointer text-center ${
                        qaStatus === 'Accepted'
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 focus:ring-emerald-500'
                          : qaStatus === 'Flagged'
                            ? 'text-amber-400 border-amber-500/30 bg-amber-500/10 focus:ring-amber-500'
                            : qaStatus === 'Decline'
                              ? 'text-purple-400 border-purple-500/30 bg-purple-500/10 focus:ring-purple-500'
                              : qaStatus === 'Not Billable'
                                ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10 focus:ring-cyan-500'
                                : 'text-rose-400 border-rose-500/30 bg-rose-500/10 focus:ring-rose-500'
                      }`}
                      value={qaStatus}
                      onChange={e => setQaStatus(e.target.value)}
                    >
                      <option className="bg-slate-900 text-emerald-400" value="Accepted">Accepted</option>
                      <option className="bg-slate-900 text-rose-400" value="Rejected">Rejected</option>
                      <option className="bg-slate-900 text-amber-400" value="Flagged">Flagged</option>
                      <option className="bg-slate-900 text-purple-400" value="Decline">Decline</option>
                      <option className="bg-slate-900 text-cyan-400" value="Not Billable">Not Billable</option>
                    </select>
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <textarea 
                      className="w-full h-[140px] bg-slate-950 border border-slate-700 text-sm p-3 rounded-lg text-slate-200 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all custom-scrollbar disabled:opacity-50"
                      value={metadata.agentSideFeedback || ''}
                      onChange={e => handleMetadataChange('agentSideFeedback', e.target.value)}
                      placeholder="Enter agent feedback..."
                      disabled={user?.role === 'QA Agent'}
                    />
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <textarea 
                      className="w-full h-[140px] bg-slate-950 border border-slate-700 text-sm p-3 rounded-lg text-slate-200 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all custom-scrollbar disabled:opacity-50"
                      value={metadata.laSideFeedback || ''}
                      onChange={e => handleMetadataChange('laSideFeedback', e.target.value)}
                      placeholder="Enter LA side feedback..."
                      disabled={user?.role === 'QA Agent'}
                    />
                  </td>

                  <td className="p-3 border-r border-slate-800/50 align-top">
                    <input 
                      list="manager-la-side-error-category-options"
                      className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-sm w-full min-h-[38px] focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-600"
                      value={metadata.laSideErrorCategory || ''}
                      onChange={e => handleMetadataChange('laSideErrorCategory', e.target.value)}
                      placeholder="Select or type LA Category..."
                    />
                    <datalist id="manager-la-side-error-category-options">
                      <option value="Already in a good plan" />
                      <option value="No plan Available" />
                      <option value="Customer become not intrested" />
                      <option value="call Back arange" />
                      <option value="call ended in no result" />
                      <option value="DNQ Customer" />
                      <option value="DNC Customer" />
                      <option value="Not billable" />
                      <option value="Decline" />
                    </datalist>
                  </td>

                  {/* Checkboxes */}
                  {CHECKBOX_FIELDS.map(f => (
                    <td key={f.key} className="p-3 border-r border-slate-800/50 align-top pt-5">
                      <div className="flex justify-center w-full">
                        <label className={`relative flex items-center p-1 rounded-full ${user?.role === 'QA Agent' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-800'}`}>
                          <input 
                            type="checkbox" 
                            disabled={user?.role === 'QA Agent'}
                            checked={metadata[f.key] || false} 
                            onChange={e => handleMetadataChange(f.key, e.target.checked)}
                            className="peer relative appearance-none w-6 h-6 border-2 border-slate-600 rounded-md bg-slate-950 checked:bg-indigo-500 checked:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer disabled:cursor-not-allowed"
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

                  <td className="p-3 border-slate-800/50 align-top">
                    <input 
                      list="manager-error-category-options"
                      disabled={user?.role === 'QA Agent'}
                      className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-sm w-full min-h-[38px] focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                      value={metadata.errorCategory || ''}
                      onChange={e => handleMetadataChange('errorCategory', e.target.value)}
                      placeholder="Select or type Category..."
                    />
                    <datalist id="manager-error-category-options">
                      <option value="Dnq master" />
                      <option value="Under Buffer" />
                      <option value="Fake Sale" />
                      <option value="Skipping Qualifying Questions" />
                      <option value="Quoting Money" />
                      <option value="Falls Statement" />
                      <option value="Promoising Statement" />
                      <option value="DNC Customer" />
                    </datalist>
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
