// Navbar.js: the green bar at the top. NavLink is React Router's Link that also knows
// which page is open, so we can highlight it. Moving between pages doesn't reload the
// whole page: that is what makes our app a single-page application (SPA).
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";

function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/prices" className="brand">
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
                {/* A long name is cut short with "..." by App.css. "title" shows the full name
                    when you point at it with the mouse. */}
                <span className="user-name-text" title={user.name || user.email}>
                  {user.name || user.email}
                </span>
                {user.role && <span className="role-badge">{user.role === "farmer" ? "Farmer" : "Buyer"}</span>}
              </span>
              <button type="button" className="btn btn-light" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
