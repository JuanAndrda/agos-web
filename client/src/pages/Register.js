// Register.js: the sign-up page. The person chooses Farmer or Buyer.
// register() makes the login in Firebase Authentication and saves the name and role in Firestore.
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { register, friendlyAuthError } from "../services/authService";

function Register() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Logged in and done saving? Go to the prices.
  if (user && !saving && !error) return <Navigate to="/prices" replace />;

  // Returns a message for the first problem in the form, or "" if it's fine
  function checkForm() {
    if (!name.trim()) return "Please enter your name.";
    if (!email.trim()) return "Please enter your email.";
    if (password.length < 6) return "Your password must be at least 6 characters.";
    if (!role) return "Please choose Farmer or Buyer.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = checkForm();
    setError(problem);
    if (problem) return;

    setSaving(true);
    try {
      await register(name.trim(), email.trim(), password, role);
      await refreshUser(); // read the new name and role into AuthContext
    } catch (err) {
      setError(friendlyAuthError(err));
    }
    setSaving(false);
  }

  return (
    <section className="auth-card">
      <h1>Create an account</h1>
      <p className="muted">It's free. Farmers post crops, and buyers look for crops to buy.</p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            autoComplete="name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            aria-describedby="password-help"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id="password-help" className="help">
            At least 6 characters.
          </p>
        </div>

        <fieldset className="field role-choice">
          <legend>I am a...</legend>
          <label className={role === "farmer" ? "role-option selected" : "role-option"}>
            <input
              type="radio"
              name="role"
              value="farmer"
              checked={role === "farmer"}
              onChange={(e) => setRole(e.target.value)}
            />
            <span>
              <strong>Farmer</strong>
              <span className="muted">I grow crops and want to sell them</span>
            </span>
          </label>
          <label className={role === "buyer" ? "role-option selected" : "role-option"}>
            <input
              type="radio"
              name="role"
              value="buyer"
              checked={role === "buyer"}
              onChange={(e) => setRole(e.target.value)}
            />
            <span>
              <strong>Buyer</strong>
              <span className="muted">I buy crops for my business or home</span>
            </span>
          </label>
        </fieldset>

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? "Creating your account..." : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}

export default Register;
