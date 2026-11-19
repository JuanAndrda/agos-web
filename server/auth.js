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
    // 401 Unauthorized: we don't know who you are, because no login token was sent
    return res.status(401).json({ error: "Please log in first." });
  }

  // 1. Firebase checks that the token is real and not expired
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    // 401 Unauthorized: the token is fake or too old
    return res.status(401).json({ error: "Your login has expired. Please log out and log in again." });
  }

  // 2. Read the person's name and role from the "users" collection
  try {
    const profile = await adminDb.collection("users").doc(decoded.uid).get();
    req.user = { uid: decoded.uid, ...profile.data() }; // { uid, name, email, role }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "We couldn't check your account. Please try again." }); // 500
  }
  next(); // OK, go on to the route
}

// Is this person a farmer? (Use it after requireLogin.)
export function requireFarmer(req, res, next) {
  if (req.user.role !== "farmer") {
    // 403 Forbidden: we know who you are (you are logged in), but you are not allowed to do this
    return res.status(403).json({ error: "Only farmers can do this." });
  }
  next();
}

// Is this person a buyer? (Use it after requireLogin.) Only buyers can place orders.
export function requireBuyer(req, res, next) {
  if (req.user.role !== "buyer") {
    // 403 Forbidden
    return res.status(403).json({ error: "Only buyers can place orders." });
  }
  next();
}
