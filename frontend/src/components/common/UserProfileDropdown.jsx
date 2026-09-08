import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, LogOut, Shield, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UserProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Session terminated');
    navigate('/login');
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    navigate('/profile');
  };

  return (
    <div className="relative font-sans" ref={menuRef}>
      {/* ── PROFILE TRIGGER ICON WITH PERSON EMOJI ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500/25 via-[#0C101C] to-amber-500/10 border-2 border-amber-500/50 hover:border-amber-400 hover:shadow-[0_0_18px_rgba(245,158,11,0.35)] transition-all duration-300 hover:scale-110 active:scale-95 shadow-md group cursor-pointer focus:outline-none"
        title="Account & Profile"
        aria-label="User menu"
      >
        {/* Person Emoji with ambient glow */}
        <span className="text-xl select-none group-hover:scale-110 transition-transform drop-shadow">
          🧑‍💼
        </span>

        {/* Live Online Green Indicator Dot */}
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#080B11] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      </button>

      {/* ── DROPDOWN POPUP CARD ── */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[#0D111D] border border-slate-800/90 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] z-50 p-4 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          {/* Header with Emoji Avatar & User Details */}
          <div className="flex items-center gap-3 pb-3.5 border-b border-slate-800/70">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500/25 via-[#111728] to-amber-500/10 border border-amber-500/40 flex items-center justify-center text-3xl shadow-inner shrink-0">
              🧑‍💼
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-white truncate leading-tight">
                {user?.name || 'System Manager'}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                {user?.email || 'manager@bpoqa.com'}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                  <Shield className="w-2.5 h-2.5 mr-1 text-amber-400" />
                  {user?.role || 'Super Admin'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Info Section */}
          <div className="py-2.5 space-y-1.5 text-xs text-slate-400 border-b border-slate-800/70">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Active
              </span>
            </div>
            {user?.campaign_name && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Campaign</span>
                <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[130px]">
                  {user.campaign_name}
                </span>
              </div>
            )}
          </div>

          {/* Menu Action Buttons */}
          <div className="pt-3 space-y-1.5">
            <button
              onClick={handleProfileClick}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <User className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>View Full Profile</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors group cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
