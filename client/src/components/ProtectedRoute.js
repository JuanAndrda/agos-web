// ProtectedRoute.js: a guard around pages that need login. App.js gives it the user as a prop.
// Not logged in -> go to /login. Wrong role (a buyer on My Listings) -> go to the Marketplace.
import { Navigate, useLocation } from "react-router-dom";
import Loading from "./Loading";

function ProtectedRoute({ user, checkingLogin, role, children }) {
  // useLocation() tells us which page the person tried to open, like "/crops/Tomato"
  const location = useLocation();

  if (checkingLogin) return <Loading text="Checking your login..." />;
  // "state" sends that page along to the Login page, so it can bring the person back after login
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to="/marketplace" replace />;
  return children;
}

export default ProtectedRoute;
