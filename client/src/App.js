// App.js: the top of our app. It has two jobs:
// 1. It remembers WHO is logged in (user) and WHAT is in the buyer's cart (cart) with useState,
//    and passes them down to the pages as PROPS, like <Marketplace user={user} />.
// 2. The routes: it decides which page shows for each URL, like the React lesson.
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import "./App.css";
import { auth, firebaseReady } from "./firebase";
import { getProfile } from "./services/authService";
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
  const [user, setUser] = useState(null); // null = nobody is logged in. Else { uid, email, name, role }
  const [checkingLogin, setCheckingLogin] = useState(true); // true until Firebase tells us who it is
  // The buyer's cart. Each item: { listing: { id, crop, pricePerKg, ... }, quantityKg: 5 }
  // It lives only here in React state: it is empty again after a page reload or log out.
  const [cart, setCart] = useState([]);

  // Reads the person's name and role from Firestore and saves the user in state
  async function loadUser(firebaseUser) {
    if (!firebaseUser) {
      setUser(null);
      return;
    }
    let profile = null;
    try {
      profile = await getProfile(firebaseUser.uid); // { name, email, role }
    } catch (err) {
      console.error("Could not read the profile:", err);
    }
    setUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: profile ? profile.name : "",
      role: profile ? profile.role : "",
    });
  }

  // When the app opens, ask Firebase to tell us whenever someone logs in or out.
  // onAuthStateChanged is like a doorbell: Firebase rings it on every log in and log out.
  useEffect(() => {
    if (!firebaseReady) return;
    const stopListening = onAuthStateChanged(auth, async (firebaseUser) => {
      setCart([]); // a different person (or nobody) is logged in now: start with an empty cart
      await loadUser(firebaseUser);
      setCheckingLogin(false);
    });
    return stopListening; // stop listening when the app closes
  }, []);

  // Register uses this: the name and role are saved a moment AFTER Firebase logs the new
  // person in, so we read the profile again.
  function refreshUser() {
    return loadUser(auth.currentUser);
  }

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
    <BrowserRouter>
      <MainLayout user={user} cart={cart}>
        <Routes>
          <Route path="/login" element={<Login user={user} />} />
          <Route path="/register" element={<Register user={user} refreshUser={refreshUser} />} />
          {/* The landing page: anyone can see it, so it has no ProtectedRoute */}
          <Route path="/" element={<Home user={user} />} />
          {/* ProtectedRoute: only for logged-in people (and for some pages, only one role) */}
          <Route
            path="/prices"
            element={
              <ProtectedRoute user={user} checkingLogin={checkingLogin}>
                <MarketPrices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crops/:cropName"
            element={
              <ProtectedRoute user={user} checkingLogin={checkingLogin}>
                <CropDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace"
            element={
              <ProtectedRoute user={user} checkingLogin={checkingLogin}>
                <Marketplace user={user} cart={cart} setCart={setCart} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-listings"
            element={
              <ProtectedRoute user={user} checkingLogin={checkingLogin} role="farmer">
                <MyListings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <ProtectedRoute user={user} checkingLogin={checkingLogin} role="buyer">
                <Cart cart={cart} setCart={setCart} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute user={user} checkingLogin={checkingLogin}>
                <Orders user={user} />
              </ProtectedRoute>
            }
          />
          {/* Any other URL goes back to the landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
