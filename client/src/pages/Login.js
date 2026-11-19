// Login.js: the log-in page. It checks the form, calls login() from authService,
// and shows a friendly message if Firebase says no.
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import AuthPanel from "../components/AuthPanel";
import { login, friendlyAuthError } from "../services/authService";

// user is a prop from App.js: null when nobody is logged in
function Login({ user }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // If ProtectedRoute sent us here from a page (like /crops/Tomato), it saved that page in
  // location.state.from, so we can go back there after login. Otherwise we go to /prices.
  const location = useLocation();
  const goTo = location.state && location.state.from ? location.state.from : "/prices";

  // The name in the browser tab
  useEffect(() => {
    document.title = "Log in · AgosUgnayan Web";
  }, []);

  // Already logged in? Go to the page you wanted, or the prices. (This also runs right after a successful login.)
  if (user) return <Navigate to={goTo} replace />;

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    setError("");

    // 1. Check the form before calling Firebase
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    // 2. Ask Firebase to log in
    setSaving(true);
    try {
      await login(email.trim(), password);
      // App.js now gets the user from Firebase, and the check above sends us on
    } catch (err) {
      setError(friendlyAuthError(err));
      setSaving(false);
    }
  }

  return (
    // auth-page puts the green AuthPanel and the form side by side (the "split screen")
    <div className="auth-page">
      <AuthPanel />
      <section className="auth-card">
        <h1>Log in</h1>
        <p className="muted">See Iloilo crop prices and the marketplace.</p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </section>
    </div>
  );
}

export default Login;
