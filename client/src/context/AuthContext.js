// AuthContext.js: remembers who is logged in, so every page can ask "who is this?"
// with useAuth(), without passing the user from page to page.
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { getProfile } from "../services/authService";

const AuthContext = createContext(null);

// Turns Firebase's login info into our user: { uid, email, name, role }
async function buildUser(firebaseUser) {
  if (!firebaseUser) return null;
  let profile = null;
  try {
    profile = await getProfile(firebaseUser.uid);
  } catch (error) {
    console.error("Could not read the profile:", error);
  }
  return { uid: firebaseUser.uid, email: firebaseUser.email, ...profile };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until Firebase tells us who it is

  useEffect(() => {
    // onAuthStateChanged is like a doorbell: Firebase rings it whenever someone logs in or out
    const stopListening = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(await buildUser(firebaseUser));
      setLoading(false);
    });
    return stopListening; // stop listening when the app closes
  }, []);

  // Read the profile again. Register uses this, because the name and role are saved
  // a moment AFTER Firebase has already logged the new person in.
  async function refreshUser() {
    setUser(await buildUser(auth.currentUser));
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Any page can call useAuth() to get { user, loading, refreshUser }
export function useAuth() {
  return useContext(AuthContext);
}
