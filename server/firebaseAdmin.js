// firebaseAdmin.js: connects our SERVER to our Firebase project. It is the server's version of
// client/src/firebase.js, but with full access: it can check login tokens and read and write
// the whole database. The secret key file proves to Google that this server is really ours.
import { existsSync, readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// The key file sits next to this file: server/serviceAccountKey.json.
// It is in .gitignore, so it is never uploaded to GitHub. Never paste it in chat.
const KEY_FILE = new URL("./serviceAccountKey.json", import.meta.url);

let adminAuth = null; // checks login tokens
let adminDb = null; // reads and writes Firestore

// When the app is online (Vercel) there is no key file. The key is pasted as a Vercel
// environment variable called FIREBASE_SERVICE_ACCOUNT instead.
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    adminAuth = getAuth();
    adminDb = getFirestore();
  } catch (error) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON, so the listings API is off:", error.message);
  }
} else if (!existsSync(KEY_FILE)) {
  // Without the key, the price endpoints still work. The listings endpoints answer with a
  // clear message instead (see listings.js).
  console.warn("No serviceAccountKey.json in the server folder, so the listings API is off. See README step 4.");
} else {
  try {
    const serviceAccount = JSON.parse(readFileSync(KEY_FILE, "utf8"));
    initializeApp({ credential: cert(serviceAccount) });
    adminAuth = getAuth();
    adminDb = getFirestore();
  } catch (error) {
    console.error("serviceAccountKey.json is not a valid key file, so the listings API is off.");
    console.error("Download a new key (README step 4). Details:", error.message);
  }
}

export { adminAuth, adminDb };
