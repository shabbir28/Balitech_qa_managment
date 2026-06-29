import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Phone, ClipboardCheck, AlertTriangle,
  MessageSquare, LogOut, Menu, X, Target,
  UsersRound, Send, ClipboardList
} from 'lucide-react';
import toast from 'react-hot-toast';
import logoImage from '../assets/logo.png';
import poweredByImage from '../assets/Go Connectivo 1.png';

const SidebarLayout = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Session terminated');
    navigate('/login');
  };

  const navItems = [
    // Common
    { name: 'Dashboard',       path: '/dashboard',       icon: LayoutDashboard, roles: ['Manager', 'User'] },

    // Manager section
    { name: 'My Team',         path: '/users',            icon: UsersRound,      roles: ['Manager'] },
    { name: 'Campaigns',       path: '/campaigns',        icon: Target,          roles: ['Manager'] },
    { name: 'Assign Leads',    path: '/assign-leads',     icon: Send,            roles: ['Manager'] },

    // QA / Evaluator
    { name: 'My Assignments',  path: '/my-assignments',   icon: ClipboardList,   roles: ['User'] },
    { name: 'Evaluations',     path: '/evaluations',       icon: ClipboardCheck,  roles: ['Manager', 'User'] },
    { name: 'Call Records',    path: '/calls',             icon: Phone,           roles: ['Manager'] },

    // Admin only
    { name: 'Critical Errors', path: '/critical-errors',  icon: AlertTriangle,   roles: ['Manager'] },
    { name: 'Feedback',        path: '/feedback',          icon: MessageSquare,   roles: ['Manager'] },
    { name: 'My Feedback',     path: '/my-feedback',       icon: MessageSquare,   roles: ['User'] },
  ];

  // Section headers for visual grouping
  const getSectionHeader = (path) => {
    if (path === '/users') return 'Manager';
    if (path === '/my-assignments') return 'Workspace';
    if (path === '/critical-errors') return 'Quality Control';
    return null;
  };

  const visibleItems = navItems.filter(item => hasRole(...item.roles));

  return (
    <div className="min-h-screen bg-dark flex selection:bg-primary-500/30">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Logo" className="h-8 object-contain" />
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="text-slate-400 hover:text-white transition-colors">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-[280px] bg-slate-950 border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:transform-none flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Brand */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-slate-800 relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <img src={logoImage} alt="Brand Logo" className="h-10 object-contain drop-shadow-md" />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-4 space-y-1 custom-scrollbar">
          {visibleItems.map((item, idx) => {
            const header = getSectionHeader(item.path);
            const prevItem = visibleItems[idx - 1];
            const showHeader = header && (!prevItem || getSectionHeader(prevItem.path) !== header);

            return (
              <div key={item.path}>
                {showHeader && (
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-5 pb-2">{header}</p>
                )}
                <NavLink
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                      isActive
                        ? 'text-emerald-400 bg-emerald-500/10 font-semibold'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 font-medium'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-emerald-500 rounded-r-full" />}
                      <div className="flex items-center gap-3 text-sm">
                        <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                        {item.name}
                      </div>
                    </>
                  )}
                </NavLink>
              </div>
            );
          })}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
          {/* Role Badge */}
          <div className="px-3 py-2 mb-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-slate-300 font-bold">Logged in as</p>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">{user?.role}</p>
            </div>
            {user?.campaign_name && (
              <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-800/50">
                <p className="text-[10px] text-slate-500 font-bold">Campaign</p>
                <p className="text-[10px] font-bold text-indigo-400 truncate max-w-[100px]">{user.campaign_name}</p>
              </div>
            )}
          </div>
          <NavLink
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-900 transition-colors group mb-3"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 font-bold group-hover:bg-slate-700 transition-colors text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors mb-4"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
          
          <div className="pt-4 border-t border-slate-800/50 flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-2">Powered By</span>
            <img src={poweredByImage} alt="Powered by Go Connective" className="h-8 object-contain" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative bg-[#070B12]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 scroll-smooth relative z-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SidebarLayout;
