import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  TbLayoutDashboard, TbSearch, TbCurrencyDollar, TbCalendarStats, TbChartBar,
  TbArrowsExchange, TbHistory, TbClipboardList, TbChecklist, TbReportAnalytics,
  TbPhoneOff, TbFileSpreadsheet, TbClipboardText, TbUsersGroup, TbSpeakerphone, TbUserPlus,
  TbLogout, TbChevronLeft, TbChevronRight, TbMenu2, TbX, TbShieldCheck,
} from 'react-icons/tb';
import toast from 'react-hot-toast';
import logoImage from '../assets/logo.png';
import poweredByImage from '../assets/Go Connectivo 1.png';

const ALL_ROLES = ['Super Admin', 'QA Admin', 'QA Agent', 'Manager'];
const LEADERSHIP = ['Super Admin', 'QA Admin', 'Manager'];
const COLLAPSE_KEY = 'sidebar:collapsed';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: TbLayoutDashboard, roles: ALL_ROLES },
    ],
  },
  {
    title: 'Dialer & Sales',
    items: [
      { name: 'Dialer Search', path: '/dialer', icon: TbSearch, roles: ALL_ROLES },
      { name: 'Dialer Sales', path: '/dialer-sales', icon: TbCurrencyDollar, roles: ALL_ROLES },
      { name: 'Sales History', path: '/dialer-sales/history', icon: TbCalendarStats, roles: ALL_ROLES },
      { name: 'Agent Wise Sales', path: '/dialer-sales/agent-sales', icon: TbChartBar, roles: ALL_ROLES },
      { name: 'Compare Sales', path: '/dialer-sales/compare', icon: TbArrowsExchange, roles: LEADERSHIP },
      { name: 'Compare History', path: '/dialer-sales/compare-history', icon: TbHistory, roles: LEADERSHIP },
    ],
  },
  {
    title: 'Quality',
    items: [
      { name: 'My Assignments', path: '/my-assignments', icon: TbClipboardList, roles: ['QA Agent'] },
      { name: 'Evaluations', path: '/evaluations', icon: TbChecklist, roles: ALL_ROLES },
      { name: 'Agent QA Report', path: '/agent-reports', icon: TbReportAnalytics, roles: ALL_ROLES },
      { name: 'Rejected Calls', path: '/rejected-calls', icon: TbPhoneOff, roles: ALL_ROLES },
      { name: 'QA Daily Report', path: '/qa-daily-report', icon: TbFileSpreadsheet, roles: ALL_ROLES },
      { name: 'Medicare Daily Evaluation', path: '/medicare-daily-evaluation', icon: TbClipboardText, roles: ALL_ROLES },
    ],
  },
  {
    title: 'Management',
    items: [
      { name: 'My Team', path: '/users', icon: TbUsersGroup, roles: LEADERSHIP },
      { name: 'Campaigns', path: '/campaigns', icon: TbSpeakerphone, roles: LEADERSHIP },
      { name: 'Assign Leads', path: '/assign-leads', icon: TbUserPlus, roles: LEADERSHIP },
    ],
  },
];

function initialsOf(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || '?';
}

