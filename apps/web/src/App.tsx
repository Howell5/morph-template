import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/error-boundary";
import { FeedbackModal } from "./components/modals/feedback-modal";
import { PricingModal } from "./components/modals/pricing-modal";
import { ReferralModal } from "./components/modals/referral-modal";
import { SettingsModal } from "./components/modals/settings-modal";
import { queryClient } from "./lib/query-client";
import { ROUTES } from "./lib/routes";

import { DashboardLayout } from "./layouts/dashboard-layout";
// Layouts
import { PublicLayout } from "./layouts/public-layout";

import { BillingPage } from "./pages/dashboard/billing";
import { DashboardPage } from "./pages/dashboard/index";
import { OrdersPage } from "./pages/dashboard/orders";
import { SettingsPage } from "./pages/dashboard/settings";
// Pages
import { LandingPage } from "./pages/landing";
import { LoginPage } from "./pages/login";
import { NotFoundPage } from "./pages/not-found";
import { PricingPage } from "./pages/pricing";
import { RegisterPage } from "./pages/register";
import { FeedbackProvider } from "./providers/feedback-provider";
import { PaywallProvider } from "./providers/paywall-provider";
import { PricingProvider } from "./providers/pricing-provider";
import { ReferralProvider } from "./providers/referral-provider";
import { SettingsProvider } from "./providers/settings-provider";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PaywallProvider>
          <PricingProvider>
            <SettingsProvider>
              <FeedbackProvider>
                <ReferralProvider>
                  <Routes>
                    {/* Public routes */}
                    <Route element={<PublicLayout />}>
                      <Route path={ROUTES.HOME} element={<LandingPage />} />
                      <Route path={ROUTES.PRICING} element={<PricingPage />} />
                      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                      <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
                    </Route>

                    {/* Protected routes */}
                    <Route element={<DashboardLayout />}>
                      <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
                      <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
                      <Route path={ROUTES.BILLING} element={<BillingPage />} />
                      <Route path={ROUTES.ORDERS} element={<OrdersPage />} />
                    </Route>

                    {/* 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                  <PricingModal />
                  <SettingsModal />
                  <FeedbackModal />
                  <ReferralModal />
                </ReferralProvider>
              </FeedbackProvider>
            </SettingsProvider>
          </PricingProvider>
        </PaywallProvider>
        <ReactQueryDevtools initialIsOpen={false} />
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
