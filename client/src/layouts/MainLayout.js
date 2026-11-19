// MainLayout.js: the frame every page sits in. "children" is whichever page is open.
// It passes the user and the cart on to the Navbar, which shows the name and the cart count.
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function MainLayout({ user, cart, children }) {
  return (
    <div className="layout">
      <Navbar user={user} cart={cart} />
      <main className="content">{children}</main>
      <Footer />
    </div>
  );
}

export default MainLayout;
