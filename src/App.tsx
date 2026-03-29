import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DisclaimerBanner, FirstUseDisclaimer } from "@/components/DisclaimerBanner";
import MobileBottomNav from "./components/MobileBottomNav";
import { useAndroidStatusBar } from "@/hooks/useAndroidStatusBar";
import Index from "./pages/Index.tsx";
import Portfolio from "./pages/Portfolio.tsx";
import CryptoPage from "./pages/CryptoPage.tsx";
import ChartsPage from "./pages/ChartsPage.tsx";
import BacktestPage from "./pages/BacktestPage.tsx";
import StrategyBuilderPage from "./pages/StrategyBuilderPage.tsx";
import DisclaimerPage from "./pages/DisclaimerPage.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import TermsOfService from "./pages/TermsOfService.tsx";
import MorePage from "./pages/MorePage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

/** Re-applies native status bar config on every route change */
function StatusBarGuard() {
  useAndroidStatusBar(false);
  return null;
}

const App = () => {
  useEffect(() => {
    document.title = "AlgoInsight v1.1 — AI Market Analysis";
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <FirstUseDisclaimer />
        <BrowserRouter>
          <StatusBarGuard />
          <DisclaimerBanner />
          <Routes>
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
            <Route path="/crypto" element={<ProtectedRoute><CryptoPage /></ProtectedRoute>} />
            <Route path="/charts" element={<ProtectedRoute><ChartsPage /></ProtectedRoute>} />
            <Route path="/backtest" element={<ProtectedRoute><BacktestPage /></ProtectedRoute>} />
            <Route path="/strategy-builder" element={<ProtectedRoute><StrategyBuilderPage /></ProtectedRoute>} />
            <Route path="/more" element={<ProtectedRoute><MorePage /></ProtectedRoute>} />
            <Route path="/disclaimer" element={<ProtectedRoute><DisclaimerPage /></ProtectedRoute>} />
            <Route path="/privacy" element={<ProtectedRoute><PrivacyPolicy /></ProtectedRoute>} />
            <Route path="/terms" element={<ProtectedRoute><TermsOfService /></ProtectedRoute>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/* Let Lovable Cloud handle OAuth callback — render nothing so it doesn't 404 */}
            <Route path="/~oauth" element={null} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <MobileBottomNav />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
