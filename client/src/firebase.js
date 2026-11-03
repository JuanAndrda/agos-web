// firebase.js: connects our React app to Firebase (Authentication for login, Firestore for data).
// The keys are read from client/.env, so they are never written in our code or uploaded to GitHub.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// true only when client/.env has our keys. Without them, getAuth() would crash the whole app,
// so App.js shows a "keys are missing" message instead.
export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
export const auth = firebaseReady ? getAuth(app) : null; // login
export const db = getFirestore(app); // database
