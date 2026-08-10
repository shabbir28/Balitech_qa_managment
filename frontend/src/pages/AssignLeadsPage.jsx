import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Send, Search, Phone, CheckSquare, Square, Upload, FileText, ChevronDown, CheckCircle2, UserCheck, Target } from 'lucide-react';

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
      if (!selectedCampaign) {
        setLeads([]);
        return;
      }
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
    toast.success(`File "${file.name}" selected.`);
    setManualPhones('');
    e.target.value = '';
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign leads.');
    } finally { setLoading(false); }
  };

  const assignedToUser = teamMembers.find(m => String(m.id) === String(assignTo));

  const selectedCount = useMemo(() => {
    if (assignmentMode === 'existing') return selectedLeads.length;
    if (uploadFile) return 'Bulk File';
    return manualPhones.split(/[\n,]+/).filter(p => p.trim()).length;
  }, [assignmentMode, selectedLeads.length, uploadFile, manualPhones]);

  const filteredTeamMembers = useMemo(() => {
    if (!selectedCampaign) return [];
    return teamMembers.filter(m => m.campaign_name === selectedCampaign);
  }, [teamMembers, selectedCampaign]);

  const isAssignDisabled = loading || !assignTo || (assignmentMode === 'existing' && selectedLeads.length === 0) || (assignmentMode === 'manual' && !uploadFile && !manualPhones.trim());

  // Reset selected assignee if the campaign changes and the selected user doesn't belong to the new campaign
  useEffect(() => {
    if (assignTo && !filteredTeamMembers.find(m => String(m.id) === String(assignTo))) {
      setAssignTo('');
    }
  }, [selectedCampaign, filteredTeamMembers, assignTo]);

  return (
    <div className="h-[calc(100vh-2rem)] flex gap-6 pb-4 w-full font-sans">
      
      {/* LEFT PANE: CONFIGURATION & ACTIONS */}
      <div className="w-[340px] flex flex-col gap-5 shrink-0 h-full">
        
        {/* Header Title */}
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tight font-display">
            Assign Leads
          </h1>
          <p className="text-slate-400 mt-1 text-xs font-medium">Distribute workloads to your QA team.</p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex flex-col gap-6 shadow-xl relative overflow-hidden flex-1">
          {/* Subtle Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Step 1: Campaign */}
          <div>
            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Target size={12} /> Target Campaign
            </label>
            <div className="relative group">
              <select 
                className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 py-3 pl-4 pr-10 rounded-xl outline-none appearance-none cursor-pointer text-sm font-semibold focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all hover:bg-slate-950/80"
                value={selectedCampaign}
                onChange={(e) => {
                  setSelectedCampaign(e.target.value);
                  setSelectedLeads([]);
                }}
              >
                <option value="" disabled className="text-slate-500">— Select Campaign —</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-indigo-400 transition-colors" />
            </div>
          </div>

          {/* Step 2: Evaluator */}
          <div>
            <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <UserCheck size={12} /> Target Evaluator
            </label>
            <div className="relative group">
              <select 
                className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 py-3 pl-4 pr-10 rounded-xl outline-none appearance-none cursor-pointer text-sm font-semibold focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all hover:bg-slate-950/80"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
              >
                <option value="" disabled className="text-slate-500">— Select Evaluator —</option>
                {filteredTeamMembers.length === 0 && selectedCampaign && (
                   <option value="" disabled className="text-rose-400">No evaluators for this campaign</option>
                )}
                {filteredTeamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-emerald-400 transition-colors" />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

          {/* Step 3: Assignment Mode */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">
              Data Source
            </label>
            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setAssignmentMode('existing')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  assignmentMode === 'existing' 
                    ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' 
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <FileText size={14} /> System
              </button>
              <button
                onClick={() => setAssignmentMode('manual')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  assignmentMode === 'manual' 
                    ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' 
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Upload size={14} /> Manual
              </button>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Assignment Summary Box */}
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
             <div className="flex items-center justify-between mb-3">
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Leads Selected</span>
               <span className="text-xl font-black text-white font-display">{selectedCount === 0 ? '—' : selectedCount}</span>
             </div>
             <div className="flex items-center justify-between">
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assigned To</span>
               <span className="text-[13px] font-bold text-indigo-300">{assignedToUser ? assignedToUser.name : '—'}</span>
             </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleAssign}
            disabled={isAssignDisabled}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[13px] font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:bg-slate-800 disabled:text-slate-500 flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Assign Leads
              </>
            )}
          </button>
        </div>
      </div>

      {/* RIGHT PANE: DATA VIEW */}
      <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl overflow-hidden relative">
        
        {assignmentMode === 'existing' ? (
          <>
            {/* Table Header / Filters */}
            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-slate-950/30">
              <div className="flex-1 max-w-sm relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 pl-10 pr-4 py-2 rounded-xl outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-[13px] placeholder:text-slate-600 font-medium" 
                  placeholder="Search agent name..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
              <div className="flex-1 max-w-sm relative group">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 pl-10 pr-4 py-2 rounded-xl outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-[13px] placeholder:text-slate-600 font-medium" 
                  placeholder="Filter by phone..." 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
              {!selectedCampaign ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-20 h-20 rounded-2xl bg-indigo-500/5 flex items-center justify-center mb-5 border border-indigo-500/10">
                    <Target className="w-8 h-8 text-indigo-400/50" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Select a Campaign</h3>
                  <p className="text-slate-500 text-[13px]">Choose a campaign from the left panel to view available leads.</p>
                </div>
              ) : leadsLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : leads.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <FileText className="w-12 h-12 text-slate-700" />
                  <p className="text-[13px] font-medium">No system records found for "{selectedCampaign}"</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md z-20 border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 w-14 text-center">
                        <button onClick={toggleAll} className="text-slate-500 hover:text-indigo-400 transition-colors inline-flex mt-0.5">
                          {selectedLeads.length === leads.length && leads.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      <th className="py-3.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent</th>
                      <th className="py-3.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Phone</th>
                      <th className="py-3.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disposition</th>
                      <th className="py-3.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                      <th className="py-3.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {leads.map(lead => {
                      const sel = selectedLeads.includes(lead.id);
                      return (
                        <tr key={lead.id} className={`transition-all group cursor-pointer ${sel ? 'bg-indigo-500/5' : 'hover:bg-slate-800/30'}`} onClick={() => toggleLead(lead.id)}>
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center mt-0.5">
                              {sel ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-300 border border-slate-700">
                                {lead.agent_name?.charAt(0).toUpperCase() || 'A'}
                              </div>
                              <div>
                                <p className="text-[13px] font-semibold text-slate-200 group-hover:text-white transition-colors">{lead.agent_name}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{lead.agent_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[13px] font-medium text-slate-300">{lead.customer_phone}</td>
                          <td className="py-3 px-4">
                            {lead.disposition ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">{lead.disposition}</span> : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-4 text-[13px] text-slate-400 font-medium">{lead.call_date ? lead.call_date.split('T')[0] : '—'}</td>
                          <td className="py-3 px-4">
                            {lead.recording_url
                              ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider"><CheckCircle2 className="w-3.5 h-3.5"/> Ready</span>
                              : <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">Missing</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          /* MANUAL / UPLOAD MODE */
          <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
             <div className="w-full max-w-2xl">
               <div className="text-center mb-8">
                 <h2 className="text-2xl font-bold text-white tracking-wide font-display">Bulk Import</h2>
                 <p className="text-slate-400 text-sm mt-2 font-medium">Upload a CSV/XLSX file or paste raw phone numbers.</p>
               </div>
               
               <div className="flex flex-col gap-6">
                 {/* Upload Zone */}
                 <div className="relative group">
                    <input 
                      type="file" 
                      accept=".csv,.txt,.xlsx" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      onChange={handleFileUpload}
                    />
                    <div className={`h-[140px] flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all duration-300 ${uploadFile ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'border-slate-700 bg-slate-900/50 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5'}`}>
                      {uploadFile ? (
                        <div className="flex items-center justify-between w-full px-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                              <FileText className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div className="text-left">
                              <p className="text-white font-bold text-sm truncate max-w-[250px]">{uploadFile.name}</p>
                              <p className="text-indigo-400 text-xs font-medium">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.preventDefault(); setUploadFile(null); }}
                            className="px-4 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold border border-rose-500/20 transition-all z-20 relative uppercase tracking-wider"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-3 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors border border-slate-700 group-hover:border-indigo-500/30 shadow-lg">
                            <Upload className="w-5 h-5" />
                          </div>
                          <p className="text-white font-bold text-[13px] mb-1">Click to Upload File</p>
                          <p className="text-slate-500 text-[11px]">CSV, TXT or XLSX supported</p>
                        </>
                      )}
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                   <div className="h-px flex-1 bg-slate-800" />
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OR</span>
                   <div className="h-px flex-1 bg-slate-800" />
                 </div>

                 {/* Textarea */}
                 <div className={`transition-all duration-300 ${uploadFile ? 'opacity-30 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        Raw Input
                      </label>
                      <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                        {manualPhones.split(/[\n,]+/).filter(p => p.trim()).length} parsed
                      </span>
                    </div>
                    <textarea
                      className="w-full h-[180px] bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none font-mono text-[13px] leading-relaxed shadow-inner"
                      placeholder="Paste phone numbers...&#10;&#10;555-0101&#10;555-0102"
                      value={manualPhones}
                      onChange={e => setManualPhones(e.target.value)}
                    />
                 </div>
               </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AssignLeadsPage;
