// listings.js: our own listings API, 5 endpoints. React calls these instead of talking to
// Firestore directly, so the server can check every request before it touches the database.
// Read each endpoint top to bottom: check who it is -> check the data -> use the database ->
// answer with a status code and JSON.
import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.js";
import { requireLogin, requireFarmer } from "./auth.js";
import { CROPS } from "./psa.js";

const router = express.Router();
const CROP_NAMES = CROPS.map((c) => c.name); // the same 10 crops as the price pages

// The only fields a farmer may send. Anything else, like ownerId, is ignored,
// so nobody can post a listing in someone else's name.
const FIELDS = ["crop", "quantityKg", "pricePerKg", "town", "harvestDate", "contactNumber", "notes", "status"];

// Copies only the allowed fields from what React sent, and makes the numbers real numbers
function pickFields(body) {
  const fields = {};
  for (const name of FIELDS) {
    if (body[name] !== undefined) fields[name] = body[name];
  }
  if ("quantityKg" in fields) fields.quantityKg = Number(fields.quantityKg);
  if ("pricePerKg" in fields) fields.pricePerKg = Number(fields.pricePerKg);
  return fields;
}

// Checks every field that was sent. Returns a list of problems (an empty list means OK).
// The form in React checks the same things first, but the server must check again,
// because anyone can send a request to our server without using our form.
function findProblems(f) {
  const problems = [];
  if ("crop" in f && !CROP_NAMES.includes(f.crop)) {
    problems.push("Choose one of our 10 crops.");
  }
  if ("quantityKg" in f && !(f.quantityKg > 0 && f.quantityKg <= 100000)) {
    problems.push("Quantity must be more than 0 kg and at most 100,000 kg.");
  }
  if ("pricePerKg" in f && !(f.pricePerKg > 0 && f.pricePerKg <= 10000)) {
    problems.push("Price must be more than ₱0 and at most ₱10,000 per kg.");
  }
  if ("town" in f && (typeof f.town !== "string" || f.town.trim() === "" || f.town.length > 50)) {
    problems.push("Choose your town.");
  }
  if ("harvestDate" in f && (typeof f.harvestDate !== "string" || (f.harvestDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(f.harvestDate)))) {
    problems.push("Harvest date must look like 2026-11-20, or be left empty.");
  }
  if ("contactNumber" in f && !/^(09\d{9}|\+639\d{9})$/.test(f.contactNumber)) {
    problems.push("Contact number must be a mobile number like 09171234567.");
  }
  if ("notes" in f && (typeof f.notes !== "string" || f.notes.length > 200)) {
    problems.push("Notes can be up to 200 characters.");
  }
  if ("status" in f && !["available", "sold"].includes(f.status)) {
    problems.push('Status must be "available" or "sold".');
  }
  return problems;
}

// Firestore gives the data and the ID separately, and saves the time as a Timestamp.
// We send React one plain object, with the time as text like "2026-11-15T12:30:00.000Z".
function toJson(doc) {
  const data = doc.data();
  return { id: doc.id, ...data, createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null };
}

// Runs before every endpoint below: is the server connected to Firebase? (See firebaseAdmin.js.)
router.use((req, res, next) => {
  if (!adminDb) {
    return res.status(503).json({
      error: "The listings are off because our server has no Firebase key yet. Add server/serviceAccountKey.json (README step 4), then restart the server.",
    });
  }
  next();
});

// ---- GET /api/listings: every listing that is still available, newest first (Marketplace) ----
router.get("/", requireLogin, async (req, res) => {
  const snapshot = await adminDb.collection("listings").where("status", "==", "available").get();
  const listings = snapshot.docs.map(toJson);
  listings.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  res.json(listings); // 200 OK
});

// ---- GET /api/listings/mine: the farmer's own listings, available and sold (My Listings) ----
router.get("/mine", requireLogin, requireFarmer, async (req, res) => {
  const snapshot = await adminDb.collection("listings").where("ownerId", "==", req.user.uid).get();
  res.json(snapshot.docs.map(toJson)); // 200 OK
});

// ---- POST /api/listings: post a new crop (farmers only) ----
router.post("/", requireLogin, requireFarmer, async (req, res) => {
  // 1. Build the new listing from the allowed fields. Missing fields start empty, so they fail the check.
  const listing = {
    crop: "",
    quantityKg: 0,
    pricePerKg: 0,
    town: "",
    harvestDate: "",
    contactNumber: "",
    notes: "",
    ...pickFields(req.body || {}),
    status: "available", // a new listing always starts as available
  };

  // 2. Check it
  const problems = findProblems(listing);
  if (problems.length > 0) {
    return res.status(400).json({ error: problems.join(" ") }); // 400 Bad Request
  }

  // 3. Save it. The SERVER fills in the owner from the checked token, so nobody can fake it.
  const ref = await adminDb.collection("listings").add({
    ...listing,
    ownerId: req.user.uid,
    ownerName: req.user.name || "",
    createdAt: FieldValue.serverTimestamp(), // Firebase fills in the date and time
  });
  res.status(201).json(toJson(await ref.get())); // 201 Created
});

// ---- PATCH /api/listings/:id: edit a listing, or mark it sold (the owner only) ----
// PATCH means "change only the fields I send". Mark as sold sends just { status: "sold" }.
router.patch("/:id", requireLogin, async (req, res) => {
  // 1. Does the listing exist, and is it yours?
  const ref = adminDb.collection("listings").doc(req.params.id);
  const current = await ref.get();
  if (!current.exists) {
    return res.status(404).json({ error: "This listing doesn't exist anymore. It may have been deleted." });
  }
  if (current.data().ownerId !== req.user.uid) {
    return res.status(403).json({ error: "You can only change your own listings." }); // 403 Forbidden
  }

  // 2. Check the changes
  const changes = pickFields(req.body || {});
  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ error: "Nothing to change. Send at least one field, like status." });
  }
  const problems = findProblems(changes);
  if (problems.length > 0) {
    return res.status(400).json({ error: problems.join(" ") });
  }

  // 3. Save only the changed fields, and send back the whole updated listing
  await ref.update(changes);
  res.json(toJson(await ref.get())); // 200 OK
});

// ---- DELETE /api/listings/:id: remove a listing (the owner only) ----
router.delete("/:id", requireLogin, async (req, res) => {
  const ref = adminDb.collection("listings").doc(req.params.id);
  const current = await ref.get();
  if (!current.exists) {
    return res.status(404).json({ error: "This listing doesn't exist anymore. It may have been deleted." });
  }
  if (current.data().ownerId !== req.user.uid) {
    return res.status(403).json({ error: "You can only delete your own listings." });
  }
  await ref.delete();
  res.json({ message: "Listing deleted." }); // 200 OK
});

export default router;
