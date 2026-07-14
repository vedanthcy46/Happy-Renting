import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Navbar from './components/common/Navbar';
import SplashScreen from './components/SplashScreen';

// Pages
import LoginPage       from './pages/LoginPage';
import DashboardPage   from './pages/DashboardPage';
import RoomsPage       from './pages/RoomsPage';
import PropertiesPage  from './pages/PropertiesPage';
import TenantsPage     from './pages/TenantsPage';
import AddTenantPage   from './pages/AddTenantPage';
import MyRoomPage      from './pages/MyRoomPage';
import PaymentsPage    from './pages/PaymentsPage';
import UsersPage       from './pages/UsersPage';
import ComplaintsPage  from './pages/ComplaintsPage';
import ProfilePage     from './pages/ProfilePage';
import TenantPaymentPage from './pages/TenantPaymentPage';
import LandingPage       from './pages/LandingPage';
import OwnerRequestPage  from './pages/OwnerRequestPage';
import AdminOwnerRequests from './pages/AdminOwnerRequests';
import AuditLogPage       from './pages/AuditLogPage';
import WalletPage         from './pages/WalletPage';
import AdminWalletPage    from './pages/AdminWalletPage';

import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage    from './pages/NotFoundPage';
import ForceChangePassword from './pages/ForceChangePassword';
import VerifyEmailPage from './pages/VerifyEmailPage';
import FeaturesPage from './pages/FeaturesPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import FAQPage from './pages/FAQPage';
import SupportPage from './pages/SupportPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsConditionsPage from './pages/TermsConditionsPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import DataDeletionPage from './pages/DataDeletionPage';
import AdminDeletionRequestsPage from './pages/AdminDeletionRequestsPage';
import OwnerDeletionRequestsPage from './pages/OwnerDeletionRequestsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

/**
 * AppLayout — wraps all authenticated pages with Navbar + padded main area
 */
const AppLayout = () => (
  <div className="min-h-screen bg-surface">
    <Navbar />
    <main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-20 pb-10">
      <Outlet />
    </main>
  </div>
);

const AppContent = () => (
  <SplashScreen>
    <Routes>
          {/* Public */}
          <Route path="/"             element={<LandingPage />} />
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/setup-password" element={<ForceChangePassword />} />
          <Route path="/request-access" element={<OwnerRequestPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsConditionsPage />} />
          <Route path="/refund" element={<RefundPolicyPage />} />
          <Route path="/data-deletion" element={<DataDeletionPage />} />

          {/* Protected — all authenticated roles */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Owner + Super Admin */}
            <Route path="properties" element={<ProtectedRoute roles={['superadmin','owner']}><PropertiesPage /></ProtectedRoute>} />
            <Route path="rooms"      element={<ProtectedRoute roles={['superadmin','owner']}><RoomsPage /></ProtectedRoute>} />
            <Route path="tenants"    element={<ProtectedRoute roles={['superadmin','owner']}><TenantsPage /></ProtectedRoute>} />
            <Route path="tenants/add" element={<ProtectedRoute roles={['superadmin','owner']}><AddTenantPage /></ProtectedRoute>} />
            <Route path="payments"   element={<ProtectedRoute roles={['superadmin','owner','tenant']}><PaymentsPage /></ProtectedRoute>} />
            <Route path="complaints" element={<ProtectedRoute roles={['owner','tenant']}><ComplaintsPage /></ProtectedRoute>} />
            <Route path="profile"    element={<ProfilePage />} />

            {/* Tenant only */}
            <Route path="my-room"    element={<ProtectedRoute roles={['tenant']}><MyRoomPage /></ProtectedRoute>} />
            <Route path="tenant/pay/:id" element={<ProtectedRoute roles={['tenant']}><TenantPaymentPage /></ProtectedRoute>} />

            {/* Super Admin only */}
            <Route path="users" element={<ProtectedRoute roles={['superadmin']}><UsersPage /></ProtectedRoute>} />
            <Route path="requests" element={<ProtectedRoute roles={['superadmin']}><AdminOwnerRequests /></ProtectedRoute>} />
            <Route path="audit-logs" element={<ProtectedRoute roles={['superadmin']}><AuditLogPage /></ProtectedRoute>} />
            <Route path="deletion-requests" element={<ProtectedRoute roles={['superadmin']}><AdminDeletionRequestsPage /></ProtectedRoute>} />
            <Route path="wallet-admin" element={<ProtectedRoute roles={['superadmin']}><AdminWalletPage /></ProtectedRoute>} />

            {/* Owner only */}
            <Route path="wallet" element={<ProtectedRoute roles={['owner']}><WalletPage /></ProtectedRoute>} />
            <Route path="owner/deletion-requests" element={<ProtectedRoute roles={['owner', 'superadmin']}><OwnerDeletionRequestsPage /></ProtectedRoute>} />

            {/* Catch-all → 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Root redirect (fallback) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
  </SplashScreen>
);

const App = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;
