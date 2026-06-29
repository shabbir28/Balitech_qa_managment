import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Send, Search, Phone, CheckSquare, Square, Upload, LayoutGrid, FileText, ChevronDown, CheckCircle2, UserCheck, Target } from 'lucide-react';

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

  const isAssignDisabled = loading || !assignTo || (assignmentMode === 'existing' && selectedLeads.length === 0) || (assignmentMode === 'manual' && !uploadFile && !manualPhones.trim());

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col pb-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 mt-2">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 tracking-tight flex items-center gap-2.5">
            <LayoutGrid className="w-6 h-6 text-indigo-500" /> 
            Assignment Center
          </h1>
          <p className="text-slate-400 mt-1 text-xs font-medium">Distribute workloads directly to QA Evaluators with precision.</p>
        </div>
      </div>

      {/* COMMAND BAR: TOP CONFIGURATION */}
      <div className="bg-[#0B1120]/80 backdrop-blur-xl border border-white/5 rounded-xl p-2.5 mb-5 shadow-2xl flex flex-col md:flex-row gap-2.5 relative z-20">
        
        {/* Campaign Selection */}
        <div className="flex-1 relative group bg-white/[0.02] rounded-lg hover:bg-white/[0.04] border border-white/[0.02] transition-all">
          <div className="absolute top-2 left-3 pointer-events-none">
            <label className="text-[8px] font-bold text-indigo-400/80 uppercase tracking-widest flex items-center gap-1">
              <Target size={8} /> Target Campaign
            </label>
          </div>
          <select 
            className="w-full bg-transparent text-white pt-6 pb-2 px-3 outline-none appearance-none cursor-pointer font-semibold text-sm"
            value={selectedCampaign}
            onChange={(e) => {
              setSelectedCampaign(e.target.value);
              setSelectedLeads([]);
            }}
          >
            <option value="" disabled className="text-slate-500 bg-slate-900">— Select Campaign —</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.name} className="bg-slate-900 text-white">{c.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        {/* Assignee Selection */}
        <div className="flex-1 relative group bg-white/[0.02] rounded-lg hover:bg-white/[0.04] border border-white/[0.02] transition-all">
          <div className="absolute top-2 left-3 pointer-events-none">
            <label className="text-[8px] font-bold text-emerald-400/80 uppercase tracking-widest flex items-center gap-1">
              <UserCheck size={8} /> QA Evaluator
            </label>
          </div>
          <select 
            className="w-full bg-transparent text-white pt-6 pb-2 px-3 outline-none appearance-none cursor-pointer font-semibold text-sm"
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
          >
            <option value="" disabled className="text-slate-500 bg-slate-900">— Select Evaluator —</option>
            {teamMembers.map(m => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-white">{m.name} ({m.role})</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#060913] border border-white/5 rounded-2xl shadow-2xl">
        {/* Header Bar */}
        <div className="border-b border-white/5 bg-white/[0.02] p-3 flex flex-col lg:flex-row justify-between items-center gap-3 z-10">
          
          {/* Pill Tabs */}
          <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 w-full lg:w-auto">
            <button
              onClick={() => setAssignmentMode('existing')}
              className={`flex-1 lg:flex-none px-5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                assignmentMode === 'existing' 
                  ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' 
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <FileText size={14} /> System Records
            </button>
            <button
              onClick={() => setAssignmentMode('manual')}
              className={`flex-1 lg:flex-none px-5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                assignmentMode === 'manual' 
                  ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' 
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Upload size={14} /> Manual / Upload
            </button>
          </div>

          {/* Quick Filters (Only show for existing records) */}
          {assignmentMode === 'existing' && (
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-56 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  className="w-full bg-black/40 border border-white/5 text-white pl-9 pr-3 py-1.5 rounded-md outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-xs placeholder:text-slate-600" 
                  placeholder="Search agent..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
              <div className="relative flex-1 lg:w-40 group">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  className="w-full bg-black/40 border border-white/5 text-white pl-9 pr-3 py-1.5 rounded-md outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-xs placeholder:text-slate-600" 
                  placeholder="Phone number..." 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-transparent relative">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none mix-blend-overlay"></div>
          
          {!selectedCampaign && assignmentMode === 'existing' ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-indigo-500/5 flex items-center justify-center mb-5 border border-indigo-500/10 shadow-[0_0_50px_rgba(99,102,241,0.05)]">
                <Target className="w-8 h-8 text-indigo-400/50" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1.5 tracking-wide">No Campaign Selected</h3>
              <p className="text-slate-500 max-w-sm mx-auto text-xs">Please select a target campaign from the configuration bar above to load records.</p>
            </div>
          ) : assignmentMode === 'existing' ? (
            <div className="h-full flex flex-col relative z-10">
              {leadsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : leads.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <FileText className="w-10 h-10 text-slate-700/50" />
                  <p className="text-xs font-medium">No records found for "{selectedCampaign}"</p>
                </div>
              ) : (
                <table className="w-full relative text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-[#0B1120]/95 backdrop-blur-md z-20">
                    <tr>
                      <th className="py-3 px-3 border-b border-white/5 w-12 text-center">
                        <button onClick={toggleAll} className="text-slate-500 hover:text-indigo-400 transition-colors inline-flex mt-0.5">
                          {selectedLeads.length === leads.length && leads.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      <th className="py-3 px-3 border-b border-white/5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Agent Details</th>
                      <th className="py-3 px-3 border-b border-white/5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Customer Phone</th>
                      <th className="py-3 px-3 border-b border-white/5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Disposition</th>
                      <th className="py-3 px-3 border-b border-white/5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Call Date</th>
                      <th className="py-3 px-3 border-b border-white/5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {leads.map(lead => {
                      const sel = selectedLeads.includes(lead.id);
                      return (
                        <tr key={lead.id} className={`transition-all group cursor-pointer ${sel ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'}`} onClick={() => toggleLead(lead.id)}>
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center mt-0.5">
                              {sel ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-slate-700 group-hover:text-slate-500 transition-colors" />}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-300 border border-white/10 shadow-inner">
                                {lead.agent_name?.charAt(0).toUpperCase() || 'A'}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-white group-hover:text-indigo-200 transition-colors">{lead.agent_name}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{lead.agent_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs font-medium text-slate-300">{lead.customer_phone}</td>
                          <td className="py-3 px-3">
                            {lead.disposition ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-white/5 text-slate-300 border border-white/10">{lead.disposition}</span> : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-400">{lead.call_date ? lead.call_date.split('T')[0] : '—'}</td>
                          <td className="py-3 px-3">
                            {lead.recording_url
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider"><CheckCircle2 className="w-3 h-3"/> Ready</span>
                              : <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/5 text-rose-400/70 border border-rose-500/10 uppercase tracking-wider">Missing</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-4 relative z-10 overflow-y-auto">
              <div className="max-w-3xl w-full">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white tracking-wide">Bulk Data Import</h2>
                  <p className="text-slate-400 text-xs mt-1.5 font-medium">Upload a CSV/TXT data file or paste raw entries directly.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* File Upload Zone */}
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".csv,.txt" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      onChange={handleFileUpload}
                    />
                    <div className={`h-[200px] flex flex-col items-center justify-center p-6 border border-dashed rounded-2xl transition-all duration-300 ${uploadFile ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_40px_rgba(99,102,241,0.15)]' : 'border-slate-700 bg-black/20 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5'}`}>
                      {uploadFile ? (
                        <>
                          <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-3 border border-indigo-500/30">
                            <FileText className="w-6 h-6 text-indigo-400" />
                          </div>
                          <p className="text-white font-bold text-sm mb-1 text-center truncate max-w-[200px]">{uploadFile.name}</p>
                          <p className="text-indigo-400 text-xs font-medium">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          <button 
                            onClick={(e) => { e.preventDefault(); setUploadFile(null); }}
                            className="mt-4 px-3 py-1.5 rounded-md bg-white/5 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 text-[10px] font-bold border border-white/5 hover:border-rose-500/30 transition-all z-20 relative uppercase tracking-wider"
                          >
                            Remove File
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-slate-800/50 rounded-xl flex items-center justify-center mb-3 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors border border-white/5 group-hover:border-indigo-500/30 shadow-lg">
                            <Upload className="w-6 h-6" />
                          </div>
                          <p className="text-white font-bold text-sm mb-1 tracking-wide">Upload CSV or TXT</p>
                          <p className="text-slate-500 text-xs text-center">Drag and drop or click to browse</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Text Area */}
                  <div className={`transition-all duration-300 ${uploadFile ? 'opacity-30 pointer-events-none scale-95' : 'scale-100'}`}>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                      Manual Input Mode
                      <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm">{manualPhones.split(/[\n,]+/).filter(p => p.trim()).length} parsed</span>
                    </label>
                    <textarea
                      className="w-full h-[200px] bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none font-mono text-xs leading-relaxed shadow-inner"
                      placeholder="Paste raw phone numbers here...&#10;&#10;555-0101&#10;555-0102"
                      value={manualPhones}
                      onChange={e => setManualPhones(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR (Sticky & Glassmorphic) */}
        <div className="bg-[#0B1120]/80 backdrop-blur-2xl border-t border-white/5 p-3 md:px-5 flex flex-col sm:flex-row justify-between items-center gap-3 z-20">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5 flex items-center gap-1.5"><CheckSquare size={10}/> Selected Records</p>
              <p className="text-lg font-black text-white">{selectedCount === 0 ? '—' : selectedCount}</p>
            </div>
            {assignedToUser && (
               <div className="hidden md:block w-px h-8 bg-white/10"></div>
            )}
            {assignedToUser && (
               <div>
                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5 flex items-center gap-1.5"><UserCheck size={10}/> Target Evaluator</p>
                 <div className="flex items-center gap-2 mt-1">
                   <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                     {assignedToUser.name.charAt(0).toUpperCase()}
                   </div>
                   <p className="text-xs font-bold text-white">{assignedToUser.name}</p>
                 </div>
               </div>
            )}
          </div>

          <button
            onClick={handleAssign}
            disabled={isAssignDisabled}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:bg-slate-800 disabled:text-slate-500 flex items-center justify-center gap-2 tracking-wide"
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
    </div>
  );
};

export default AssignLeadsPage;
