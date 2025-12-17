import { Navigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";

// Social login handles registration automatically
// Redirect to login page
export function RegisterPage() {
	return <Navigate to={ROUTES.LOGIN} replace />;
}
