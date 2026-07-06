import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, FileText, FolderOpen,
  BookOpen, Users, IndianRupee, GraduationCap,
  ShieldCheck, BarChart2, Bell, Settings, LogOut,
  ChevronDown, ChevronRight, Menu, X, Search,
  UserCheck, Award, BookMarked, Activity, RefreshCw,
  TrendingUp, Laptop, ClipboardList
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationsList } from '../../hooks/useData';
import { Avatar } from '../ui/index';
import clsx from 'clsx';

// ─── Nav structure ────────────────────────────────────────────────────────────
const NAV = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/dashboard',
    roles: null, // all
  },
  {
    section: 'Meetings',
    items: [
      { label: 'Calendar',      icon: Calendar,     to: '/meetings/calendar' },
      { label: 'Agendas',       icon: ClipboardList, to: '/meetings/agendas' },
      { label: 'Action Items',  icon: RefreshCw,    to: '/meetings/action-items' },
    ],
  },
  {
    section: 'Documents',
    items: [
      { label: 'Document Hub',  icon: FolderOpen,   to: '/documents' },
    ],
  },
  {
    section: 'Academics',
    items: [
      { label: 'Academic Calendar', icon: Calendar, to: '/academics/calendar' },
      { label: 'Performance',    icon: TrendingUp,  to: '/academics/performance' },
      { label: 'Attendance',     icon: UserCheck,   to: '/academics/attendance' },
      { label: 'Results',        icon: BookOpen,    to: '/academics/results' },
      { label: 'Weak Students',  icon: Users,       to: '/academics/weak-students' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Placement',     icon: GraduationCap, to: '/placement' },
      { label: 'Fees',          icon: IndianRupee,   to: '/fees' },
      { label: 'LMS',           icon: Laptop,        to: '/lms' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { label: 'NBA / NAAC',    icon: ShieldCheck,  to: '/compliance/nba-naac' },
      { label: 'OBE / CO-PO',   icon: Award,        to: '/compliance/obe' },
      { label: 'BoS',           icon: BookMarked,   to: '/compliance/bos' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { label: 'Reports',       icon: BarChart2,    to: '/reports' },
    ],
  },
  {
    section: 'Admin',
    roles: ['admin', 'director', 'principal'],
    items: [
      { label: 'Users',         icon: Users,        to: '/admin/users' },
      { label: 'Predefined Agendas', icon: ClipboardList, to: '/admin/agenda-templates' },
      { label: 'Audit Logs',    icon: Activity,     to: '/admin/audit' },
      { label: 'Settings',      icon: Settings,     to: '/settings' },
    ],
  },
];

const ROLE_LABELS = {
  director:'Director', principal:'Principal', hod:'Head of Department',
  faculty:'Faculty',   tpo:'TPO',            accounts:'Accounts',
  exam_cell:'Exam Cell', admin:'Admin',
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ mobile, onClose }) {
  const { profile, role } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState({});

  const toggleSection = (sec) => setCollapsed(p => ({ ...p, [sec]: !p[sec] }));

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/');

  const canSee = (roles) => {
    if (!roles) return true;
    return roles.includes(role);
  };

  return (
    <div className={clsx(
      'flex flex-col h-full bg-white border-r border-surface-100 overflow-y-auto no-scrollbar',
      mobile ? 'w-72' : 'w-64'
    )}>
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white font-black text-sm">AG</span>
          </div>
          <div>
            <p className="text-sm font-bold text-surface-900 leading-tight">AGHMS</p>
            <p className="text-[10px] text-surface-400 leading-tight">RNGPIT</p>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {NAV.map((item, idx) => {
          // Top-level single link
          if (item.to) {
            return (
              <NavLink
                key={idx}
                to={item.to}
                onClick={mobile ? onClose : undefined}
                className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
              >
                <item.icon size={16} className="flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          }

          // Section
          if (!canSee(item.roles)) return null;
          const sectionCollapsed = collapsed[item.section];
          const hasActive = item.items?.some(i => isActive(i.to));

          return (
            <div key={idx} className="pt-2">
              <button
                onClick={() => toggleSection(item.section)}
                className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group"
              >
                <span className={clsx(
                  'text-[10px] font-bold uppercase tracking-widest transition-colors',
                  hasActive ? 'text-primary-600' : 'text-surface-400 group-hover:text-surface-600'
                )}>
                  {item.section}
                </span>
                {sectionCollapsed
                  ? <ChevronRight size={12} className="text-surface-300" />
                  : <ChevronDown  size={12} className="text-surface-300" />
                }
              </button>

              {!sectionCollapsed && (
                <div className="space-y-0.5">
                  {item.items.map((link, li) => (
                    <NavLink
                      key={li}
                      to={link.to}
                      onClick={mobile ? onClose : undefined}
                      className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
                    >
                      <link.icon size={15} className="flex-shrink-0" />
                      {link.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-surface-100 flex-shrink-0">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-surface-50 transition-colors">
          <Avatar name={profile?.full_name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-surface-800 truncate">{profile?.full_name || 'User'}</p>
            <p className="text-[10px] text-surface-400">{ROLE_LABELS[role] || role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ onMenuOpen }) {
  const { profile, signOut, role } = useAuth();
  const navigate = useNavigate();
  const { data: notifs } = useNotificationsList();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef(null);

  const unread = notifs?.filter(n => !n.read_status).length ?? 0;

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/meetings/agendas?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="h-14 bg-white border-b border-surface-100 flex items-center px-4 gap-3 flex-shrink-0 z-20 sticky top-0">
      {/* Mobile menu toggle */}
      <button onClick={onMenuOpen} className="lg:hidden p-2 rounded-xl hover:bg-surface-100 text-surface-500">
        <Menu size={18} />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-sm hidden sm:block">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type="search"
          placeholder="Search meetings, documents…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          className="pl-9 py-2 h-9 text-sm bg-surface-50 border-surface-200"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-xl hover:bg-surface-100 text-surface-500 transition-colors"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-danger-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Profile dropdown */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setProfileOpen(p => !p)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-100 transition-colors"
          >
            <Avatar name={profile?.full_name} size="sm" />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-surface-800 leading-tight">{profile?.full_name?.split(' ')[0] || 'User'}</p>
              <p className="text-[10px] text-surface-400">{ROLE_LABELS[role] || role}</p>
            </div>
            <ChevronDown size={13} className="text-surface-400 hidden sm:block" />
          </button>

          {profileOpen && (
            <div className="dropdown right-0 top-full mt-2 w-48">
              <div className="px-4 py-2.5 border-b border-surface-100">
                <p className="text-xs font-semibold text-surface-800">{profile?.full_name}</p>
                <p className="text-[10px] text-surface-400 truncate">{profile?.email}</p>
              </div>
              <button onClick={() => { navigate('/profile'); setProfileOpen(false); }} className="dropdown-item w-full">
                <Users size={14} /> My Profile
              </button>
              <button onClick={() => { navigate('/settings'); setProfileOpen(false); }} className="dropdown-item w-full">
                <Settings size={14} /> Settings
              </button>
              <div className="border-t border-surface-100 my-1" />
              <button onClick={handleSignOut} className="dropdown-item w-full text-danger-600 hover:bg-danger-50">
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
export default function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex-shrink-0">
            <Sidebar mobile onClose={() => setMobileOpen(false)} />
          </div>
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
