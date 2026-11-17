// AuthPanel.js: the green welcome panel on the left of Log in and Register (the "split screen").
// It only shows text, so both pages can share it. On a phone, App.css hides the list to save space.
import Logo from "./Logo";

function AuthPanel() {
  return (
    <aside className="auth-panel">
      <p className="auth-panel-brand">
        <Logo />
        AgosUgnayan
      </p>
      <h2>Fair crop prices for Iloilo farmers and buyers.</h2>
      <ul>
        <li>Monthly farmgate prices from PSA</li>
        <li>Crops for sale, straight from the farm</li>
        <li>Call or text the farmer directly</li>
      </ul>
    </aside>
  );
}

export default AuthPanel;
