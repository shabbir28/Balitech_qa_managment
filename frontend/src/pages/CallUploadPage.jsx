import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CallUploadPage = () => {
  const [file, setFile] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error(`File rejected: ${rejected[0].errors[0].message}`);
      return;
    }
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt', '.csv'],
      'application/octet-stream': ['.txt', '.csv', '.xlsx', '.xls'],
      'application/x-zip-compressed': ['.zip'] // just in case
    },
    maxFiles: 1,
    maxSize: 250 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file first.'); return; }
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_name', batchName || `Upload-${new Date().toLocaleDateString()}`);

    try {
      const res = await api.post('/calls/upload', formData);
      setResult(res.data);
      toast.success(`Upload complete! ${res.data.summary.successful} records imported.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const requiredColumns = [
    'Agent Name', 'Agent ID', 'Campaign Name', 'Customer Name',
    'Customer Phone', 'Call Date', 'Call Duration', 'Recording URL',
    'Disposition', 'Notes'
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Calls / Leads</h1>
          <p className="page-subtitle">Import call records from Excel, CSV, or TXT file</p>
        </div>
        <button onClick={() => navigate('/calls')} className="btn-secondary">
          <ArrowLeft size={16} /> View Records
        </button>
      </div>

      <div className="space-y-5">
        {/* Batch Name */}
        <div className="card p-5">
          <label className="label">Batch Name (Optional)</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. June 2024 Upload"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
          />
        </div>

        {/* Drop Zone */}
        <div className="card p-5">
          <label className="label">Select File</label>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-primary-500 bg-primary-500/10' : 'border-dark-border hover:border-primary-400 hover:bg-dark-hover'}
              ${file ? 'border-emerald-500 bg-emerald-500/10' : ''}`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-12 h-12 text-emerald-500" />
                <p className="font-bold text-white tracking-widest uppercase">{file.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-400 underline mt-2 tracking-widest uppercase"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-slate-500" />
                <div>
                  <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">{isDragActive ? 'Drop file here...' : 'Drag & drop file here'}</p>
                  <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wider">or <span className="text-primary-500 hover:text-primary-400">click to browse</span></p>
                </div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-2 border border-dark-border px-3 py-1 rounded-full">Supports: .xlsx, .xls, .csv, .txt · Max 250MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Required columns */}
        <div className="card p-5">
          <h3 className="text-xs font-extrabold text-slate-400 mb-3 uppercase tracking-widest">Required Columns</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {requiredColumns.map(col => (
              <div key={col} className="flex items-center gap-2 text-xs text-slate-300 bg-dark border border-dark-border rounded-lg px-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                {col}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            ⚠️ Duplicate phone numbers will be skipped automatically.
          </p>
        </div>

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2"><Upload size={18} /> Upload File</span>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Upload Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total Rows', value: result.summary.total, color: 'text-white' },
                { label: 'Imported', value: result.summary.successful, color: 'text-emerald-400' },
                { label: 'Duplicates', value: result.summary.duplicates, color: 'text-amber-400' },
                { label: 'Failed', value: result.summary.failed, color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="bg-dark border border-dark-border rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-widest font-bold">{s.label}</p>
                </div>
              ))}
            </div>

            {result.errors?.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold text-red-400 mb-2 flex items-center gap-1 uppercase tracking-widest">
                  <AlertCircle size={14} /> Errors (first 20)
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <XCircle size={12} />
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate('/calls')}
              className="btn-primary mt-4"
            >
              View Uploaded Records
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallUploadPage;
