// Login.js: the log-in page. It checks the form, calls login() from authService,
// and shows a friendly message if Firebase says no.
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login, friendlyAuthError } from "../services/authService";

function Login() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // The name in the browser tab
  useEffect(() => {
    document.title = "Log in · AgosUgnayan Web";
  }, []);

  // Already logged in? Go to the prices. (This also runs right after a successful login.)
  if (user) return <Navigate to="/prices" replace />;

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
      // AuthContext now gets the user, and the check above sends us to /prices
    } catch (err) {
      setError(friendlyAuthError(err));
      setSaving(false);
    }
  }

  return (
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
  );
}

export default Login;
