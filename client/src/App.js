// App.js: the routes. It decides which page shows for each URL, like the React lesson.
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { firebaseReady } from "./firebase";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MarketPrices from "./pages/MarketPrices";
import CropDetails from "./pages/CropDetails";
import Marketplace from "./pages/Marketplace";
import MyListings from "./pages/MyListings";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";

function App() {
  // No Firebase keys in client/.env yet: explain how to fix it instead of showing a blank page
  if (!firebaseReady) {
    return (
      <div className="setup-message" role="alert">
        <h1>Firebase keys are missing</h1>
        <p>
          Copy <code>client/.env.example</code> to <code>client/.env</code>, paste your Firebase
          keys, then stop <code>npm start</code> and run it again.
        </p>
      </div>
    );
  }

  return (
    <AuthProvider>
      {/* CartProvider sits inside AuthProvider, because the cart empties when the user changes */}
      <CartProvider>
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* The landing page: anyone can see it, so it has no ProtectedRoute */}
            <Route path="/" element={<Home />} />
            <Route path="/prices" element={<ProtectedRoute><MarketPrices /></ProtectedRoute>} />
            <Route path="/crops/:cropName" element={<ProtectedRoute><CropDetails /></ProtectedRoute>} />
            <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
            <Route path="/my-listings" element={<ProtectedRoute role="farmer"><MyListings /></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            {/* Any other URL goes back to the landing page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
