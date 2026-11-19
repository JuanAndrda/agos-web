// listings.js: our own listings API, 5 endpoints. React calls these instead of talking to
// Firestore directly, so the server can check every request before it touches the database.
// Read each endpoint top to bottom. Every one follows the same steps:
//   check who it is (requireLogin, requireFarmer) -> check the data -> use the database ->
//   answer with a STATUS CODE and JSON: res.status(201).json(...)
// Status codes we use: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized (in auth.js),
// 403 Forbidden, 404 Not Found, 409 Conflict, 500 Internal Server Error, 503 Service Unavailable.
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

// Counts the orders of one listing that are still "open": "pending" (waiting for the farmer)
// or "accepted" (the deal is agreed). Declined, cancelled and completed orders don't count.
// While a listing has open orders, it is LOCKED: it can't be deleted, and its crop, price and
// town can't change, so the farmer can't change the deal after a buyer asked for it.
function countOpenOrders(orderDocs) {
  let pending = 0;
  let accepted = 0;
  for (const doc of orderDocs) {
    if (doc.data().status === "pending") pending++;
    if (doc.data().status === "accepted") accepted++;
  }
  return { pending: pending, accepted: accepted };
}

// The fields a buyer agreed to. They are locked while the listing has open orders.
const LOCKED_FIELDS = ["crop", "pricePerKg", "town"];

// "2 orders waiting and 1 accepted" -> used in the 409 messages
function describeOrders(open) {
  const parts = [];
  if (open.pending > 0) parts.push(`${open.pending} order${open.pending === 1 ? "" : "s"} waiting`);
  if (open.accepted > 0) parts.push(`${open.accepted} accepted`);
  return parts.join(" and ");
}

// Runs before every endpoint below: is the server connected to Firebase? (See firebaseAdmin.js.)
router.use((req, res, next) => {
  if (!adminDb) {
    // 503 Service Unavailable: the server is running, but this part can't work right now
    return res.status(503).json({
      error: "The listings are off because our server has no Firebase key yet. Add server/serviceAccountKey.json (README step 4), then restart the server.",
    });
  }
  next();
});

// ---- GET /api/listings: every listing that is still available, newest first (Marketplace) ----
router.get("/", requireLogin, async (req, res) => {
  try {
    // 1. Use the database: read the listings whose status is "available"
    const snapshot = await adminDb.collection("listings").where("status", "==", "available").get();
    const listings = snapshot.docs.map(toJson);
    listings.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    // 2. Answer: 200 OK with the list
    res.status(200).json(listings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "We couldn't load the listings. Please try again." }); // 500 Internal Server Error
  }
});

// ---- GET /api/listings/mine: the farmer's own listings, available and sold (My Listings) ----
router.get("/mine", requireLogin, requireFarmer, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("listings").where("ownerId", "==", req.user.uid).get();
    // Also read this farmer's orders, so each listing can say how many open orders it has.
    // The website uses it to show the lock and to turn off the Delete button.
    const orders = await adminDb.collection("orders").where("farmerId", "==", req.user.uid).get();

    const listings = snapshot.docs.map((doc) => {
      const listing = toJson(doc);
      const myOrders = orders.docs.filter((order) => order.data().listingId === doc.id);
      const open = countOpenOrders(myOrders);
      listing.pendingOrders = open.pending;
      listing.acceptedOrders = open.accepted;
      return listing;
    });
    res.status(200).json(listings); // 200 OK
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "We couldn't load your listings. Please try again." }); // 500
  }
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

  // 2. Check the data
  const problems = findProblems(listing);
  if (problems.length > 0) {
    return res.status(400).json({ error: problems.join(" ") }); // 400 Bad Request: wrong data
  }

  try {
    // 3. Use the database: save it. The SERVER fills in the owner from the checked token,
    //    so nobody can post a listing in someone else's name.
    const ref = await adminDb.collection("listings").add({
      ...listing,
      ownerId: req.user.uid,
      ownerName: req.user.name || "",
      createdAt: FieldValue.serverTimestamp(), // Firebase fills in the date and time
    });
    const saved = await ref.get();

    // 4. Answer: 201 Created, with the new listing
    res.status(201).json(toJson(saved));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "We couldn't save your listing. Please try again." }); // 500
  }
});

