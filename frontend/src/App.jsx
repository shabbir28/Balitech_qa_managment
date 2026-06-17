import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import SidebarLayout from './layouts/SidebarLayout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CallUploadPage from './pages/CallUploadPage';
import CallListPage from './pages/CallListPage';
import EvaluationFormPage from './pages/EvaluationFormPage';
import EvaluationListPage from './pages/EvaluationListPage';
import ManagerEvaluationViewPage from './pages/ManagerEvaluationViewPage';
import CriticalErrorsPage from './pages/CriticalErrorsPage';
import FeedbackListPage from './pages/FeedbackListPage';
import MyFeedbackPage from './pages/MyFeedbackPage';
import UserManagementPage from './pages/UserManagementPage';
import ProfilePage from './pages/ProfilePage';
import CampaignsPage from './pages/CampaignsPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

import AssignLeadsPage from './pages/AssignLeadsPage';
import MyAssignmentsPage from './pages/MyAssignmentsPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />

        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <SidebarLayout><DashboardPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Calls */}
          <Route path="/calls/upload" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><CallUploadPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/calls" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><CallListPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Evaluations */}
          <Route path="/evaluations/new" element={
            <ProtectedRoute roles={['Manager', 'User']}>
              <SidebarLayout><EvaluationFormPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/evaluations" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><EvaluationListPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/evaluations/view/:id" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><ManagerEvaluationViewPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Critical Errors */}
          <Route path="/critical-errors" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><CriticalErrorsPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Feedback */}
          <Route path="/feedback" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><FeedbackListPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/my-feedback" element={
            <ProtectedRoute roles={['User']}>
              <SidebarLayout><MyFeedbackPage /></SidebarLayout>
            </ProtectedRoute>
          } />


          {/* Campaigns */}
          <Route path="/campaigns" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><CampaignsPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Assign Leads (Manager + Admin) */}
          <Route path="/assign-leads" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><AssignLeadsPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* My Assignments (QA Officer, Team Lead, Agent) */}
          <Route path="/my-assignments" element={
            <ProtectedRoute roles={['User']}>
              <SidebarLayout><MyAssignmentsPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Users */}
          <Route path="/users" element={
            <ProtectedRoute roles={['Manager']}>
              <SidebarLayout><UserManagementPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Profile */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <SidebarLayout><ProfilePage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
