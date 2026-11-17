// Register.js: the sign-up page. The person chooses Farmer or Buyer.
// register() makes the login in Firebase Authentication and saves the name and role in Firestore.
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthPanel from "../components/AuthPanel";
import { register, friendlyAuthError } from "../services/authService";

// The fields in the order they appear on screen. Each one is also the id of its input
// (for "role", the Farmer choice has id="role").
const FIELD_ORDER = ["name", "email", "password", "role"];

function Register() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [errors, setErrors] = useState({}); // one message per wrong field, like { name: "..." }
  const [error, setError] = useState(""); // a message from Firebase, like "This email already has an account."
  const [saving, setSaving] = useState(false);

  // The name in the browser tab
  useEffect(() => {
    document.title = "Create an account · AgosUgnayan Web";
  }, []);

  // After a failed try, put the cursor in the first field that needs fixing
  useEffect(() => {
    const firstProblem = FIELD_ORDER.find((field) => errors[field]);
    if (firstProblem) document.getElementById(firstProblem).focus();
  }, [errors]);

  // Logged in and done saving? Go to the prices.
  if (user && !saving && !error) return <Navigate to="/prices" replace />;

  // Returns an object with one message per wrong field (empty when everything is fine).
  // Same idea as checkForm() in ListingForm.js, so both forms behave the same way.
  function checkForm() {
    const problems = {};
    if (!name.trim()) problems.name = "Please enter your name.";
    if (!email.trim()) problems.email = "Please enter your email.";
    if (password.length < 6) problems.password = "Your password must be at least 6 characters.";
    if (!role) problems.role = "Please choose Farmer or Buyer.";
    return problems;
  }

  // Shows the message under a field when it has a problem
  function fieldError(field) {
    return errors[field] ? (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const problems = checkForm();
    setErrors(problems);
    if (Object.keys(problems).length > 0) return; // stop: something needs fixing

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
    // auth-page puts the green AuthPanel and the form side by side (the "split screen")
    <div className="auth-page">
      <AuthPanel />
      <section className="auth-card">
        <h1>Create an account</h1>
        <p className="muted">It's free. Farmers post crops, and buyers look for crops to buy.</p>

        {Object.keys(errors).length > 0 && (
          <p className="form-error" role="alert">
            Please fix the fields marked below.
          </p>
        )}
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
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {fieldError("name")}
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {fieldError("email")}
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : "password-help"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldError("password") || (
              <p id="password-help" className="help">
                At least 6 characters.
              </p>
            )}
          </div>

          <fieldset
            className="field role-choice"
            aria-describedby={errors.role ? "role-error" : undefined}
          >
            <legend>I am a...</legend>
            <label className={role === "farmer" ? "role-option selected" : "role-option"}>
              <input
                id="role"
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
            {fieldError("role")}
          </fieldset>

          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? "Creating your account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </div>
  );
}

export default Register;
