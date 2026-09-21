import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Play, Pause, Volume2, Download, Loader2, Clock, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { getEstDateString, formatDateOnly } from '../utils/dateUtils';
import useEvaluationOptions from '../hooks/useEvaluationOptions';
import EditableOptionsInput from '../components/common/EditableOptionsInput';
import { downloadRecording } from '../utils/recordingDownload';
import { agentCanEvaluateCall, lockedDialerForUser } from '../utils/campaignAccess';

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

function RecordingPlayerCard({ rec, index, total, callPhone }) {
  const { currentRec, isPlaying, currentTime, duration, playbackRate, play, pause, setPlaybackRate } = useAudioPlayer();
  const isThisPlaying = isPlaying && currentRec?.location === rec.location;
  const [downloading, setDownloading] = useState(false);

  // The dialer reports the exact call length in seconds. Prefer that value for
  // display so it matches the dialer report exactly.
  const reportedLength =
    rec.length !== undefined && rec.length !== null && String(rec.length).trim() !== ''
      ? Math.round(parseFloat(rec.length))
      : null;

  // Use reported length for display; fall back to global duration when this track is active
  const activeDuration = (isThisPlaying || currentRec?.location === rec.location) ? duration : 0;
  const displayDuration = reportedLength != null && !isNaN(reportedLength) ? reportedLength : Math.round(activeDuration);
  const displayCurrentTime = isThisPlaying ? Math.min(Math.round(currentTime), displayDuration) : 0;
  const progressPct = displayDuration > 0 ? (displayCurrentTime / displayDuration) * 100 : 0;

  const handleToggle = () => {
    if (isThisPlaying) {
      pause();
    } else {
      play(rec, { phone: callPhone });
    }
  };

  const handleRateChange = (newRate) => {
    setPlaybackRate(newRate);
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadRecording(rec, index);
      toast.success('Download started');
    } catch (err) {
      toast.error(err.message || 'Failed to download recording.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`bg-slate-900/90 backdrop-blur-md border rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center relative overflow-hidden transition-all ${
      isThisPlaying ? 'border-indigo-500/60 ring-1 ring-indigo-500/30 bg-slate-900' : 'border-slate-800 hover:border-slate-750'
    }`}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${
        index === 0 ? 'bg-gradient-to-b from-indigo-500 to-purple-500' : 'bg-gradient-to-b from-emerald-500 to-teal-500'
      }`} />
      
      <button 
        type="button"
        onClick={handleToggle} 
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg transition-all hover:scale-105 active:scale-95 ${
          index === 0
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
        }`}
      >
        {isThisPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
              index === 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              Recording {index + 1}{total > 1 ? ` of ${total}` : ''}
            </span>
            {rec.tsr && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 shrink-0"
                title="Agent (TSR) that took this call"
              >
                TSR {rec.tsr}
              </span>
            )}
            <span className="text-xs font-mono text-slate-300 truncate max-w-[280px] sm:max-w-[420px]" title={rec.filename}>
              {rec.filename || `Recording ${index + 1}`}
            </span>
            {rec.date && <span className="text-[10px] text-slate-500">({rec.date})</span>}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold text-indigo-400">{displayCurrentTime}s</span>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-xs font-mono text-slate-400">{displayDuration}s</span>
            
            <select
              value={isThisPlaying ? playbackRate : 1}
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
            style={{ width: `${progressPct}%` }}
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
  const { user, hasRole } = useAuth();
  const canRemoveOptions = hasRole('Super Admin', 'QA Admin', 'Manager');

  const [call, setCall] = useState(null);
  const [recordingsList, setRecordingsList] = useState(location.state?.recordings || []);
  // No local playingIndex — playback is owned by the global AudioPlayerContext
  const { currentRec: globalRec, stop: stopGlobalAudio } = useAudioPlayer();

  // evaluatedMode: when the call is already evaluated, lock all fields except QA Status
  const [evaluatedMode, setEvaluatedMode] = useState(false);
  const [existingEvalId, setExistingEvalId] = useState(null);

  const [metadata, setMetadata] = useState({
    ...INITIAL_METADATA,
    teams: teamParam || ''
  });
  const [qaStatus, setQaStatus] = useState('Accepted');
  const [evaluationDate, setEvaluationDate] = useState(getEstDateString(new Date()));
  const [loading, setLoading] = useState(false);
  const [savingPending, setSavingPending] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const isLoadedRef = useRef(false);

  // ── localStorage draft key (persists form data across page refreshes) ────
  const DRAFT_KEY = callId ? `eval_draft_${callId}` : null;

  const loadDraft = useCallback(() => {
    if (!DRAFT_KEY) return null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [DRAFT_KEY]);

  const clearDraft = () => {
    if (DRAFT_KEY) {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
  };

  // Auto-save draft to localStorage whenever metadata, qaStatus, or evaluationDate changes
  useEffect(() => {
    if (!isLoadedRef.current || evaluatedMode || !DRAFT_KEY) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        metadata,
        qaStatus,
        evaluationDate,
        ts: Date.now()
      }));
    } catch { /* storage full — ignore */ }
  }, [metadata, qaStatus, evaluationDate, evaluatedMode, DRAFT_KEY]);

  // Shared, server-persisted dropdown lists (DID's / LA Side Error / Error Category).
  const { options: dropdownOptions, addOption, removeOption } = useEvaluationOptions();

  // Anything typed free-hand into a dropdown becomes a shared option for everyone.
  const registerNewOption = (field, val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) return;
    addOption(field, trimmed);
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
        const callData = res.data?.data;
        if (!callData) {
          setLoadError('This call could not be loaded. It may have been deleted.');
          return;
        }

        // Helper to normalize and merge recordings from any source
        const normalizeRecList = (arr) => {
          if (!arr) return [];
          if (typeof arr === 'string') {
            try { arr = JSON.parse(arr); } catch { return []; }
          }
          return Array.isArray(arr) ? arr.filter(r => r && r.location) : [];
        };

        const mergeUniqueRecs = (...lists) => {
          const byLocation = new Map();
          lists.forEach(list => {
            normalizeRecList(list).forEach(item => {
              const existing = byLocation.get(item.location);
              if (!existing) {
                byLocation.set(item.location, { ...item });
                return;
              }
              const merged = { ...existing };
              if (!(parseFloat(merged.length) > 0) && parseFloat(item.length) > 0) merged.length = item.length;
              if (!merged.tsr && item.tsr) merged.tsr = item.tsr;
              if (!merged.date && item.date) merged.date = item.date;
              if (!merged.recid && item.recid) merged.recid = item.recid;
              if (!merged.filename && item.filename) merged.filename = item.filename;
              byLocation.set(item.location, merged);
            });
          });
          return Array.from(byLocation.values());
        };

        let recs = mergeUniqueRecs(
          callData.recordings,
          location.state?.recordings,
          callData.recording_url ? [{ location: callData.recording_url, filename: callData.recording_url.split('/').pop() || 'Call Recording' }] : []
        );

        if (callData.is_evaluated) {
          // Instead of redirecting, load the existing evaluation and show a locked form
          // so the user can only change the QA Status.
          try {
            const evalRes = await api.get('/evaluations', { params: { call_lead_id: callData.id } });
            const evals = evalRes.data?.data || [];
            const matchingEval = evals.find(e => String(e.call_lead_id) === String(callData.id)) || evals[0];
            if (matchingEval) {
              setExistingEvalId(matchingEval.id);
              const evMeta = matchingEval.metadata || {};
              setMetadata(prev => ({
                ...prev,
                teams: evMeta.teams || callData.team || callData.campaign_name || '',
                dup: evMeta.dup || '',
                dids: evMeta.dids || '',
                talkTime: evMeta.talkTime || callData.call_duration || '',
                agentSideFeedback: evMeta.agentSideFeedback || '',
                laSideFeedback: evMeta.laSideFeedback || matchingEval.qa_remarks || '',
                md: evMeta.md || false, medicaid: evMeta.medicaid || false,
                age: evMeta.age || false, name: evMeta.name || false,
                zip: evMeta.zip || false, triCareVa: evMeta.triCareVa || false,
                dm: evMeta.dm || false, nursingHome: evMeta.nursingHome || false,
                bank: evMeta.bank || false, copays: evMeta.copays || false,
                interestInBenefits: evMeta.interestInBenefits || false,
                medicareCard: evMeta.medicareCard || false, dis: evMeta.dis || false,
                laSideErrorCategory: evMeta.laSideErrorCategory || '',
                errorCategory: evMeta.errorCategory || '',
              }));
              const backendStatus = matchingEval.status;
              const frontendStatus =
                backendStatus === 'Pass' ? 'Accepted' :
                backendStatus === 'Fail' ? 'Rejected' :
                backendStatus || 'Accepted';
              setQaStatus(frontendStatus);
              if (matchingEval.evaluation_date) setEvaluationDate(matchingEval.evaluation_date.split('T')[0]);
              if (matchingEval.recordings) {
                recs = mergeUniqueRecs(recs, matchingEval.recordings);
              }
            }
          } catch { /* ignore — still show locked mode */ }
          setRecordingsList(recs);
          setCall(callData);
          setEvaluatedMode(true);
          isLoadedRef.current = true;
          toast('This call is already evaluated. Only QA Status can be changed.', {
            duration: 5000,
            style: { background: '#1e293b', color: '#fbbf24', border: '1px solid #92400e' },
            icon: '🔒'
          });
          return;
        }

        if (!agentCanEvaluateCall(user, callData)) {
          toast.error(`You can only evaluate ${user?.campaign_name || 'your assigned'} campaign calls.`);
          setLoadError(`This call belongs to ${callData.campaign_name || 'another campaign'}. You are assigned to ${user?.campaign_name || 'a different campaign'}.`);
          return;
        }
        setCall(callData);

        // Detect dialer type
        const locked = lockedDialerForUser(user);
        const detectedDialer = locked
          || (dialerParam !== 'pharmacy' && dialerParam
            ? dialerParam
            : ((callData.team || callData.campaign_name || '').toLowerCase().includes('medicare') ? 'medicare' : 'pharmacy'));
        setCurrentDialer(detectedDialer);

        // Resolve lead ID from params or notes (supporting both VICI_LEAD: and Lead ID: formats)
        const leadMatch = callData.notes?.match(/(?:Lead ID:\s*|VICI_LEAD:)(\d+)/i);
        const resolvedLeadId = leadIdParam || (leadMatch ? leadMatch[1] : null);
        if (resolvedLeadId) {
          setCurrentLeadId(resolvedLeadId);
        }

        // Re-scrape when there is nothing cached yet, or when the cached rows
        // predate length/TSR capture, so seconds and the agent id show up.
        const hasLengths = recs.some(r => parseFloat(r.length) > 0);
        if ((recs.length <= 1 || !hasLengths) && resolvedLeadId) {
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

        // Talk time is expressed in seconds: sum the actual recording lengths
        // (each `length` is already in seconds). Fall back to the uploaded
        // call_duration only when no recording length is available.
        const totalSeconds = recs.reduce((sum, r) => {
          const len = parseFloat(r.length);
          return sum + (isNaN(len) ? 0 : Math.round(len));
        }, 0);
        const talkTimeSeconds = totalSeconds > 0
          ? String(totalSeconds)
          : (callData.call_duration || '');

        // Load previously saved pending data (if any) to pre-fill the form
        let pendingMeta = null;
        try {
          const pendingRes = await api.get(`/evaluations/pending/${callId}`);
          if (pendingRes.data?.success && pendingRes.data?.data) {
            pendingMeta = pendingRes.data.data;
          }
        } catch {
          // 404 is expected when no pending data exists — ignore silently
        }

        // Check for local in-progress draft (persists through refresh)
        const draft = loadDraft();

        setMetadata(prev => ({
          ...prev,
          teams: callData.team || callData.campaign_name || prev.teams,
          talkTime: pendingMeta?.metadata?.talkTime ?? (prev.talkTime !== undefined && prev.talkTime !== '' ? prev.talkTime : talkTimeSeconds),
          dup: callData.is_duplicate ? (prev.dup || String(callData.duplicate_count || 2)) : prev.dup,
          // Restore all pending metadata fields
          ...(pendingMeta?.metadata || {}),
          // Unsaved local edits take highest precedence so refresh never wipes out work
          ...(draft?.metadata || {})
        }));

        if (draft?.qaStatus) {
          setQaStatus(draft.qaStatus);
        } else if (pendingMeta?.qa_status) {
          setQaStatus(pendingMeta.qa_status);
        }

        if (draft?.evaluationDate) {
          setEvaluationDate(draft.evaluationDate);
        } else if (pendingMeta?.evaluation_date) {
          setEvaluationDate(pendingMeta.evaluation_date);
        }

        if (draft?.metadata) {
          toast('💾 Restored unsaved edits from your session.', {
            duration: 3500,
            style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }
          });
        } else if (pendingMeta) {
          toast('📋 Pending draft restored — your previous notes have been loaded.', {
            duration: 4000,
            style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
            icon: '🔄'
          });
        }

        isLoadedRef.current = true;
      }).catch(() => {
        toast.error('Failed to load call details.');
        setLoadError('Failed to load call details.');
      });
    }
  }, [callId, leadIdParam, dialerParam, location.state, navigate, exitPath, user, loadDraft]);

  // No local handleTogglePlay/handleEnded — audio is managed globally.

  const handleMetadataChange = (key, value) => {
    if (evaluatedMode) return;
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  // Also auto-save when qaStatus or evaluationDate changes
  const handleQaStatusChange = (newStatus) => {
    setQaStatus(newStatus);
  };

  const handleEvaluationDateChange = (newDate) => {
    if (evaluatedMode) return;
    setEvaluationDate(newDate);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!call) return toast.error('No call selected.');
    
    // Auto-register any custom typed options so they show up for everyone next time
    if (metadata.dids) registerNewOption('dids', metadata.dids);
    if (metadata.laSideErrorCategory) registerNewOption('laSideErrorCategory', metadata.laSideErrorCategory);
    if (metadata.errorCategory) registerNewOption('errorCategory', metadata.errorCategory);

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
      // Stop any globally playing audio for this call after submission
      if (globalRec && recordingsList.some(r => r.location === globalRec.location)) {
        stopGlobalAudio();
      }
      clearDraft(); // remove localStorage draft
      navigate(exitPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePending = async () => {
    if (!call) return toast.error('No call selected.');
    setSavingPending(true);
    try {
      await api.post('/evaluations/pending', {
        call_lead_id: call.id,
        metadata: { ...metadata, qa_status: qaStatus, recordings: recordingsList },
        recordings: recordingsList,
        qa_status: qaStatus,
        evaluation_date: evaluationDate,
      });
      toast.success('Call saved as pending. You can return to it anytime.');
      clearDraft(); // remove localStorage draft
      navigate(exitPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save as pending.');
    } finally {
      setSavingPending(false);
    }
  };

  // ── Status-only update (evaluated mode) ────────────────────────────────────
  const handleUpdateStatus = async () => {
    if (!existingEvalId) return toast.error('Evaluation ID not found.');
    setLoading(true);
    try {
      const finalBackendStatus =
        qaStatus === 'Accepted' ? 'Pass' :
        qaStatus === 'Rejected' ? 'Fail' :
        qaStatus;
      await api.patch(`/evaluations/${existingEvalId}/status`, { status: finalBackendStatus });
      toast.success('QA Status updated successfully!');
      clearDraft();
      navigate(exitPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
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
    <div className="w-full min-h-[90vh] pb-20 flex flex-col">
      <div className="px-8 mt-4 flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Call Evaluation</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">Listen to the recording and fill out the QA sheet below</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="btn-secondary px-5 py-2.5">
            <ArrowLeft size={16} className="mr-2" /> Back
          </button>
          {evaluatedMode ? (
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={18} />}
              {loading ? 'Updating Status...' : 'Update QA Status'}
            </button>
          ) : (
            <>
              {/* Save as Pending — skips final submission, preserves work */}
              <button
                type="button"
                onClick={handleSavePending}
                disabled={savingPending || loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                title="Save form data without submitting — you can return later"
              >
                {savingPending ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                {savingPending ? 'Saving...' : 'Save as Pending'}
              </button>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary px-6 py-2.5 shadow-indigo-500/20 shadow-lg">
                {loading ? 'Saving...' : <><Save size={18} className="mr-2" /> Save &amp; Submit</>}
              </button>
            </>
          )}
        </div>
      </div>

      {evaluatedMode && (
        <div className="mx-8 mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-300 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-amber-200 text-sm">Evaluation Locked</p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                This call has already been evaluated. All form fields are locked. You can only update the <strong>QA Status</strong>.
              </p>
            </div>
          </div>
          <span className="text-[11px] px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 font-semibold uppercase tracking-wider shrink-0">
            QA Status Editable
          </span>
        </div>
      )}

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
                    callPhone={call?.customer_phone}
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
                          {formatDateOnly(call.call_date, 'dd MMM yyyy')}
                        </div>
                      </td>
                      
                      <td className="p-3 border-r border-slate-800/50 align-top">
                        <input
                          type="date"
                          value={evaluationDate}
                          onChange={e => handleEvaluationDateChange(e.target.value)}
                          disabled={evaluatedMode}
                          className={`w-full bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all ${
                            evaluatedMode ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        />
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
                        <input
                          type="text"
                          value={metadata.teams}
                          onChange={e => handleMetadataChange('teams', e.target.value)}
                          disabled={evaluatedMode}
                          placeholder="Enter Team..."
                          className={`w-full bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 ${
                            evaluatedMode ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        />
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
                            disabled={evaluatedMode}
                            className={`w-full bg-slate-950 border text-sm px-2 py-2 rounded-lg outline-none transition-all text-center font-bold ${
                              evaluatedMode ? 'opacity-60 cursor-not-allowed' : ''
                            } ${
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
                        <EditableOptionsInput
                          id="did-options"
                          field="dids"
                          label="DID's"
                          value={metadata.dids}
                          onChange={v => handleMetadataChange('dids', v)}
                          onBlur={e => registerNewOption('dids', e.target.value)}
                          options={dropdownOptions.dids}
                          onAddOption={addOption}
                          onRemoveOption={removeOption}
                          canRemove={canRemoveOptions}
                          disabled={evaluatedMode}
                          placeholder="Select or type DID..."
                          className="bg-slate-950 border border-slate-800 text-sm px-2 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-center placeholder:text-slate-600 font-medium"
                        />
                      </td>

                      <td className="p-3 border-r border-slate-800/50 align-top">
                        <input 
                          type="text"
                          value={metadata.talkTime !== undefined ? metadata.talkTime : (call.call_duration || '')} 
                          onChange={e => handleMetadataChange('talkTime', e.target.value)} 
                          placeholder="0 sec"
                          disabled={evaluatedMode}
                          className={`w-full bg-slate-950 border border-slate-800 text-sm px-2 py-2 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-center font-mono ${
                            evaluatedMode ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        />
                      </td>

                      <td className="p-3 border-r border-slate-800/50 align-top">
                        <select 
                          value={qaStatus} 
                          onChange={e => handleQaStatusChange(e.target.value)} 
                          className={`w-full bg-slate-950 border text-sm font-bold px-3 py-2 rounded-lg outline-none transition-all focus:ring-2 cursor-pointer ${
                            evaluatedMode ? 'ring-2 ring-indigo-500/60 shadow-lg shadow-indigo-500/20' : ''
                          } ${
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
                          disabled={evaluatedMode}
                          className={`w-full h-[140px] bg-slate-950 border border-slate-800 text-sm p-3 rounded-lg outline-none text-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none placeholder:text-slate-600 custom-scrollbar ${
                            evaluatedMode ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        />
                      </td>

                      <td className="p-3 border-r border-slate-800/50 align-top">
                        <textarea
                          value={metadata.laSideFeedback}
                          onChange={e => handleMetadataChange('laSideFeedback', e.target.value)}
                          placeholder="LA side review..."
                          disabled={evaluatedMode}
                          className={`w-full h-[140px] bg-slate-950 border border-slate-800 text-sm p-3 rounded-lg outline-none text-slate-200 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none placeholder:text-slate-600 custom-scrollbar ${
                            evaluatedMode ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        />
                      </td>

                      <td className="p-3 border-r border-slate-800/50 align-top">
                        <EditableOptionsInput
                          id="la-side-error-category-options"
                          field="laSideErrorCategory"
                          label="LA Side Error"
                          value={metadata.laSideErrorCategory}
                          onChange={v => handleMetadataChange('laSideErrorCategory', v)}
                          onBlur={e => registerNewOption('laSideErrorCategory', e.target.value)}
                          options={dropdownOptions.laSideErrorCategory}
                          onAddOption={addOption}
                          onRemoveOption={removeOption}
                          canRemove={canRemoveOptions}
                          disabled={evaluatedMode}
                          placeholder="Select or type LA category..."
                          className="bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                        />
                      </td>

                      {CHECKBOX_FIELDS.map(f => (
                        <td key={f.key} className="p-3 border-r border-slate-800/50 align-top pt-5">
                          <div className="flex justify-center w-full">
                            <label className={`relative flex items-center p-1 rounded-full transition-colors ${
                              evaluatedMode ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-800/50'
                            }`}>
                              <input 
                                type="checkbox" 
                                checked={!!metadata[f.key]} 
                                onChange={e => handleMetadataChange(f.key, e.target.checked)} 
                                disabled={evaluatedMode}
                                className="peer relative appearance-none w-6 h-6 border-2 border-slate-700 rounded-md bg-slate-950 checked:bg-indigo-500 checked:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all cursor-pointer disabled:cursor-not-allowed"
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
                        <EditableOptionsInput
                          id="error-category-options"
                          field="errorCategory"
                          label="Error Category"
                          value={metadata.errorCategory}
                          onChange={v => handleMetadataChange('errorCategory', v)}
                          onBlur={e => registerNewOption('errorCategory', e.target.value)}
                          options={dropdownOptions.errorCategory}
                          onAddOption={addOption}
                          onRemoveOption={removeOption}
                          canRemove={canRemoveOptions}
                          disabled={evaluatedMode}
                          placeholder="Select or type category..."
                          className="bg-slate-950 border border-slate-800 text-sm px-3 py-2 rounded-lg outline-none text-slate-300 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                        />
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
