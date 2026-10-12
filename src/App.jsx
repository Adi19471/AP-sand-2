/**
 * Provider stack and route table.
 *
 * SettingsProvider reads the signed-in user, so it must sit inside
 * AuthProvider. ToastProvider is independent but wraps the pages so any screen
 * can raise a banner.
 *
 * `/v/:token` sits outside every guard: it is the public page the receipt QR
 * code opens, so check-posts can verify a dispatch without an account.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { PlugZap } from 'lucide-react';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import ProtectedRoute from './components/ProtectedRoute';
import EmptyState from './components/EmptyState';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import GenerateReceipt from './pages/GenerateReceipt';
import LoginActivity from './pages/LoginActivity';
import Login from './pages/Login';
import Profile from './pages/Profile';
import ReceiptDetails from './pages/ReceiptDetails';
import ReceiptHistory from './pages/ReceiptHistory';
import Reports from './pages/Reports';
import ScanReceipt from './pages/ScanReceipt';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Vehicles from './pages/Vehicles';
import VerifyReceipt from './pages/VerifyReceipt';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './hooks/useSettings';
import { ToastProvider } from './hooks/useToast';
import { isFirebaseConfigured, missingFirebaseKeys } from './firebase/firebaseConfig';

/** Shown instead of the app when `.env.local` has not been filled in. */
const ConfigMissing = () => (
  <div className="app-content">
    <EmptyState
      icon={PlugZap}
      title="Firebase is not configured"
      message={`Copy .env.example to .env.local and fill in the values from the Firebase console. Missing: ${missingFirebaseKeys.join(', ')}`}
    />
  </div>
);

const App = () => {
  if (!isFirebaseConfigured) {
    return <ConfigMissing />;
  }

  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <Routes>
            {/* ------------------------------------------------ public */}
            {/* QR verification: opened by any phone camera, no login. */}
            <Route path="/v/:token" element={<VerifyReceipt />} />

            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
            </Route>
            {/* Accounts are no longer self-registered: sign in with Google and an
                administrator approves the account. Old bookmarks land on sign-in. */}
            <Route path="/signup" element={<Navigate to="/login" replace />} />

            {/* --------------------------------------------- signed in */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/receipts/new" element={<GenerateReceipt />} />
              <Route path="/receipts" element={<ReceiptHistory />} />
              <Route path="/receipts/:id" element={<ReceiptDetails />} />
              <Route path="/scan" element={<ScanReceipt />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/profile" element={<Profile />} />

              {/* ----------------------------------- administrators only */}
              <Route
                path="/users"
                element={
                  <ProtectedRoute adminOnly>
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/login-activity"
                element={
                  <ProtectedRoute adminOnly>
                    <LoginActivity />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute adminOnly>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute adminOnly>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
