// ProtectedRoute.js: a guard around pages that need login.
// Not logged in -> go to /login. Wrong role (a buyer on My Listings) -> go to the Marketplace.
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "./Loading";

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return <Loading text="Checking your login..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/marketplace" replace />;
  return children;
}

export default ProtectedRoute;
