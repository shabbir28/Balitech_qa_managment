import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Send, Search, Phone, CheckSquare, Square, Upload, LayoutGrid, FileText, ChevronDown, CheckCircle2, UserCheck, Inbox } from 'lucide-react';

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
    <div className="h-[calc(100vh-6rem)] flex flex-col pb-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <LayoutGrid className="w-8 h-8 text-indigo-500" /> Assignment Center
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-medium">Distribute workloads directly to QA Evaluators with precision.</p>
        </div>
      </div>

      {/* COMMAND BAR: TOP CONFIGURATION */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-2 mb-6 shadow-xl flex flex-col md:flex-row gap-2 relative z-20">
        
        {/* Campaign Selection */}
        <div className="flex-1 relative group bg-slate-950/50 rounded-xl hover:bg-slate-900 transition-colors">
          <div className="absolute top-2 left-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">1. Target Campaign</label>
          </div>
          <select 
            className="w-full bg-transparent text-white pt-7 pb-2 px-4 outline-none appearance-none cursor-pointer font-bold text-lg"
            value={selectedCampaign}
            onChange={(e) => {
              setSelectedCampaign(e.target.value);
              setSelectedLeads([]);
            }}
          >
            <option value="" disabled className="text-slate-500">— Select Campaign —</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.name} className="bg-slate-900 text-white">{c.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
            <ChevronDown className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        <div className="w-px bg-slate-800 hidden md:block my-2"></div>

        {/* Assignee Selection */}
        <div className="flex-1 relative group bg-slate-950/50 rounded-xl hover:bg-slate-900 transition-colors">
          <div className="absolute top-2 left-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">2. QA Evaluator</label>
          </div>
          <select 
            className="w-full bg-transparent text-white pt-7 pb-2 px-4 outline-none appearance-none cursor-pointer font-bold text-lg"
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
          >
            <option value="" disabled className="text-slate-500">— Select Evaluator —</option>
            {teamMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
            <UserCheck className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="card flex-1 flex flex-col overflow-hidden relative border-slate-800 shadow-2xl">
        {/* Header Bar */}
        <div className="border-b border-slate-800/80 bg-slate-900/40 p-3 flex flex-col lg:flex-row justify-between items-center gap-4 z-10">
          
          {/* Pill Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 w-full lg:w-auto">
            <button
              onClick={() => setAssignmentMode('existing')}
              className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                assignmentMode === 'existing' 
                  ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              System Records
            </button>
            <button
              onClick={() => setAssignmentMode('manual')}
              className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                assignmentMode === 'manual' 
                  ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Manual / File Upload
            </button>
          </div>

          {/* Quick Filters (Only show for existing records) */}
          {assignmentMode === 'existing' && (
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  className="w-full bg-slate-950/50 border border-slate-800 text-white pl-9 pr-4 py-2 rounded-lg outline-none focus:border-indigo-500/50 transition-colors text-sm" 
                  placeholder="Search agent..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
              <div className="relative flex-1 lg:w-48">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  className="w-full bg-slate-950/50 border border-slate-800 text-white pl-9 pr-4 py-2 rounded-lg outline-none focus:border-indigo-500/50 transition-colors text-sm" 
                  placeholder="Phone..." 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-950/30">
          {!selectedCampaign && assignmentMode === 'existing' ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 border-4 border-slate-950 shadow-inner">
                <Inbox className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Campaign Selected</h3>
              <p className="text-slate-500 max-w-sm mx-auto text-sm">Select a target campaign from the top bar to view available records.</p>
            </div>
          ) : assignmentMode === 'existing' ? (
            <div className="h-full flex flex-col">
              {leadsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : leads.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <FileText className="w-12 h-12 text-slate-700" />
                  <p className="text-sm font-medium">No records found for "{selectedCampaign}"</p>
                </div>
              ) : (
                <table className="table w-full relative">
                  <thead className="thead sticky top-0 bg-slate-900 z-10 shadow-md">
                    <tr>
                      <th className="th w-14 text-center">
                        <button onClick={toggleAll} className="text-slate-400 hover:text-indigo-400 p-1 rounded hover:bg-slate-800 transition-colors">
                          {selectedLeads.length === leads.length && leads.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-500" /> : <Square className="w-5 h-5" />}
                        </button>
                      </th>
                      <th className="th">Agent Details</th>
                      <th className="th">Customer Phone</th>
                      <th className="th">Disposition</th>
                      <th className="th">Call Date</th>
                      <th className="th">Audio Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {leads.map(lead => {
                      const sel = selectedLeads.includes(lead.id);
                      return (
                        <tr key={lead.id} className={`tr cursor-pointer transition-all ${sel ? 'bg-indigo-500/5' : 'hover:bg-slate-800/30'}`} onClick={() => toggleLead(lead.id)}>
                          <td className="td text-center">
                            <div className="flex justify-center">
                              {sel ? <CheckSquare className="w-5 h-5 text-indigo-500" /> : <Square className="w-5 h-5 text-slate-600 group-hover:text-slate-400" />}
                            </div>
                          </td>
                          <td className="td">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700">
                                {lead.agent_name?.charAt(0).toUpperCase() || 'A'}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{lead.agent_name}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lead.agent_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="td font-mono text-sm font-medium text-slate-300">{lead.customer_phone}</td>
                          <td className="td">
                            {lead.disposition ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">{lead.disposition}</span> : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="td text-sm text-slate-400">{lead.call_date ? lead.call_date.split('T')[0] : '—'}</td>
                          <td className="td">
                            {lead.recording_url
                              ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider"><CheckCircle2 className="w-3 h-3"/> Ready</span>
                              : <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700 uppercase tracking-wider">Missing</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <div className="max-w-2xl w-full">
                <div className="text-center mb-10">
                  <h2 className="text-2xl font-black text-white">Bulk Import Leads</h2>
                  <p className="text-slate-400 text-sm mt-2">Upload a data file or paste raw entries directly.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* File Upload Zone */}
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".csv,.txt" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      onChange={handleFileUpload}
                    />
                    <div className={`h-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all ${uploadFile ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'border-slate-700 bg-slate-900/50 group-hover:border-indigo-500/50 group-hover:bg-slate-900'}`}>
                      {uploadFile ? (
                        <>
                          <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/30">
                            <FileText className="w-8 h-8 text-indigo-400" />
                          </div>
                          <p className="text-white font-bold text-lg mb-1 text-center">{uploadFile.name}</p>
                          <p className="text-indigo-400 text-sm font-medium">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          <button 
                            onClick={(e) => { e.preventDefault(); setUploadFile(null); }}
                            className="mt-6 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-bold border border-slate-700 hover:border-rose-500/50 transition-colors z-20 relative uppercase tracking-wider"
                          >
                            Remove File
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors border border-slate-700 group-hover:border-indigo-500/30">
                            <Upload className="w-8 h-8" />
                          </div>
                          <p className="text-white font-bold text-base mb-1">Upload CSV or TXT</p>
                          <p className="text-slate-500 text-sm text-center">Drag and drop or click to browse</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Text Area */}
                  <div className={`transition-all ${uploadFile ? 'opacity-30 pointer-events-none' : ''}`}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block flex items-center justify-between">
                      Manual Input
                      <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{manualPhones.split(/[\n,]+/).filter(p => p.trim()).length} parsed</span>
                    </label>
                    <textarea
                      className="w-full h-[250px] bg-slate-900 border border-slate-700 rounded-2xl p-5 text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none font-mono text-sm leading-relaxed"
                      placeholder="Paste phone numbers here...&#10;&#10;555-0101&#10;555-0102"
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
        <div className="bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 p-4 md:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 z-20 sticky bottom-0">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Selected Leads</p>
              <p className="text-2xl font-black text-white">{selectedCount === 0 ? '—' : selectedCount}</p>
            </div>
            {assignedToUser && (
               <div className="hidden md:block w-px h-10 bg-slate-800"></div>
            )}
            {assignedToUser && (
               <div>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Deploying To</p>
                 <div className="flex items-center gap-2">
                   <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                     {assignedToUser.name.charAt(0).toUpperCase()}
                   </div>
                   <p className="text-sm font-bold text-white">{assignedToUser.name}</p>
                 </div>
               </div>
            )}
          </div>

          <button
            onClick={handleAssign}
            disabled={isAssignDisabled}
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 tracking-wide"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" /> Confirm Deployment
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AssignLeadsPage;
