// Navbar.js: the white bar at the top. NavLink is React Router's Link that also knows
// which page is open, so we can highlight it. Moving between pages doesn't reload the
// whole page: that is what makes our app a single-page application (SPA).
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
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
  const { items } = useCart();
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
            <NavLink to="/orders">Orders</NavLink>
          </nav>
        )}

        <div className="nav-user">
          {user ? (
            <>
              {/* The cart button, for buyers only, shows how many listings are in the cart */}
              {user.role === "buyer" && (
                <NavLink
                  to="/cart"
                  className="cart-link"
                  aria-label={`Cart, ${items.length} item${items.length === 1 ? "" : "s"}`}
                >
                  {/* A small cart drawing made with SVG lines, like Logo.js */}
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="20" r="1.5" />
                    <circle cx="18" cy="20" r="1.5" />
                    <path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6" />
                  </svg>
                  {items.length > 0 && <span className="cart-count">{items.length}</span>}
                </NavLink>
              )}
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
