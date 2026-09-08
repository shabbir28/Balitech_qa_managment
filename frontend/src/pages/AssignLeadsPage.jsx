import { useEffect, useState, useMemo, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Send, Search, Phone, CheckSquare, Square, Upload, FileText,
  ChevronDown, UserCheck, Target, X,
  Trash2, RefreshCw,
  Play, Pause, Volume2, SkipBack, SkipForward,
  Copy, Layers, Sliders, Hash
} from 'lucide-react';

/* ─── Audio Preview Modal ─────────────────────────────────────────── */
const AudioModal = ({ url, phone, agentName, onClose }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
  const pct = dur ? (cur / dur) * 100 : 0;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => toast.error('Could not play audio.')); setPlaying(true); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Call Recording</p>
              <p className="text-[11px] text-slate-400 font-mono">{phone || 'Unknown'} • {agentName || 'Agent'}</p>
            </div>
          </div>
          <button onClick={() => { audioRef.current?.pause(); onClose(); }} className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <audio ref={audioRef} src={url} onTimeUpdate={() => setCur(audioRef.current?.currentTime || 0)} onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)} onEnded={() => setPlaying(false)} preload="metadata" />
          <div className="relative h-1.5 bg-slate-800 rounded-full cursor-pointer overflow-hidden" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * (dur || 0); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }}>
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => { const t = Math.max(0, cur - 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={toggle} className="w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={() => { const t = Math.min(dur, cur + 10); if (audioRef.current) audioRef.current.currentTime = t; setCur(t); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Phone Tag Input ─────────────────────────────────────────────── */
const PhoneTagInput = ({ phones, onChange }) => {
  const [val, setVal] = useState('');
  const ref = useRef(null);

  const add = (raw) => {
    const c = raw.trim().replace(/[^0-9+\-() ]/g, '');
    if (!c) return;
    if (!phones.includes(c)) onChange([...phones, c]);
    setVal('');
  };

  const handleKey = (e) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key)) { e.preventDefault(); add(val); }
    else if (e.key === 'Backspace' && !val && phones.length > 0) onChange(phones.slice(0, -1));
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const nums = e.clipboardData.getData('text').split(/[\n,\s;]+/).map((p) => p.trim().replace(/[^0-9+\-() ]/g, '')).filter((p) => p.length >= 7);
    const unique = [...new Set([...phones, ...nums])];
    onChange(unique);
    setVal('');
    toast.success(`Imported ${unique.length - phones.length} numbers`);
  };

  return (
    <div className="min-h-[140px] bg-[#0B1120] border border-slate-800 rounded-xl p-3 cursor-text focus-within:border-emerald-500/40 transition-all" onClick={() => ref.current?.focus()}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {phones.map((ph, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-md text-[11px] font-mono font-semibold">
            <Phone className="w-3 h-3 opacity-60" />{ph}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(phones.filter((p) => p !== ph)); }} className="text-emerald-400 hover:text-rose-400 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={handleKey} onPaste={handlePaste} onBlur={() => { if (val.trim()) add(val); }}
          placeholder={phones.length === 0 ? 'Type number & press Enter, or paste from Excel...' : 'Add more...'}
          className="flex-1 min-w-[180px] bg-transparent outline-none text-slate-200 text-xs placeholder:text-slate-600 py-1"
        />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
        <span>Paste multiple numbers from Excel, CSV or Notepad</span>
        {phones.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Clear ({phones.length})
          </button>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/*  MAIN: Single-Page Assign Leads                                    */
/* ═══════════════════════════════════════════════════════════════════ */
const AssignLeadsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [leads, setLeads] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceTab, setSourceTab] = useState('pool');
  const [manualPhones, setManualPhones] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [audioPreview, setAudioPreview] = useState(null);
  const [customQty, setCustomQty] = useState('');
  const [campDropdownOpen, setCampDropdownOpen] = useState(false);
  const [evalDropdownOpen, setEvalDropdownOpen] = useState(false);
  const [evalSearch, setEvalSearch] = useState('');
  const campRef = useRef(null);
  const evalRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (campRef.current && !campRef.current.contains(e.target)) setCampDropdownOpen(false);
      if (evalRef.current && !evalRef.current.contains(e.target)) setEvalDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load campaigns & team
  useEffect(() => {
    Promise.all([api.get('/campaigns'), api.get('/teams/members/available')])
      .then(([cRes, uRes]) => {
        const campList = cRes.data.data || [];
        setCampaigns(campList);
        setTeamMembers(uRes.data.data || []);
        if (campList.length > 0) setSelectedCampaign((prev) => prev || campList[0].name);
      })
      .catch(() => toast.error('Failed to load data.'));
  }, []);

  const [salesDate, setSalesDate] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch leads - pull today's dialer sales directly from dialer_sales_history
  useEffect(() => {
    let alive = true;
    const fetch = async () => {
      if (!selectedCampaign) { setLeads([]); return; }
      setLeadsLoading(true);
      try {
        const res = await api.get('/calls/dialer-sales-leads', {
          params: { campaign_name: selectedCampaign, search }
        });
        if (alive) {
          setLeads(res.data.data || []);
          if (res.data.date) setSalesDate(res.data.date);
        }
      } catch {
        // Fallback to /calls if dialer-sales-leads fails
        try {
          const fallbackRes = await api.get('/calls', { params: { campaign_name: selectedCampaign, limit: 300, search } });
          if (alive) setLeads(fallbackRes.data.data || []);
        } catch {
          if (alive) toast.error('Failed to fetch leads.');
        }
      } finally {
        if (alive) setLeadsLoading(false);
      }
    };
    fetch();
    return () => { alive = false; };
  }, [selectedCampaign, search, refreshTrigger]);

  // Evaluators filtered
  const filteredEvaluators = useMemo(() => {
    return teamMembers.filter((m) => {
      const mc = !selectedCampaign || m.campaign_name === selectedCampaign;
      const ms = !evalSearch || m.name.toLowerCase().includes(evalSearch.toLowerCase());
      return mc && ms;
    });
  }, [teamMembers, selectedCampaign, evalSearch]);

  // Reset assignee if not in list
  useEffect(() => {
    if (assignTo && !filteredEvaluators.some((m) => String(m.id) === String(assignTo))) setAssignTo('');
  }, [selectedCampaign, filteredEvaluators, assignTo]);

  // Statuses
  const distinctStatuses = useMemo(() => {
    const s = new Set();
    leads.forEach((l) => { if (l.disposition) s.add(l.disposition.trim()); });
    return Array.from(s);
  }, [leads]);

  // Filtered leads
  const displayedLeads = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== 'ALL') {
        const d = l.disposition ? l.disposition.trim() : 'Unspecified';
        if (d.toUpperCase() !== statusFilter.toUpperCase()) return false;
      }
      return true;
    });
  }, [leads, statusFilter]);

  // Helpers
  const toggleLead = (id) => setSelectedLeadIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const toggleSelectAll = () => {
    const ids = displayedLeads.map((l) => l.id);
    const all = ids.length > 0 && ids.every((id) => selectedLeadIds.includes(id));
    if (all) setSelectedLeadIds((p) => p.filter((id) => !ids.includes(id)));
    else setSelectedLeadIds((p) => [...new Set([...p, ...ids])]);
  };

  const selectQty = (n) => {
    const ids = displayedLeads.slice(0, n).map((l) => l.id);
    setSelectedLeadIds((p) => [...new Set([...p, ...ids])]);
    toast.success(`Selected top ${Math.min(n, displayedLeads.length)} leads`);
  };

  const copyPhone = (ph, e) => { e.stopPropagation(); if (!ph) return; navigator.clipboard.writeText(ph); toast.success(`Copied ${ph}`); };

  const handleFileUpload = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 250 * 1024 * 1024) return toast.error('File exceeds 250MB.');
    setUploadFile(f);
    toast.success(`Loaded: ${f.name}`);
    e.target.value = '';
  };

  const totalSelected = selectedLeadIds.length + manualPhones.length + (uploadFile ? 1 : 0);
  const selectedEvaluator = teamMembers.find((m) => String(m.id) === String(assignTo));

  const handleSubmit = async () => {
    if (!selectedCampaign) return toast.error('Select a campaign.');
    if (!assignTo) return toast.error('Select an evaluator.');
    if (selectedLeadIds.length === 0 && manualPhones.length === 0 && !uploadFile)
      return toast.error('Select leads, enter numbers, or upload a file.');

    setLoading(true);
    try {
      if (uploadFile && sourceTab === 'file') {
        const fd = new FormData();
        fd.append('file', uploadFile);
        fd.append('assigned_to', assignTo);
        fd.append('campaign_name', selectedCampaign);
        if (assignmentNotes) fd.append('notes', assignmentNotes);
        const res = await api.post('/assignments/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success(res.data.message || 'File uploaded & leads assigned!');
        setUploadFile(null);
      } else {
        // Collect full selected dialer leads objects
        const selectedDialerLeadObjs = leads
          .filter((l) => selectedLeadIds.includes(l.id))
          .map((l) => ({
            id: l.id,
            lead_id: l.lead_id,
            customer_phone: l.customer_phone,
            phone: l.customer_phone,
            agent_name: l.agent_name,
            agent: l.agent_name,
            campaign_name: l.campaign_name || selectedCampaign,
            team: l.campaign_name,
            call_date: l.call_date,
            disposition: l.disposition
          }));

        const res = await api.post('/assignments', {
          call_lead_ids: [],
          dialer_leads: selectedDialerLeadObjs,
          manual_leads: manualPhones,
          assigned_to: assignTo,
          campaign_name: selectedCampaign,
          notes: assignmentNotes,
        });
        toast.success(res.data.message || 'Leads assigned successfully!');
        setSelectedLeadIds([]);
        setManualPhones([]);
        setCustomQty('');
        // Trigger re-fetch of unassigned leads
        setRefreshTrigger((prev) => prev + 1);
      }
      setAssignmentNotes('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign leads.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Render ────────────────────────────────────────────────────── */
  return (
    <div className="font-sans pb-8">

      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Target className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Assign Leads</h1>
          </div>
        </div>
      </div>

      {/* ── Main Content: Left (Assignment Panel) & Right (Lead Selection Area) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

        {/* ── LEFT: Campaign, Evaluator & Assignment Panel ─────────── */}
        <div className="space-y-4">

          {/* Configuration & Selection Card */}
          <div className="bg-[#111827] border border-slate-700/40 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-emerald-400" /> Assignment Controls
            </h3>

            {/* Campaign Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Target Campaign</label>
              <div className="relative" ref={campRef}>
                <button type="button" onClick={() => { setCampDropdownOpen(!campDropdownOpen); setEvalDropdownOpen(false); }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 bg-[#0B1120] border border-slate-700/60 rounded-xl text-xs font-medium text-slate-200 hover:border-slate-600 transition-colors">
                  <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="flex-1 text-left truncate">{selectedCampaign || 'Select Campaign'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${campDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {campDropdownOpen && (
                  <div className="absolute top-full mt-1.5 left-0 w-full bg-[#111827] border border-slate-700/70 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto">
                    {campaigns.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCampaign(c.name); setSelectedLeadIds([]); setCampDropdownOpen(false); }}
                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between ${selectedCampaign === c.name ? 'bg-emerald-500/10 text-emerald-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                        <span className="truncate">{c.name}</span>
                        {selectedCampaign === c.name && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Evaluator Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Assign Evaluator</label>
              <div className="relative" ref={evalRef}>
                <button type="button" onClick={() => { setEvalDropdownOpen(!evalDropdownOpen); setCampDropdownOpen(false); }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 bg-[#0B1120] border border-slate-700/60 rounded-xl text-xs font-medium text-slate-200 hover:border-slate-600 transition-colors">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="flex-1 text-left truncate">{selectedEvaluator ? selectedEvaluator.name : 'Select QA Evaluator'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${evalDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {evalDropdownOpen && (
                  <div className="absolute top-full mt-1.5 left-0 w-full bg-[#111827] border border-slate-700/70 rounded-xl shadow-xl z-30 overflow-hidden">
                    <div className="p-2 border-b border-slate-800">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                        <input value={evalSearch} onChange={(e) => setEvalSearch(e.target.value)} placeholder="Search evaluator..."
                          className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 pl-7 pr-3 py-1.5 rounded-lg text-[11px] outline-none focus:border-emerald-500/40 placeholder:text-slate-500" />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                      {filteredEvaluators.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">No evaluators found</p>
                      ) : filteredEvaluators.map((m) => (
                        <button key={m.id} type="button"
                          onClick={() => { setAssignTo(String(m.id)); setEvalDropdownOpen(false); setEvalSearch(''); }}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2.5 ${String(assignTo) === String(m.id) ? 'bg-emerald-500/10 text-emerald-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${String(assignTo) === String(m.id) ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{m.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{m.role || 'QA Agent'}{m.campaign_name ? ` • ${m.campaign_name}` : ''}</p>
                          </div>
                          {String(assignTo) === String(m.id) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Smart Quantity Selector Card on Left Panel */}
            <div className="bg-[#0B1120] border border-slate-700/50 rounded-xl p-3 space-y-2.5 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Select Quantity</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                  Pool: <strong className="text-emerald-400">{displayedLeads.length}</strong>
                </span>
              </div>

              {/* Input + Action button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Hash className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="number"
                    min="1"
                    max={displayedLeads.length || 1}
                    value={customQty}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomQty(v);
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n > 0 && n <= displayedLeads.length) {
                        selectQty(n);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const n = parseInt(customQty, 10);
                        if (!isNaN(n) && n > 0) selectQty(n);
                      }
                    }}
                    placeholder={`1 - ${displayedLeads.length}`}
                    className="w-full bg-[#111827] border border-slate-700/70 text-slate-100 text-xs rounded-lg pl-7 pr-3 py-1.5 outline-none focus:border-emerald-500/60 font-mono font-medium placeholder:text-slate-600 transition-colors shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const n = parseInt(customQty, 10);
                    if (!isNaN(n) && n > 0) {
                      selectQty(n);
                    } else {
                      toast.error('Enter a valid quantity');
                    }
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-lg text-[11px] font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 shrink-0"
                >
                  Pick Leads
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1">
                {[10, 25, 50, 100].map((n) => {
                  const isActive = selectedLeadIds.length === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setCustomQty(String(n));
                        selectQty(n);
                      }}
                      className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-all border ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                          : 'bg-[#111827] text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      +{n}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setCustomQty(String(displayedLeads.length));
                    toggleSelectAll();
                  }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${
                    selectedLeadIds.length === displayedLeads.length && displayedLeads.length > 0
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-[#111827] text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50'
                  }`}
                >
                  All
                </button>
                {selectedLeadIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLeadIds([]);
                      setCustomQty('');
                    }}
                    title="Clear Selection"
                    className="p-1 rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 transition-all text-[10px] font-medium"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Counts Grid */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-[#0B1120] rounded-lg p-2 text-center border border-slate-800/60">
                <p className="text-base font-bold text-white">{selectedLeadIds.length}</p>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Records</p>
              </div>
              <div className="bg-[#0B1120] rounded-lg p-2 text-center border border-slate-800/60">
                <p className="text-base font-bold text-white">{manualPhones.length}</p>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Manual</p>
              </div>
              <div className="bg-[#0B1120] rounded-lg p-2 text-center border border-slate-800/60">
                <p className="text-base font-bold text-white">{uploadFile ? 1 : 0}</p>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Files</p>
              </div>
            </div>

            {/* Total Badge */}
            <div className="flex items-center justify-between bg-emerald-500/[0.08] border border-emerald-500/25 rounded-xl px-3.5 py-2.5">
              <span className="text-xs font-semibold text-emerald-400">Total Leads to Assign</span>
              <span className="text-lg font-black text-white">{totalSelected}</span>
            </div>
          </div>

          {/* Selected Numbers Preview */}
          {selectedLeadIds.length > 0 && (
            <div className="bg-[#111827] border border-slate-700/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Selected Numbers</span>
                <span className="text-[10px] text-slate-500">{selectedLeadIds.length} items</span>
              </div>
              <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
                {leads.filter((l) => selectedLeadIds.includes(l.id)).slice(0, 40).map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0B1120] border border-slate-800/60 text-[10px] font-mono text-slate-300">
                    {l.customer_phone || l.id}
                    <button type="button" onClick={() => setSelectedLeadIds((p) => p.filter((x) => x !== l.id))} className="text-slate-500 hover:text-rose-400 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {selectedLeadIds.length > 40 && <span className="text-[10px] text-slate-500 py-0.5">+{selectedLeadIds.length - 40} more</span>}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-[#111827] border border-slate-700/40 rounded-2xl p-4 space-y-2">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">Notes (Optional)</label>
            <textarea value={assignmentNotes} onChange={(e) => setAssignmentNotes(e.target.value)}
              placeholder="Add audit instructions or notes..."
              rows={2}
              className="w-full bg-[#0B1120] border border-slate-800/60 text-slate-200 text-xs rounded-lg p-2.5 outline-none focus:border-emerald-500/40 placeholder:text-slate-600 resize-none" />
          </div>

          {/* Dispatch Button */}
          <button onClick={handleSubmit} disabled={loading || !assignTo || (totalSelected === 0 && !uploadFile)}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-emerald-500/30 active:scale-[0.98]">
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /><span>Dispatching...</span></>
            ) : (
              <><Send className="w-4 h-4" /><span>Assign {totalSelected > 0 ? `${totalSelected} ` : ''}Leads</span></>
            )}
          </button>
        </div>

        {/* ── RIGHT: Lead Sourcing Workspace (Table / Manual / File) ── */}
        <div className="bg-[#111827] border border-slate-700/40 rounded-2xl overflow-hidden flex flex-col min-w-0">

          {/* Source Tabs + Filters */}
          <div className="px-4 py-3 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5">
              {[
                { key: 'pool', icon: Phone, label: 'Dialer Records', count: leads.length },
                { key: 'manual', icon: Layers, label: 'Manual Numbers', count: manualPhones.length },
                { key: 'file', icon: Upload, label: 'File Upload', count: uploadFile ? 1 : 0 },
              ].map((t) => (
                <button key={t.key} type="button" onClick={() => setSourceTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${sourceTab === t.key ? 'bg-[#111827] text-white shadow-sm border border-slate-700/60' : 'text-slate-400 hover:text-slate-200'}`}>
                  <t.icon className="w-3 h-3" />
                  <span>{t.label}</span>
                  {t.count > 0 && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sourceTab === t.key ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/60 text-slate-400'}`}>{t.count}</span>}
                </button>
              ))}
            </div>

            {/* Pool-specific toolbar */}
            {sourceTab === 'pool' && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..."
                    className="bg-slate-800/40 border border-slate-700/50 text-slate-200 pl-7 pr-3 py-1.5 rounded-lg text-[11px] outline-none focus:border-emerald-500/40 placeholder:text-slate-500 w-44" />
                </div>
                {distinctStatuses.length > 0 && (
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-800/40 border border-slate-700/50 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer">
                    <option value="ALL" className="bg-slate-900">All Statuses</option>
                    {distinctStatuses.map((d) => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* ── Tab: Dialer Records ──────────────────────────────── */}
          {sourceTab === 'pool' && (
            <div className="flex-1 flex flex-col">
              {/* Quick select bar */}
              <div className="px-4 py-2 bg-[#0D1424] border-b border-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-medium mr-1">Quick:</span>
                  {[10, 25, 50].map((n) => (
                    <button key={n} type="button" onClick={() => selectQty(n)}
                      className="px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/40 text-slate-300 text-[10px] font-medium hover:text-white hover:border-slate-600 transition-colors">
                      +{n}
                    </button>
                  ))}
                  <button type="button" onClick={toggleSelectAll}
                    className="px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/40 text-emerald-400 text-[10px] font-semibold hover:text-emerald-300 transition-colors">
                    All
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  {salesDate && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-mono font-medium">
                      Date: {salesDate}
                    </span>
                  )}
                  <span className="text-slate-400 font-medium">{displayedLeads.length} sales</span>
                  {selectedLeadIds.length > 0 && (
                    <button type="button" onClick={() => setSelectedLeadIds([])}
                      className="text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1">
                      <X className="w-3 h-3" /> Clear {selectedLeadIds.length}
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto" style={{ maxHeight: '520px' }}>
                {leadsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                    <p className="text-xs text-slate-400">Loading records...</p>
                  </div>
                ) : displayedLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-xs gap-2">
                    <Phone className="w-7 h-7 text-slate-600/70" />
                    <p className="text-slate-400 font-medium">No dialer records for {selectedCampaign || 'this campaign'}</p>
                    <p className="text-[11px] text-slate-500 max-w-xs text-center">
                      Dialer live sales integration is active for Medicare and Pharmacy. For other campaigns, use Manual Numbers or File Upload.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#0B1120] border-b border-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">
                          <button onClick={toggleSelectAll} className="text-slate-500 hover:text-emerald-400 transition-colors">
                            {displayedLeads.length > 0 && displayedLeads.every((l) => selectedLeadIds.includes(l.id))
                              ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                              : <Square className="w-3.5 h-3.5" />}
                          </button>
                        </th>
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Agent</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-center">Audio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {displayedLeads.map((lead) => {
                        const sel = selectedLeadIds.includes(lead.id);
                        return (
                          <tr key={lead.id} onClick={() => toggleLead(lead.id)}
                            className={`transition-colors cursor-pointer ${sel ? 'bg-emerald-500/[0.06]' : 'hover:bg-slate-800/20'}`}>
                            <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => toggleLead(lead.id)}>
                                {sel ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 transition-colors" />}
                              </button>
                            </td>
                            <td className="py-2 px-3"><span className="font-mono font-semibold text-emerald-400">{lead.id}</span></td>
                            <td className="py-2 px-3">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-700/60 text-slate-300 text-[10px] font-medium">{lead.disposition || '—'}</span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-slate-200">{lead.customer_phone || '—'}</span>
                                {lead.customer_phone && (
                                  <button type="button" onClick={(e) => copyPhone(lead.customer_phone, e)} className="text-slate-500 hover:text-white transition-colors p-0.5">
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-300">{lead.customer_name || <span className="text-slate-500 italic">Unknown</span>}</td>
                            <td className="py-2 px-3 text-slate-300">{lead.agent_name || 'Agent'}</td>
                            <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{lead.call_date ? lead.call_date.replace('T', ' ').slice(0, 16) : '—'}</td>
                            <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {lead.recording_url ? (
                                <button type="button" onClick={() => setAudioPreview({ url: lead.recording_url, phone: lead.customer_phone, agentName: lead.agent_name })}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-400 border border-slate-700/40 hover:border-emerald-500/30 transition-colors text-[10px]">
                                  <Play className="w-2.5 h-2.5" /> Play
                                </button>
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Manual Numbers ──────────────────────────────── */}
          {sourceTab === 'manual' && (
            <div className="p-6 flex-1">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">Manual Phone Entry</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Type numbers and press Enter, or paste directly from Excel.</p>
              </div>
              <PhoneTagInput phones={manualPhones} onChange={setManualPhones} />
            </div>
          )}

          {/* ── Tab: File Upload ─────────────────────────────────── */}
          {sourceTab === 'file' && (
            <div className="p-6 flex-1">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">Upload Lead Spreadsheet</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Upload CSV, XLSX, or TXT file to bulk assign.</p>
              </div>
              <div className="relative group">
                <input type="file" accept=".csv,.txt,.xlsx" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleFileUpload} />
                <div className={`flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl transition-all ${uploadFile ? 'border-emerald-500/60 bg-emerald-500/[0.04]' : 'border-slate-700/60 hover:border-emerald-500/40 bg-[#0B1120]'}`}>
                  {uploadFile ? (
                    <div className="flex items-center gap-3">
                      <FileText className="w-7 h-7 text-emerald-400" />
                      <div>
                        <p className="text-white font-semibold text-sm truncate max-w-[250px]">{uploadFile.name}</p>
                        <p className="text-emerald-400 text-[11px]">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB • Ready</p>
                      </div>
                      <button type="button" onClick={(e) => { e.preventDefault(); setUploadFile(null); }}
                        className="ml-4 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[11px] font-medium transition-all z-20 relative flex items-center gap-1">
                        <X className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-500 mb-2" />
                      <p className="text-white font-medium text-sm">Click or Drop File Here</p>
                      <p className="text-slate-500 text-[11px] mt-1">.CSV, .XLSX, or .TXT up to 250MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audio Modal */}
      {audioPreview && <AudioModal url={audioPreview.url} phone={audioPreview.phone} agentName={audioPreview.agentName} onClose={() => setAudioPreview(null)} />}
    </div>
  );
};

export default AssignLeadsPage;