const SidebarLayout = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const { user, hasRole, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const sections = useMemo(
    () =>
      NAV_SECTIONS
        .map((section) => ({ ...section, items: section.items.filter((i) => hasRole(...i.roles)) }))
        .filter((section) => section.items.length > 0),
    [hasRole]
  );

  const handleLogout = () => {
    logout();
    toast.success('Session terminated');
    navigate('/login');
  };

  // Collapsed rail is desktop-only; the mobile drawer always shows full labels.
  const railWidth = collapsed ? 'lg:w-[72px]' : 'lg:w-[236px]';

  return (
    <div className="min-h-screen bg-[#080B11] flex selection:bg-amber-500/30 selection:text-amber-100 font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0A0E17] border-b border-slate-800/70 z-50 flex items-center justify-between px-4">
        <img src={logoImage} alt="Balitech Logo" className="h-9 object-contain" />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-9 h-9 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 flex items-center justify-center transition-colors"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? <TbX size={18} /> : <TbMenu2 size={18} />}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[236px] ${railWidth} bg-[#0A0E17] border-r border-slate-800/70 transition-[transform,width] duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className={`h-[58px] flex items-center border-b border-slate-800/70 shrink-0 ${collapsed ? 'lg:justify-center lg:px-0 px-4' : 'px-4'}`}>
          <img
            src={logoImage}
            alt="Balitech Logo"
            className={`object-contain ${collapsed ? 'lg:h-8 lg:max-w-[40px] h-9 max-w-[176px]' : 'h-9 max-w-[176px]'}`}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 custom-scrollbar">
          {sections.map((section, sIdx) => (
            <div key={section.title}>
              {collapsed ? (
                sIdx > 0 && <div className="hidden lg:block h-px bg-slate-800/60 mx-3 my-2" />
              ) : (
                <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-[0.16em] px-2.5 pt-3.5 pb-1.5">
                  {section.title}
                </p>
              )}

              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  title={collapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `relative flex items-center rounded-lg mb-0.5 transition-all duration-150 group ${
                      collapsed ? 'lg:justify-center lg:px-0 lg:py-2 px-2.5 py-2 gap-2.5' : 'px-2.5 py-2 gap-2.5'
                    } ${
                      isActive
                        ? 'bg-amber-500/[0.12] text-amber-300'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[18px] w-[3px] rounded-r bg-amber-400" />
                      )}
                      <item.icon
                        size={18}
                        strokeWidth={isActive ? 2.2 : 1.8}
                        className={`shrink-0 transition-colors ${
                          isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />
                      <span
                        className={`truncate text-[12.5px] ${isActive ? 'font-semibold' : 'font-medium'} ${
                          collapsed ? 'lg:hidden' : ''
                        }`}
                      >
                        {item.name}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Account */}
        <div className="border-t border-slate-800/70 shrink-0 p-2">
          <div className={`flex items-center gap-2 ${collapsed ? 'lg:flex-col lg:gap-1.5' : ''}`}>
            <button
              type="button"
              onClick={() => { setIsOpen(false); navigate('/profile'); }}
              title={collapsed ? `${user?.name || 'Profile'} — ${user?.role || ''}` : 'View profile'}
              className={`flex items-center gap-2.5 min-w-0 flex-1 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.04] transition-colors text-left ${
                collapsed ? 'lg:flex-none lg:px-0 lg:py-0' : ''
              }`}
            >
              <span className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                {initialsOf(user?.name)}
              </span>
              <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                <span className="block text-[12px] font-semibold text-slate-100 truncate capitalize leading-tight">
                  {user?.name || 'Account'}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500 truncate mt-0.5">
                  <TbShieldCheck size={11} strokeWidth={2} className="shrink-0" />
                  {user?.role || '—'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center shrink-0 transition-colors"
            >
              <TbLogout size={16} strokeWidth={1.9} />
            </button>
          </div>

          <div className={`flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-800/60 ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className={`flex-1 flex items-center gap-1.5 min-w-0 pl-1.5 ${collapsed ? 'lg:hidden' : ''}`}>
              <span className="text-[7.5px] text-slate-600 font-semibold uppercase tracking-widest shrink-0">
                Powered by
              </span>
              <img
                src={poweredByImage}
                alt="Powered by Go Connectivo"
                className="h-4 object-contain opacity-60 hover:opacity-100 transition-opacity"
              />
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex w-8 h-7 rounded-lg text-slate-600 hover:text-slate-200 hover:bg-white/[0.04] items-center justify-center transition-colors shrink-0"
            >
              {collapsed ? <TbChevronRight size={16} /> : <TbChevronLeft size={16} />}
            </button>
          </div>
        </div>
      </aside>

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
