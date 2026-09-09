import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Phone, ClipboardCheck,
  Menu, X, Target,
  UsersRound, Send, ClipboardList, ListChecks, Database, CalendarDays, History,
  ShieldAlert, XCircle
} from 'lucide-react';
import logoImage from '../assets/logo.png';
import poweredByImage from '../assets/Go Connectivo 1.png';

const SidebarLayout = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, hasRole } = useAuth();

  const navItems = [
    // Common
    { name: 'Dashboard',        path: '/dashboard',            icon: LayoutDashboard, roles: ['Super Admin', 'QA Admin', 'QA Agent', 'Manager'] },

    // Manager / Leadership section
    { name: 'My Team',          path: '/users',                icon: UsersRound,      roles: ['Super Admin', 'QA Admin', 'Manager'] },
    { name: 'Campaigns',        path: '/campaigns',            icon: Target,          roles: ['Super Admin', 'QA Admin', 'Manager'] },
    { name: 'Assign Leads',     path: '/assign-leads',         icon: Send,            roles: ['Super Admin', 'QA Admin', 'Manager'] },

    // Dialer
    { name: 'Dialer Search',    path: '/dialer',               icon: Phone,           roles: ['Super Admin', 'QA Admin', 'QA Agent', 'Manager'] },
    { name: 'Dialer Sales',     path: '/dialer-sales',         icon: Database,        roles: ['Super Admin', 'QA Admin', 'QA Agent', 'Manager'] },
    { name: 'Sales History',    path: '/dialer-sales/history', icon: CalendarDays,    roles: ['Super Admin', 'QA Admin', 'QA Agent', 'Manager'] },
    { name: 'Agent Wise Sales', path: '/dialer-sales/agent-sales', icon: UsersRound,  roles: ['Super Admin', 'QA Admin', 'QA Agent', 'Manager'] },
    { name: 'Agent QA Report',  path: '/agent-reports',        icon: ShieldAlert,     roles: ['Super Admin', 'QA Admin', 'QA Agent', 'Manager'] },
    { name: 'Rejected Calls',   path: '/rejected-calls',       icon: XCircle,         roles: ['Super Admin', 'QA Admin', 'QA Agent', 'Manager'] },
    { name: 'Compare Sales',    path: '/dialer-sales/compare', icon: ListChecks,      roles: ['Super Admin', 'QA Admin', 'Manager'] },
    { name: 'Compare History',  path: '/dialer-sales/compare-history', icon: History, roles: ['Super Admin', 'QA Admin', 'Manager'] },

    // QA / Evaluator
    { name: 'My Assignments',   path: '/my-assignments',       icon: ClipboardList,   roles: ['QA Agent'] },
    { name: 'Evaluations',      path: '/evaluations',          icon: ClipboardCheck,  roles: ['Super Admin', 'QA Admin', 'Manager'] },
  ];

  // Section headers for visual grouping
  const getSectionHeader = (path) => {
    if (path === '/users') return user?.role?.toUpperCase() || 'MANAGEMENT';
    return null;
  };

  const visibleItems = navItems.filter(item => hasRole(...item.roles));

  return (
    <div className="min-h-screen bg-[#080B11] flex selection:bg-amber-500/30 selection:text-amber-100 font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#090D16] border-b border-slate-800/80 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <img src={logoImage} alt="Balitech Logo" className="h-9 object-contain" />
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
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-[265px] bg-[#090D16] border-r border-slate-800/80 transform transition-transform duration-300 ease-in-out lg:transform-none flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Brand Logo Container */}
        <div className="h-20 flex items-center px-5 border-b border-slate-800/60 relative overflow-hidden shrink-0">
          <img src={logoImage} alt="Balitech Logo" className="h-12 sm:h-13 w-auto max-w-[210px] object-contain drop-shadow-md" />
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {visibleItems.map((item, idx) => {
            const header = getSectionHeader(item.path);
            const prevItem = visibleItems[idx - 1];
            const showHeader = header && (!prevItem || getSectionHeader(prevItem.path) !== header);

            return (
              <div key={item.path}>
                {showHeader && (
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 pt-5 pb-2">
                    {header}
                  </p>
                )}
                <NavLink
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-[13px] ${
                      isActive
                        ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30 font-semibold shadow-[0_0_15px_rgba(245,158,11,0.06)]'
                        : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-200 font-medium'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      <span>{item.name}</span>
                    </div>
                  )}
                </NavLink>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer - Only Powered By Go Connectivo */}
        <div className="p-4 border-t border-slate-800/60 bg-[#090D16] shrink-0 flex flex-col items-center">
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Powered By</span>
          <img src={poweredByImage} alt="Powered by Go Connective" className="h-8 object-contain opacity-75 hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative bg-[#080B11]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/[0.015] rounded-full blur-[120px] pointer-events-none" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 pt-20 lg:pt-6 scroll-smooth relative z-10">
          <div className="max-w-[1440px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SidebarLayout;
