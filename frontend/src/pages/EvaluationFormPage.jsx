import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api, { uploadApi } from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Play, Pause, Volume2, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { getEstDateString } from '../utils/dateUtils';

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
  talkTime: '',
  agentSideFeedback: '',
  laSideFeedback: '',
  md: false, medicaid: false, age: false, name: false, zip: false,
  triCareVa: false, dm: false, nursingHome: false, bank: false,
  copays: false, interestInBenefits: false, medicareCard: false, dis: false,
  errorCategory: '',
  laSideErrorCategory: '',
};

function RecordingPlayerCard({ rec, index, total, isPlaying, onTogglePlay, onEnded }) {
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(rec.length ? parseFloat(rec.length) : 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!rec.location) {
      toast.error('No recording URL found.');
      return;
    }
    const cleanFilename = rec.filename || `recording_${index + 1}.mp3`;
    const finalFilename = cleanFilename.endsWith('.mp3') || cleanFilename.endsWith('.wav') ? cleanFilename : `${cleanFilename}.mp3`;
    
    setDownloading(true);
    try {
      // First try proxy endpoint to bypass CORS and force direct attachment download
      // Use uploadApi (5 min timeout) to avoid 30s timeout on large audio files
      const response = await uploadApi.get('/dialer/download-recording', {
        params: {
          url: rec.location,
          filename: finalFilename
        },
        responseType: 'blob'
      });
      
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'audio/mpeg' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', finalFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Download started');
    } catch {
      // Fallback: direct fetch or hidden iframe download without opening new tab
      try {
        const directRes = await fetch(rec.location);
        if (!directRes.ok) throw new Error('Direct fetch failed');
        const blob = await directRes.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', finalFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        toast.success('Download started');
      } catch {
        // Safe hidden trigger to prevent opening new tab
        const link = document.createElement('a');
        link.href = rec.location;
        link.setAttribute('download', finalFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Download initiated');
      }
    } finally {
      setDownloading(false);
    }
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
            <span className="text-xs font-mono text-slate-300 truncate max-w-[280px] sm:max-w-[420px]" title={rec.filename}>
              {rec.filename || `Recording ${index + 1}`}
            </span>
            {rec.date && <span className="text-[10px] text-slate-500">({rec.date})</span>}
          </div>

          <div className="flex items-center gap-2.5">
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

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Download this recording"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="text-[11px]">Download</span>
            </button>
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

const EvaluationFormPage = () => {
  const [searchParams] = useSearchParams();
  const callId = searchParams.get('call_id');
  const leadIdParam = searchParams.get('lead_id');
  const dialerParam = searchParams.get('dialer') || 'pharmacy';
  const teamParam = searchParams.get('team');
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [call, setCall] = useState(null);
  const [recordingsList, setRecordingsList] = useState(location.state?.recordings || []);
  const [playingIndex, setPlayingIndex] = useState(null);

  const [metadata, setMetadata] = useState({
    ...INITIAL_METADATA,
    teams: teamParam || ''
  });
  const [qaStatus, setQaStatus] = useState('Accepted');
  const [evaluationDate, setEvaluationDate] = useState(getEstDateString(new Date()));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Dynamic Datalist options (synced with Backend DB + Local Storage)
  const [didOptions, setDidOptions] = useState([
    'D1', 'D3', 'D4', 'D5', 'D6cpl', 'Hi', 'Hi main'
  ]);
  const [laCategoryOptions, setLaCategoryOptions] = useState([
    'Already in a good plan', 'No plan Available', 'Customer become not intrested',
    'call Back arange', 'call ended in no result', 'DNQ Customer', 'DNC Customer',
    'Not billable', 'Decline'
  ]);

  // Load dynamic options on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const localSavedDids = JSON.parse(localStorage.getItem('custom_dids') || '[]');
        const localSavedLa = JSON.parse(localStorage.getItem('custom_la_categories') || '[]');

        const res = await api.get('/evaluations/options/dropdowns');
        if (res.data?.success && res.data?.data) {
          const apiDids = res.data.data.dids || [];
          const apiLa = res.data.data.laSideErrorCategories || [];

          setDidOptions(prev => Array.from(new Set([...prev, ...apiDids, ...localSavedDids])));
          setLaCategoryOptions(prev => Array.from(new Set([...prev, ...apiLa, ...localSavedLa])));
        } else {
          setDidOptions(prev => Array.from(new Set([...prev, ...localSavedDids])));
          setLaCategoryOptions(prev => Array.from(new Set([...prev, ...localSavedLa])));
        }
      } catch (err) {
        console.warn('Could not fetch dynamic options from server, using local defaults:', err);
        const localSavedDids = JSON.parse(localStorage.getItem('custom_dids') || '[]');
        const localSavedLa = JSON.parse(localStorage.getItem('custom_la_categories') || '[]');
        setDidOptions(prev => Array.from(new Set([...prev, ...localSavedDids])));
        setLaCategoryOptions(prev => Array.from(new Set([...prev, ...localSavedLa])));
      }
    };
    loadOptions();
  }, []);

  // Helper to persist newly typed options to local state and localStorage
  const registerNewOption = (type, val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) return;
    if (type === 'dids') {
      setDidOptions(prev => {
        if (!prev.includes(trimmed)) {
          const next = [...prev, trimmed];
          try {
            const saved = JSON.parse(localStorage.getItem('custom_dids') || '[]');
            if (!saved.includes(trimmed)) {
              localStorage.setItem('custom_dids', JSON.stringify([...saved, trimmed]));
            }
          } catch (e) {
            console.debug('Failed to save custom did to localStorage:', e);
          }
          return next;
        }
        return prev;
      });
    } else if (type === 'laSideErrorCategory') {
      setLaCategoryOptions(prev => {
        if (!prev.includes(trimmed)) {
          const next = [...prev, trimmed];
          try {
            const saved = JSON.parse(localStorage.getItem('custom_la_categories') || '[]');
            if (!saved.includes(trimmed)) {
              localStorage.setItem('custom_la_categories', JSON.stringify([...saved, trimmed]));
            }
          } catch (e) {
            console.debug('Failed to save custom category to localStorage:', e);
          }
          return next;
        }
        return prev;
      });
    }
  };

  const assignmentIdParam = searchParams.get('assignment_id');
  const [currentLeadId, setCurrentLeadId] = useState(leadIdParam || null);
  const [currentDialer, setCurrentDialer] = useState(dialerParam || 'pharmacy');

  // Destination when exiting or completing evaluation:
  // QA Agents and anyone evaluating an assigned lead always return to /my-assignments
  const exitPath = (user?.role === 'QA Agent' || assignmentIdParam) ? '/my-assignments' : '/evaluations';

  const handleBack = () => {
    // If user came from My Assignments flow (has assignment_id) or is QA Agent, go directly back there
    if (assignmentIdParam || user?.role === 'QA Agent') {
      navigate('/my-assignments');
      return;
    }
    // If we have a leadId and no assignment (admin/manager came from dialer), go back to lead page
    const targetLeadId = currentLeadId || leadIdParam;
    if (targetLeadId) {
      navigate(`/dialer/lead/${targetLeadId}?dialer=${encodeURIComponent(currentDialer)}`);
      return;
    }
    // Fallback
    navigate(exitPath);
  };

  useEffect(() => {
    if (!callId) {
      setLoadError('No call selected. Open this form from an assignment or lead.');
      return;
    }
    setLoadError(null);
    if (callId) {
      api.get(`/calls/${callId}`).then(async res => {
        const callData = res.data.data;
        if (callData.is_evaluated) {
          toast.error('This call has already been evaluated! You cannot edit it.');
          navigate(exitPath);
          return;
        }
        setCall(callData);

        // Helper to normalize and merge recordings from any source
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
          callData.recordings,
          location.state?.recordings,
          callData.recording_url ? [{ location: callData.recording_url, filename: callData.recording_url.split('/').pop() || 'Call Recording' }] : []
        );

        // Detect dialer type
        const detectedDialer = dialerParam !== 'pharmacy' && dialerParam 
          ? dialerParam 
          : ((callData.team || callData.campaign_name || '').toLowerCase().includes('medicare') ? 'medicare' : 'pharmacy');
        setCurrentDialer(detectedDialer);

        // Resolve lead ID from params or notes (supporting both VICI_LEAD: and Lead ID: formats)
        const leadMatch = callData.notes?.match(/(?:Lead ID:\s*|VICI_LEAD:)(\d+)/i);
        const resolvedLeadId = leadIdParam || (leadMatch ? leadMatch[1] : null);
        if (resolvedLeadId) {
          setCurrentLeadId(resolvedLeadId);
        }

        if (recs.length <= 1 && resolvedLeadId) {
          try {
            const dialerRes = await api.get(`/dialer/recordings/${resolvedLeadId}?dialer=${encodeURIComponent(detectedDialer)}`);
            if (dialerRes.data.success && Array.isArray(dialerRes.data.data) && dialerRes.data.data.length > 0) {
              recs = mergeUniqueRecs(recs, dialerRes.data.data);
              // Cache back to backend so future requests don't need re-scraping
              api.put(`/calls/${callId}/recording`, {
                recording_url: callData.recording_url || recs[0]?.location,
                recordings: recs
              }).catch(() => {});
            }
          } catch (e) {
            console.error('Failed to fetch dialer recordings:', e);
          }
        }

        setRecordingsList(recs);

        setMetadata(prev => ({
          ...prev,
          teams: callData.team || callData.campaign_name || prev.teams,
          talkTime: prev.talkTime !== undefined && prev.talkTime !== '' ? prev.talkTime : (callData.call_duration || ''),
          dup: callData.is_duplicate ? (prev.dup || String(callData.duplicate_count || 2)) : prev.dup
        }));
      }).catch(() => {
        toast.error('Failed to load call details.');
        setLoadError('Failed to load call details.');
      });
    }
  }, [callId, leadIdParam, dialerParam, location.state, navigate, exitPath]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!call) return toast.error('No call selected.');
    
    // Auto-register any custom typed options into datalists & localStorage
    if (metadata.dids) registerNewOption('dids', metadata.dids);
    if (metadata.laSideErrorCategory) registerNewOption('laSideErrorCategory', metadata.laSideErrorCategory);

    setLoading(true);
    try {
      const finalBackendStatus = 
        qaStatus === 'Accepted' ? 'Pass' : 
        qaStatus === 'Rejected' ? 'Fail' : 
        qaStatus;

      await api.post('/evaluations', {
        call_lead_id: call.id,
        status: finalBackendStatus,
        qa_remarks: metadata.laSideFeedback || 'Evaluated via spreadsheet',
        evaluation_date: evaluationDate,
        metadata: {
          ...metadata,
          qa_status: qaStatus,
          recordings: recordingsList
        },
        recordings: recordingsList,
        // Send zeroes for legacy columns to satisfy backend schema
        opening_script_score: 0, verification_score: 0, product_knowledge_score: 0,
        compliance_score: 0, communication_score: 0, closing_score: 0, call_handling_score: 0,
        critical_errors: []
      });
      toast.success('Evaluation submitted successfully!');
      navigate(exitPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  if (loadError) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-400 mb-4">{loadError}</p>
        <button onClick={handleBack} className="btn-secondary">Go back</button>
      </div>
    );
  }
  if (!call) return <div className="p-10 text-center text-slate-400">Loading call data...</div>;

  return (
    <div className="w-full min-h-[90vh] pb-10 flex flex-col">
      <div className="px-8 mt-4 flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Call Evaluation</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">Listen to the recording and fill out the QA sheet below</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="btn-secondary px-5 py-2.5">
            <ArrowLeft size={16} className="mr-2" /> Back
          </button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary px-6 py-2.5 shadow-indigo-500/20 shadow-lg">
            {loading ? 'Saving...' : <><Save size={18} className="mr-2" /> Save & Submit</>}
          </button>
        </div>
      </div>

      <div className="px-8 flex flex-col gap-6 flex-1 min-h-0">
          {/* Top Panel: Audio Player(s) */}
          <div className="shrink-0 space-y-3">
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

          {/* Spreadsheet Form */}
          <div className="flex-1 w-full relative pb-10">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden w-full h-[60vh] relative">
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
                        <div className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg text-slate-300 text-sm font-mono w-full flex items-center justify-between gap-1">
                          <span className="truncate">{call.customer_phone}</span>
                          {call.is_duplicate && (
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded" title="Duplicate Phone Number">
                              x{call.duplicate_count || 2}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 border-r border-slate-800/50 align-top text-center">
                        <div className="flex flex-col items-center gap-1">
                          <input 
                            type="text"
                            value={metadata.dup} 
                            onChange={e => handleMetadataChange('dup', e.target.value)} 
                            placeholder="—"
                            className={`w-full bg-slate-950 border text-sm px-2 py-2 rounded-lg outline-none transition-all text-center font-bold ${
                              metadata.dup && metadata.dup !== '1' && metadata.dup !== '0'
                                ? 'border-amber-500/50 text-amber-400 bg-amber-500/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50'
                                : 'border-slate-800 text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50'
                            }`}
                          />
                          {call.is_duplicate && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400/90">
                              Duplicate
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 border-r border-slate-800/50 align-top text-center">
                        <input 
                          list="did-options"
                          value={metadata.dids} 
                          onChange={e => handleMetadataChange('dids', e.target.value)} 
                          onBlur={e => registerNewOption('dids', e.target.value)}
                          placeholder="Select or type DID..."
                          className="w-full bg-slate-950 border border-slate-800 text-sm px-2 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-center placeholder:text-slate-600 font-medium"
                        />
                        <datalist id="did-options">
                          {didOptions.map(opt => (
                            <option key={opt} value={opt} />
                          ))}
                        </datalist>
                      </td>

                      <td className="p-3 border-r border-slate-800/50 align-top">
                        <input 
                          type="text"
                          value={metadata.talkTime !== undefined ? metadata.talkTime : (call.call_duration || '')} 
                          onChange={e => handleMetadataChange('talkTime', e.target.value)} 
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-800 text-sm px-2 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-center font-mono"
                        />
                      </td>

                      <td className="p-3 border-r border-slate-800/50 align-top">
                        <select 
                          value={qaStatus} 
                          onChange={e => setQaStatus(e.target.value)} 
                          className={`w-full bg-slate-950 border text-sm font-bold px-3 py-2 rounded-lg outline-none transition-all focus:ring-1 cursor-pointer ${
                            qaStatus === 'Accepted' 
                              ? 'text-emerald-400 border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/50 bg-emerald-500/10' 
                              : qaStatus === 'Flagged' 
                                ? 'text-amber-400 border-amber-500/30 focus:border-amber-500/50 focus:ring-amber-500/50 bg-amber-500/10' 
                                : qaStatus === 'Decline'
                                  ? 'text-purple-400 border-purple-500/30 focus:border-purple-500/50 focus:ring-purple-500/50 bg-purple-500/10'
                                  : qaStatus === 'Not Billable'
                                    ? 'text-cyan-400 border-cyan-500/30 focus:border-cyan-500/50 focus:ring-cyan-500/50 bg-cyan-500/10'
                                    : 'text-rose-400 border-rose-500/30 focus:border-rose-500/50 focus:ring-rose-500/50 bg-rose-500/10'
                          }`}
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

                      <td className="p-3 border-r border-slate-800/50 align-top">
                        <input 
                          list="la-side-error-category-options"
                          value={metadata.laSideErrorCategory} 
                          onChange={e => handleMetadataChange('laSideErrorCategory', e.target.value)} 
                          onBlur={e => registerNewOption('laSideErrorCategory', e.target.value)}
                          placeholder="Select or type LA category..."
                          className="w-full bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-650"
                        />
                        <datalist id="la-side-error-category-options">
                          {laCategoryOptions.map(opt => (
                            <option key={opt} value={opt} />
                          ))}
                        </datalist>
                      </td>

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

                      <td className="p-3 border-slate-800/50 align-top">
                        <input 
                          list="error-category-options"
                          value={metadata.errorCategory} 
                          onChange={e => handleMetadataChange('errorCategory', e.target.value)} 
                          placeholder="Select or type category..."
                          className="w-full bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                        />
                        <datalist id="error-category-options">
                          <option value="DNQ Customer" />
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
    </div>
  );
};

export default EvaluationFormPage;
