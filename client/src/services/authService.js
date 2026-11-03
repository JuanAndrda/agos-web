// authService.js: every login call to Firebase Authentication lives here.
// Firebase keeps the passwords safe. We only save each person's name and role in Firestore.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

// Make a new account, then save the name and role in the "users" collection.
// The document ID is the same as the login ID (uid), so we can always find it.
export async function register(name, email, password, role) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", result.user.uid), { name, email, role });
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

// Read one person's profile: { name, email, role }, or null if there is none
export async function getProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

// Firebase sends error codes like "auth/invalid-credential". We turn them into plain words.
export function friendlyAuthError(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password. Please check them and try again.";
    case "auth/email-already-in-use":
      return "This email already has an account. Log in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look right. Example: juan@gmail.com";
    case "auth/weak-password":
      return "Your password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many tries. Please wait a few minutes, then try again.";
    case "auth/network-request-failed":
      return "No internet connection. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
