// Navbar.js: the white bar at the top. NavLink is React Router's Link that also knows
// which page is open, so we can highlight it. Moving between pages doesn't reload the
// whole page: that is what makes our app a single-page application (SPA).
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";
import Logo from "./Logo";

// "Ana Reyes" -> "AR", for the round avatar. One-word names give one letter.
function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const shownName = user ? user.name || user.email : "";

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <Logo />
          AgosUgnayan
        </Link>

        {user && (
          <nav className="nav-links" aria-label="Main">
            <NavLink to="/prices">Market Prices</NavLink>
            <NavLink to="/marketplace">Marketplace</NavLink>
            {user.role === "farmer" && <NavLink to="/my-listings">My Listings</NavLink>}
          </nav>
        )}

        <div className="nav-user">
          {user ? (
            <>
              <span className="user-name">
                <span className="avatar" aria-hidden="true">
                  {initials(shownName)}
                </span>
                {/* A long name is cut short with "..." by App.css. "title" shows the full name
                    when you point at it with the mouse. */}
                <span className="user-name-text" title={shownName}>
                  {shownName}
                </span>
                {user.role && <span className="role-badge">{user.role === "farmer" ? "Farmer" : "Buyer"}</span>}
              </span>
              <button type="button" className="btn btn-light" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-light">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-pill nav-signup">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
