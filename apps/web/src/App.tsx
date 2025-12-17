import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Routes, Route } from "react-router-dom";
import { queryClient } from "./lib/query-client";
import { ROUTES } from "./lib/routes";

// Layouts
import { PublicLayout } from "./layouts/public-layout";
import { DashboardLayout } from "./layouts/dashboard-layout";

// Pages
import { LandingPage } from "./pages/landing";
import { PricingPage } from "./pages/pricing";
import { LoginPage } from "./pages/login";
import { RegisterPage } from "./pages/register";
import { DashboardPage } from "./pages/dashboard/index";
import { SettingsPage } from "./pages/dashboard/settings";
import { BillingPage } from "./pages/dashboard/billing";
import { OrdersPage } from "./pages/dashboard/orders";
import { NotFoundPage } from "./pages/not-found";

function App() {
	return (
		<QueryClientProvider client={queryClient}>
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
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	);
}

export default App;
