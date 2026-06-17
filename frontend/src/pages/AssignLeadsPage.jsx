import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Send, Search, Phone, X, CheckSquare, Square, Megaphone, User, Upload, ChevronDown } from 'lucide-react';

const AssignLeadsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [leads, setLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [search, setSearch] = useState('');
  const [phone, setPhone] = useState('');
  const [manualPhones, setManualPhones] = useState('');
  const [loading, setLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=campaign, 2=leads, 3=assign
  const [assignmentMode, setAssignmentMode] = useState('existing'); // 'existing' or 'manual'
  const [uploadFile, setUploadFile] = useState(null);

  // Load campaigns and available QA users
  useEffect(() => {
    Promise.all([
      api.get('/campaigns'),
      api.get('/teams/members/available'),
    ]).then(([cRes, uRes]) => {
      setCampaigns(cRes.data.data);
      setTeamMembers(uRes.data.data);
    }).catch(() => toast.error('Failed to load data.'));
  }, []);

  // Load leads when campaign selected
  useEffect(() => {
    let isMounted = true;
    const fetchLeads = async () => {
      if (!selectedCampaign) return;
      setLeadsLoading(true);
      try {
        const params = { campaign_name: selectedCampaign, limit: 100, search, phone };
        const res = await api.get('/calls', { params });
        if (isMounted) setLeads(res.data.data || []);
      } catch {
        if (isMounted) toast.error('Failed to load leads.');
      } finally {
        if (isMounted) setLeadsLoading(false);
      }
    };
    fetchLeads();
    return () => { isMounted = false; };
  }, [selectedCampaign, search, phone]);

  const toggleLead = (id) => {
    setSelectedLeads(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedLeads.length === leads.length) setSelectedLeads([]);
    else setSelectedLeads(leads.map(l => l.id));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 250 * 1024 * 1024) {
      return toast.error('File size exceeds 250MB limit.');
    }

    setUploadFile(file);
    toast.success(`File "${file.name}" selected. Please assign a team member next.`);
    setManualPhones(''); // clear manual entry if file is selected
    e.target.value = ''; // reset input
  };

  const handleAssign = async () => {
    const manualList = manualPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);

    if (assignmentMode === 'existing' && !selectedLeads.length) return toast.error('Select at least one lead.');
    if (assignmentMode === 'manual' && !uploadFile && !manualList.length) return toast.error('Enter at least one phone number or upload a file.');
    if (!assignTo) return toast.error('Select a team member to assign to.');

    setLoading(true);
    try {
      if (assignmentMode === 'manual' && uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('assigned_to', assignTo);
        formData.append('campaign_name', selectedCampaign);
        const res = await api.post('/assignments/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(res.data.message || 'Leads assigned successfully!');
      } else {
        const res = await api.post('/assignments', {
          call_lead_ids: assignmentMode === 'existing' ? selectedLeads : [],
          manual_leads: assignmentMode === 'manual' ? manualList : [],
          assigned_to: assignTo,
          campaign_name: selectedCampaign,
        });
        toast.success(res.data.message || 'Leads assigned successfully!');
      }
      setSelectedLeads([]);
      setManualPhones('');
      setUploadFile(null);
      setStep(1);
      setSelectedCampaign('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign leads.');
    } finally { setLoading(false); }
  };

  const assignedToUser = teamMembers.find(m => String(m.id) === String(assignTo));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assign Leads</h1>
          <p className="page-subtitle">Select a campaign, pick leads, then assign to a team member</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0 mb-6">
        {[
          { n: 1, label: 'Select Campaign' },
          { n: 2, label: 'Select Leads' },
          { n: 3, label: 'Assign Member' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer flex-1 justify-center border
              ${step === s.n
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : step > s.n
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'border-slate-800 text-slate-500 bg-slate-900/50'}`}
              onClick={() => step > s.n && setStep(s.n)}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border font-bold
                ${step === s.n ? 'bg-emerald-500 border-emerald-400 text-slate-950' : step > s.n ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-700 text-slate-500'}`}>
                {step > s.n ? '✓' : s.n}
              </span>
              <span className="hidden sm:block">{s.label}</span>
            </div>
            {i < 2 && <div className={`h-[2px] flex-shrink-0 w-6 ${step > s.n ? 'bg-emerald-500' : 'bg-slate-800'}`} />}
          </div>
        ))}
      </div>

      {/* ─ STEP 1: Campaign ───────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card p-8 max-w-2xl mx-auto mt-4">
          <div className="flex items-center gap-5 mb-8 pb-6 border-b border-slate-800/60">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Megaphone className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white tracking-tight">Select Campaign</p>
              <p className="text-sm text-slate-400 mt-1">Choose the campaign for this assignment workflow</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Campaign Name *</label>
              <div className="relative group">
                <select 
                  className="w-full appearance-none bg-slate-900/80 border border-slate-700 text-white px-5 py-4 rounded-xl outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer font-semibold shadow-inner hover:border-slate-600"
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                >
                  <option value="" disabled className="text-slate-500">— Choose Campaign —</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.name} className="bg-slate-900 text-white py-2">{c.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none">
                  <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-300 transition-colors" />
                </div>
              </div>
            </div>
            
            {campaigns.length === 0 && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                <p className="text-rose-400 text-sm font-semibold">No campaigns available. Please create one first.</p>
              </div>
            )}

            <div className="pt-4">
              <button 
                onClick={() => { setStep(2); setSelectedLeads([]); }}
                disabled={!selectedCampaign}
                className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 text-slate-950 rounded-xl font-bold transition-all shadow-lg hover:bg-emerald-400 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Proceed to Select Leads →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─ STEP 2: Leads ──────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <Megaphone className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-400">{selectedCampaign}</span>
                <button onClick={() => { setStep(1); setSelectedCampaign(''); setLeads([]); }} className="text-slate-400 hover:text-white ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Assignment Mode Tabs */}
            <div className="flex border-b border-slate-800 mb-6">
              <button
                className={`pb-3 px-4 text-sm font-semibold transition-colors border-b-2 ${assignmentMode === 'existing' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                onClick={() => setAssignmentMode('existing')}
              >
                Select Uploaded Leads
              </button>
              <button
                className={`pb-3 px-4 text-sm font-semibold transition-colors border-b-2 ${assignmentMode === 'manual' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                onClick={() => setAssignmentMode('manual')}
              >
                Manual Entry / File Upload
              </button>
            </div>

            {assignmentMode === 'manual' ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <label className="label mb-0">Enter Phone Numbers or Upload</label>
                  <div>
                    <label className="btn-secondary text-xs px-3 py-1.5 cursor-pointer flex items-center gap-2">
                      <Upload size={14} /> {uploadFile ? 'Change File' : 'Load from CSV/TXT'}
                      <input 
                        type="file" 
                        accept=".csv,.txt" 
                        className="hidden" 
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
                {uploadFile ? (
                  <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center">
                        <Upload className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{uploadFile.name}</p>
                        <p className="text-slate-400 text-xs">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setUploadFile(null)}
                      className="text-slate-500 hover:text-rose-400 p-2"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <textarea
                    className="input min-h-[200px] resize-y"
                    placeholder="Enter phone numbers separated by commas or newlines...&#10;Example:&#10;555-0101&#10;555-0102"
                    value={manualPhones}
                    onChange={e => setManualPhones(e.target.value)}
                  />
                )}
                <div className="flex justify-end pt-2">
                  <button 
                    onClick={() => setStep(3)} 
                    className="btn-primary"
                    disabled={!uploadFile && !manualPhones.trim()}
                  >
                    Next: Assign →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input className="input pl-9" placeholder="Search agent, customer..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <div className="relative min-w-[200px]">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input className="input pl-9" placeholder="Phone number..." value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  {selectedLeads.length > 0 && (
                    <button onClick={() => setStep(3)} className="btn-primary py-2.5">
                      Next: Assign ({selectedLeads.length} selected) →
                    </button>
                  )}
                </div>

                {/* Leads Table */}
                <div className="overflow-hidden border border-slate-800 rounded-xl">
                  {leadsLoading ? (
                    <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading leads...</div>
                  ) : leads.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No leads found for this campaign.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead className="thead">
                          <tr>
                            <th className="th w-12 text-center">
                              <button onClick={toggleAll} className="text-slate-400 hover:text-emerald-400">
                                {selectedLeads.length === leads.length ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                              </button>
                            </th>
                            <th className="th">Agent</th>
                            <th className="th">Phone</th>
                            <th className="th">Disposition</th>
                            <th className="th">Date</th>
                            <th className="th">Recording</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {leads.map(lead => {
                            const sel = selectedLeads.includes(lead.id);
                            return (
                              <tr key={lead.id} className={`tr cursor-pointer transition-colors ${sel ? 'bg-emerald-500/10' : 'hover:bg-slate-800/50'}`} onClick={() => toggleLead(lead.id)}>
                                <td className="td text-center">
                                  {sel ? <CheckSquare className="w-5 h-5 text-emerald-500 mx-auto" /> : <Square className="w-5 h-5 text-slate-600 mx-auto" />}
                                </td>
                                <td className="td">
                                  <p className="text-sm font-semibold text-white">{lead.agent_name}</p>
                                  <p className="text-xs text-slate-500">{lead.agent_id}</p>
                                </td>
                                <td className="td font-mono text-sm text-slate-300">{lead.customer_phone}</td>
                                <td className="td">
                                  {lead.disposition ? <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs border border-slate-700">{lead.disposition}</span> : <span className="text-slate-600 text-xs">—</span>}
                                </td>
                                <td className="td text-sm text-slate-400">{lead.call_date ? lead.call_date.split('T')[0] : '—'}</td>
                                <td className="td">
                                  {lead.recording_url
                                    ? <span className="text-xs text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20">✓ Has Audio</span>
                                    : <span className="text-xs text-slate-500">No Audio</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─ STEP 3: Assign ─────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <User className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Assign to Team Member</p>
              <p className="text-sm text-slate-400">{selectedLeads.length} lead(s) selected from <span className="text-emerald-400">{selectedCampaign}</span></p>
            </div>
          </div>

          <div className="mb-5">
            <label className="label">Select Team Member *</label>
            <select className="input" value={assignTo} onChange={e => setAssignTo(e.target.value)}>
              <option value="">— Choose a QA evaluator —</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.role}) — {m.email}</option>
              ))}
            </select>
          </div>

            {assignedToUser && (
            <div className="mb-6 p-5 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Assignment Summary</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Assigned To</p>
                  <p className="text-base font-semibold text-white">{assignedToUser.name}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">{assignedToUser.role}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Campaign</p>
                  <p className="text-base font-semibold text-white">{selectedCampaign}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Leads Count</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {assignmentMode === 'existing' ? selectedLeads.length : uploadFile ? 'From File' : manualPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean).length}
                    <span className="text-sm text-slate-500 font-medium ml-2">({assignmentMode === 'existing' ? 'Uploaded' : uploadFile ? 'Bulk Upload' : 'Manual'})</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={() => setStep(2)} className="btn-secondary px-6">← Back to Leads</button>
            <button
              onClick={handleAssign}
              disabled={loading || !assignTo}
              className="btn-primary flex-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Assigning...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send size={18} /> 
                  Assign {assignmentMode === 'existing' ? selectedLeads.length : uploadFile ? 'Leads File' : manualPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean).length + ' Lead(s)'}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignLeadsPage;
