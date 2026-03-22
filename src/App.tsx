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
import AdDebugOverlay from "./components/AdDebugOverlay";
import Index from "./pages/Index.tsx";
import Portfolio from "./pages/Portfolio.tsx";
import CryptoPage from "./pages/CryptoPage.tsx";
import BacktestPage from "./pages/BacktestPage.tsx";
import StrategyBuilderPage from "./pages/StrategyBuilderPage.tsx";
import DisclaimerPage from "./pages/DisclaimerPage.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import TermsOfService from "./pages/TermsOfService.tsx";
import MorePage from "./pages/MorePage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    document.title = "AlgoInsight — AI Market Analysis";
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <FirstUseDisclaimer />
        <BrowserRouter>
          <DisclaimerBanner />
          <Routes>
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
            <Route path="/crypto" element={<ProtectedRoute><CryptoPage /></ProtectedRoute>} />
            <Route path="/backtest" element={<ProtectedRoute><BacktestPage /></ProtectedRoute>} />
            <Route path="/strategy-builder" element={<ProtectedRoute><StrategyBuilderPage /></ProtectedRoute>} />
            <Route path="/more" element={<ProtectedRoute><MorePage /></ProtectedRoute>} />
            <Route path="/disclaimer" element={<ProtectedRoute><DisclaimerPage /></ProtectedRoute>} />
            <Route path="/privacy" element={<ProtectedRoute><PrivacyPolicy /></ProtectedRoute>} />
            <Route path="/terms" element={<ProtectedRoute><TermsOfService /></ProtectedRoute>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <MobileBottomNav />
          <AdDebugOverlay />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
