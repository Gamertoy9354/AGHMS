import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import LoadingScreen from './components/ui/LoadingScreen';

// ── Auth ────────────────────────────────────────────────────────────────────
import LoginPage from './pages/auth/LoginPage';

// ── Dashboard ───────────────────────────────────────────────────────────────
import DashboardPage from './pages/dashboard/DashboardPage';

// ── Meetings ────────────────────────────────────────────────────────────────
import AgendasPage          from './pages/meetings/AgendasPage';
import CreateAgendaPage     from './pages/meetings/CreateAgendaPage';
import AgendaDetailPage     from './pages/meetings/AgendaDetailPage';
import MeetingCalendarPage  from './pages/meetings/MeetingCalendarPage';
import ActionItemsPage      from './pages/meetings/ActionItemsPage';
import MOMPage              from './pages/meetings/MOMPage';
import MeetingWorkspacePage from './pages/meetings/MeetingWorkspacePage';

// ── Documents ───────────────────────────────────────────────────────────────
import DocumentsPage from './pages/documents/DocumentsPage';

// ── Academics ───────────────────────────────────────────────────────────────
import AcademicCalendarPage from './pages/academics/AcademicCalendarPage';
import PerformancePage  from './pages/academics/PerformancePage';
import AttendancePage   from './pages/academics/AttendancePage';
import WeakStudentsPage from './pages/academics/WeakStudentsPage';
import ResultsPage      from './pages/academics/ResultsPage';

// ── Operations ──────────────────────────────────────────────────────────────
import PlacementPage from './pages/placement/PlacementPage';
import FeesPage      from './pages/fees/FeesPage';

// ── Compliance ──────────────────────────────────────────────────────────────
import NaacPage from './pages/compliance/NaacPage';
import LMSPage  from './pages/compliance/LMSPage';
import OBEPage  from './pages/compliance/OBEPage';

// ── Reports & Analytics ─────────────────────────────────────────────────────
import ReportsPage from './pages/reports/ReportsPage';

// ── Notifications & Profile ─────────────────────────────────────────────────
import NotificationsPage from './pages/notifications/NotificationsPage';
import ProfilePage       from './pages/profile/ProfilePage';

// ── Admin ───────────────────────────────────────────────────────────────────
import UsersAdminPage from './pages/admin/UsersAdminPage';
import AuditLogsPage  from './pages/admin/AuditLogsPage';
import AgendaTemplatesPage from './pages/admin/AgendaTemplatesPage';

// ── Settings ────────────────────────────────────────────────────────────────
import SettingsPage from './pages/settings/SettingsPage';

// ── Minimal stub for truly unbuilt pages ────────────────────────────────────
import { BookOpen, Award, Settings } from 'lucide-react';

function ComingSoon({ title, icon: Icon, description }) {
  return (
    <div className="page-wrapper flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary-200">
          {Icon ? <Icon size={36} className="text-white" /> : <span className="text-white font-black text-2xl">AG</span>}
        </div>
        <h2 className="text-2xl font-bold text-surface-800 mb-2">{title}</h2>
        <p className="text-surface-500 text-sm mb-6">{description || 'This module is in progress.'}</p>
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success-500" />
          <span className="text-xs text-surface-400">Database ready</span>
          <span className="w-2 h-2 rounded-full bg-warning-500 ml-3" />
          <span className="text-xs text-surface-400">UI in progress</span>
        </div>
      </div>
    </div>
  );
}

// ── Query Client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime:    1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/auth/login" element={<LoginPage />} />

      {/* Protected */}
      <Route path="/*" element={
        <ProtectedRoute>
          <AppShell>
            <Routes>
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* Dashboard */}
              <Route path="dashboard" element={<DashboardPage />} />

              {/* Meetings */}
              <Route path="meetings/calendar"     element={<MeetingCalendarPage />} />
              <Route path="meetings/agendas"      element={<AgendasPage />} />
              <Route path="meetings/agendas/new"  element={<CreateAgendaPage />} />
              <Route path="meetings/agendas/:id/edit" element={<CreateAgendaPage />} />
              <Route path="meetings/agendas/:id"  element={<AgendaDetailPage />} />
              <Route path="meetings/agendas/:id/workspace" element={<MeetingWorkspacePage />} />
              <Route path="meetings/agendas/:id/mom" element={<MOMPage />} />
              <Route path="meetings/action-items" element={<ActionItemsPage />} />
              <Route path="meetings/mom"          element={<ActionItemsPage />} />
              <Route path="atr"                   element={<ActionItemsPage />} />

              {/* Documents */}
              <Route path="documents" element={<DocumentsPage />} />

              {/* Academics */}
              <Route path="academics/calendar"      element={<AcademicCalendarPage />} />
              <Route path="academics/performance"   element={<PerformancePage />} />
              <Route path="academics/attendance"    element={<AttendancePage />} />
              <Route path="academics/weak-students" element={<WeakStudentsPage />} />
              <Route path="academics/results"       element={<ResultsPage />} />

              {/* Operations */}
              <Route path="placement"    element={<PlacementPage />} />
              <Route path="fees"         element={<FeesPage />} />
              <Route path="scholarships" element={<ComingSoon title="Scholarship Tracking" icon={Award} description="Track GTU, government, and institutional scholarship applications and disbursements." />} />
              <Route path="lms"          element={<LMSPage />} />

              {/* Compliance */}
              <Route path="compliance/nba-naac" element={<NaacPage />} />
              <Route path="compliance/bos"      element={<ComingSoon title="Board of Studies" icon={BookOpen} description="BoS meeting records, syllabus updates, and academic program management." />} />
              <Route path="compliance/obe"      element={<OBEPage />} />

              {/* Reports & Analytics */}
              <Route path="reports"   element={<ReportsPage />} />
              <Route path="analytics" element={<DashboardPage />} />

              {/* Notifications & Profile */}
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile"       element={<ProfilePage />} />
              <Route path="settings"      element={<SettingsPage />} />
              <Route path="help"          element={<ComingSoon title="Help & Guide" icon={BookOpen} />} />

              {/* Admin */}
              <Route path="admin/users"       element={<UsersAdminPage />} />
              <Route path="admin/departments" element={<ComingSoon title="Department Management" icon={Settings} />} />
              <Route path="admin/settings"    element={<SettingsPage />} />
              <Route path="admin/audit"       element={<AuditLogsPage />} />
              <Route path="admin/agenda-templates" element={<AgendaTemplatesPage />} />

              {/* Catch-all */}
              <Route path="unauthorized" element={
                <div className="page-wrapper flex items-center justify-center min-h-[60vh]">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-danger-100 flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">🔒</span>
                    </div>
                    <h2 className="text-xl font-bold text-danger-700 mb-2">Access Denied</h2>
                    <p className="text-surface-500 text-sm">You don't have permission to view this page.</p>
                  </div>
                </div>
              } />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AppShell>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                background: '#1e293b',
                color: '#f8fafc',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                padding: '12px 16px',
                maxWidth: '420px',
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
