import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Headphones, BarChart2, PieChart, User, ShieldCheck } from 'lucide-react';
import logoImage from '../assets/logo.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    const demos = {
      manager: { email: 'manager@bpoqa.com', password: 'Admin@123' },
      user: { email: 'user@bpoqa.com', password: 'Admin@123' },
    };
    setEmail(demos[role].email);
    setPassword(demos[role].password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070B14] font-sans relative overflow-hidden selection:bg-orange-500/30">
      {/* Background Glows */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[700px] h-[700px] bg-orange-600/10 rounded-full blur-[150px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] bg-teal-600/10 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02]" />
      </div>

      <div className="relative z-10 w-full max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 p-6 lg:p-12">
        
        {/* Left Branding Panel */}
        <div className="flex-1 text-center lg:text-left space-y-8 max-w-xl">
          <div className="inline-flex items-center">
            <img src={logoImage} alt="Brand Logo" className="h-16 lg:h-20 object-contain drop-shadow-2xl" />
          </div>
          
          <div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white mb-2">
              Balitech
            </h1>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-orange-500">
              QA Portal
            </h1>
            <div className="w-16 h-1 bg-orange-500 mt-6 lg:mx-0 mx-auto rounded-full" />
          </div>
          
          <div className="space-y-4">
            <p className="text-xl lg:text-2xl text-slate-200 font-medium leading-snug">
              Smarter quality assurance for high-performing BPO teams.
            </p>
            <p className="text-base text-slate-400 leading-relaxed">
              Monitor calls, evaluate agents, and track performance from one secure workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-4">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-800 bg-[#111827]/80 backdrop-blur-sm">
              <Headphones className="text-orange-500 w-5 h-5" />
              <span className="text-sm font-medium text-slate-300">Call Monitoring</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-800 bg-[#111827]/80 backdrop-blur-sm">
              <BarChart2 className="text-orange-500 w-5 h-5" />
              <span className="text-sm font-medium text-slate-300">Agent Scorecards</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-800 bg-[#111827]/80 backdrop-blur-sm">
              <PieChart className="text-orange-500 w-5 h-5" />
              <span className="text-sm font-medium text-slate-300">Real-Time Reports</span>
            </div>
          </div>
        </div>

        {/* Right Login Form */}
        <div className="w-full max-w-[440px] shrink-0">
          <div className="bg-[#111827] rounded-[24px] border border-slate-800 p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            
            {/* User Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-[#1A2234] border border-slate-700/50 shadow-[0_0_30px_rgba(249,115,22,0.15)] flex items-center justify-center mb-6">
              <User className="w-7 h-7 text-orange-500" />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
              <p className="text-slate-400 text-sm mt-2">Sign in to access your Balitech workspace</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Work Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-[#0B1120] border border-slate-800 rounded-xl text-sm text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all placeholder-slate-600"
                    placeholder="name@balitech.com"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-[#0B1120] border border-slate-800 rounded-xl text-sm text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all placeholder-slate-600 tracking-wider"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 mt-2 bg-[#F97316] text-white rounded-xl font-medium shadow-lg shadow-orange-500/20 hover:bg-[#ea580c] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <div className="text-center pt-1">
                <a href="#" className="text-[#F97316] text-sm font-medium hover:underline transition-all">Forgot password?</a>
              </div>
            </form>

            {/* Quick Access */}
            <div className="mt-8 pt-6 border-t border-slate-800 relative">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#111827] px-4 text-xs font-medium text-slate-500">
                Quick Access
              </span>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => fillDemo('manager')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 hover:border-orange-500/30 transition-all"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('user')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 hover:border-orange-500/30 transition-all"
                >
                  <User className="w-4 h-4 text-teal-500" />
                  User
                </button>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
              <Lock className="w-3 h-3" />
              Secure access for authorized Balitech staff only
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
