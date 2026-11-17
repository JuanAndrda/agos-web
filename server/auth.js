// auth.js: middleware that checks WHO is sending a request.
// A middleware is a function that runs BEFORE the route. It either lets the request go on
// with next(), or stops it and answers with an error.
import { adminAuth, adminDb } from "./firebaseAdmin.js";

// Is this person logged in?
// When someone logs in, Firebase gives React a "token": a long code that proves who they are.
// React sends it with every request in a header: Authorization: Bearer <token>
export async function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Please log in first." });
  }

  // 1. Firebase checks that the token is real and not expired
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "Your login has expired. Please log out and log in again." });
  }

  // 2. Read the person's name and role from the "users" collection
  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  req.user = { uid: decoded.uid, ...profile.data() }; // { uid, name, email, role }
  next(); // OK, go on to the route
}

// Is this person a farmer? (Use it after requireLogin.)
export function requireFarmer(req, res, next) {
  if (req.user.role !== "farmer") {
    return res.status(403).json({ error: "Only farmers can do this." });
  }
  next();
}

// Is this person a buyer? (Use it after requireLogin.) Only buyers can place orders.
export function requireBuyer(req, res, next) {
  if (req.user.role !== "buyer") {
    return res.status(403).json({ error: "Only buyers can place orders." });
  }
  next();
}
