import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import SidebarLayout from './layouts/SidebarLayout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EvaluationFormPage from './pages/EvaluationFormPage';
import EvaluationListPage from './pages/EvaluationListPage';
import ManagerEvaluationViewPage from './pages/ManagerEvaluationViewPage';
import UserManagementPage from './pages/UserManagementPage';
import ProfilePage from './pages/ProfilePage';
import CampaignsPage from './pages/CampaignsPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import DialerSalesPage from './pages/DialerSalesPage';
import SalesComparePage from './pages/SalesComparePage';
import CompareHistoryPage from './pages/CompareHistoryPage';
import DialerSalesHistoryPage from './pages/DialerSalesHistoryPage';

import AssignLeadsPage from './pages/AssignLeadsPage';
import MyAssignmentsPage from './pages/MyAssignmentsPage';

import DialerSearchPage from './pages/DialerSearchPage';
import DialerLeadDetailsPage from './pages/DialerLeadDetailsPage';


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

          {/* Evaluations */}
          <Route path="/evaluations/new" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><EvaluationFormPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/evaluations" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><EvaluationListPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/evaluations/view/:id" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><ManagerEvaluationViewPage /></SidebarLayout>
            </ProtectedRoute>
          } />



          {/* Campaigns */}
          <Route path="/campaigns" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin']}>
              <SidebarLayout><CampaignsPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Dialer */}
          <Route path="/dialer" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><DialerSearchPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/dialer-sales" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><DialerSalesPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/dialer/lead/:leadId" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><DialerLeadDetailsPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/dialer-sales/compare" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><SalesComparePage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/dialer-sales/compare-history" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><CompareHistoryPage /></SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/dialer-sales/history" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin', 'QA Agent']}>
              <SidebarLayout><DialerSalesHistoryPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* Assign Leads (Manager + Admin) */}
          <Route path="/assign-leads" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin']}>
              <SidebarLayout><AssignLeadsPage /></SidebarLayout>
            </ProtectedRoute>
          } />

          {/* My Assignments (QA Officer, Team Lead, Agent) */}
          <Route path="/my-assignments" element={
            <ProtectedRoute roles={['QA Agent']}>
              <SidebarLayout><MyAssignmentsPage /></SidebarLayout>
            </ProtectedRoute>
          } />


          {/* Users */}
          <Route path="/users" element={
            <ProtectedRoute roles={['Super Admin', 'QA Admin']}>
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
