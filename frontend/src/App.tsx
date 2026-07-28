import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/useAuth";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/Landing";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import DashboardPage from "./pages/Dashboard";
import UploadPage from "./pages/Upload";
import JobDetailPage from "./pages/JobDetail";
import JobReportPage from "./pages/JobReport";
import PricingPage from "./pages/Pricing";
import PaymentSuccessPage from "./pages/PaymentSuccess";
import TermsPage from "./pages/Terms";
import PrivacyPage from "./pages/Privacy";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Standalone report page — no Layout wrapper for print optimization */}
        <Route
          path="/jobs/:id/report"
          element={
            <ProtectedRoute>
              <JobReportPage />
            </ProtectedRoute>
          }
        />
        {/* All other routes inside Layout */}
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/payment/success" element={<PaymentSuccessPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/upload"
                  element={
                    <ProtectedRoute>
                      <UploadPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/jobs/:id"
                  element={
                    <ProtectedRoute>
                      <JobDetailPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