// ---- PATCH /api/listings/:id: edit a listing, or mark it sold (the owner only) ----
// PATCH means "change only the fields I send". Mark as sold sends just { status: "sold" }.
// ":id" is a route parameter: for /api/listings/abc123, req.params.id is "abc123".
router.patch("/:id", requireLogin, async (req, res) => {
  try {
    // A TRANSACTION, like in orders.js: we read the listing AND its orders, and save only if
    // nothing changed in between (so a buyer can't order at the same moment the price changes).
    // It gives back { status, error } when something is wrong, or { status: 200, listing }.
    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. Does the listing exist, and is it yours?
      const ref = adminDb.collection("listings").doc(req.params.id);
      const current = await transaction.get(ref);
      if (!current.exists) {
        return { status: 404, error: "This listing doesn't exist anymore. It may have been deleted." }; // 404 Not Found
      }
      if (current.data().ownerId !== req.user.uid) {
        return { status: 403, error: "You can only change your own listings." }; // 403 Forbidden
      }

      // 2. Check the data
      const changes = pickFields(req.body || {});
      if (Object.keys(changes).length === 0) {
        return { status: 400, error: "Nothing to change. Send at least one field, like status." }; // 400
      }
      const problems = findProblems(changes);
      if (problems.length > 0) {
        return { status: 400, error: problems.join(" ") }; // 400 Bad Request
      }

      // 3. The lock: if buyers have open orders, the crop, price and town can't change.
      //    (Kilos, harvest date, contact number, notes and status can still change.)
      const orders = await transaction.get(adminDb.collection("orders").where("listingId", "==", req.params.id));
      const open = countOpenOrders(orders.docs);
      if (open.pending + open.accepted > 0) {
        for (const field of LOCKED_FIELDS) {
          if (field in changes && changes[field] !== current.data()[field]) {
            // 409 Conflict: the change clashes with orders that buyers already sent
            return {
              status: 409,
              error: `This listing has ${describeOrders(open)}, so its crop, price and town are locked. You can still change the kilos, harvest date, contact number and notes.`,
            };
          }
        }
      }

      // 4. Use the database: save only the changed fields
      transaction.update(ref, changes);
      const updated = toJson(current);
      for (const field in changes) updated[field] = changes[field];
      return { status: 200, listing: updated };
    });

    // 5. Answer
    if (result.error) {
      return res.status(result.status).json({ error: result.error }); // 400, 403, 404 or 409
    }
    res.status(200).json(result.listing); // 200 OK, with the updated listing
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "We couldn't save your changes. Please try again." }); // 500
  }
});

// ---- DELETE /api/listings/:id: remove a listing (the owner only) ----
router.delete("/:id", requireLogin, async (req, res) => {
  try {
    // A transaction again: read the listing and its orders, then delete only if it's allowed
    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. Does the listing exist, and is it yours?
      const ref = adminDb.collection("listings").doc(req.params.id);
      const current = await transaction.get(ref);
      if (!current.exists) {
        return { status: 404, error: "This listing doesn't exist anymore. It may have been deleted." }; // 404
      }
      if (current.data().ownerId !== req.user.uid) {
        return { status: 403, error: "You can only delete your own listings." }; // 403 Forbidden
      }

      // 2. The lock: a listing with waiting or accepted orders can't be deleted
      const orders = await transaction.get(adminDb.collection("orders").where("listingId", "==", req.params.id));
      const open = countOpenOrders(orders.docs);
      if (open.pending + open.accepted > 0) {
        return {
          status: 409, // 409 Conflict
          error: `You can't delete this listing yet: it has ${describeOrders(open)}. Accept or decline the waiting orders, and mark the accepted ones as completed first. You can mark it as sold to hide it from the Marketplace.`,
        };
      }

      // 3. Use the database: delete it. Old orders keep their own copy of the crop and price.
      transaction.delete(ref);
      return { status: 200 };
    });

    // 4. Answer
    if (result.error) {
      return res.status(result.status).json({ error: result.error }); // 403, 404 or 409
    }
    res.status(200).json({ message: "Listing deleted." }); // 200 OK
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "We couldn't delete your listing. Please try again." }); // 500
  }
});

export default router;
