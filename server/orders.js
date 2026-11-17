// orders.js: our orders API, 4 endpoints. A buyer puts crops in the cart and sends an
// "order request". There is no payment in our app: the farmer accepts or declines the request,
// and they agree on payment and pickup by phone.
//
// The important part is POST /api/orders. It uses a Firestore TRANSACTION, so two buyers who
// order the last 5 kg at the same moment can't both get them. A transaction reads the listings,
// checks them, and writes the changes as ONE step: if the stock changed while we were checking,
// Firestore runs our code again with the new numbers.
import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.js";
import { requireLogin } from "./auth.js";

const router = express.Router();
const MAX_ITEMS = 20; // the most different listings in one checkout

// Makes an error that also carries the HTTP status code we want to answer with,
// like problem(409, "Only 3 kg of Tomato left."). The route catches it and sends it to React.
function problem(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Sends a problem() to React, or passes a real crash on to the 500 handler in index.js
function sendProblem(res, error) {
  if (!error.status) throw error;
  res.status(error.status).json({ error: error.message });
}

// Firestore saves the time as a Timestamp. We send React text like "2026-11-17T12:30:00.000Z".
function toJson(doc) {
  const data = doc.data();
  return { id: doc.id, ...data, createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null };
}

// Newest orders first
function newestFirst(orders) {
  return orders.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

// Runs before every endpoint below: is the server connected to Firebase? (See firebaseAdmin.js.)
router.use((req, res, next) => {
  if (!adminDb) {
    return res.status(503).json({
      error: "Orders are off because our server has no Firebase key yet. Add server/serviceAccountKey.json (README step 4), then restart the server.",
    });
  }
  next();
});

// ---- POST /api/orders: send the cart as order requests (checkout) ----
// React sends: { items: [{ listingId: "abc123", quantityKg: 5 }, ...] }
// We make ONE order per listing, because each listing can be from a different farmer.
router.post("/", requireLogin, async (req, res) => {
  // 1. Check the shape of the cart before we touch the database
  const items = req.body && req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty. Add a crop from the Marketplace first." });
  }
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `You can order up to ${MAX_ITEMS} different listings at a time.` });
  }
  for (const item of items) {
    if (!item || typeof item.listingId !== "string" || item.listingId === "") {
      return res.status(400).json({ error: "Each item in the cart needs a listing." });
    }
    // Whole kilos only (1, 2, 5...), so the stock never becomes a number like 4.999999
    if (!Number.isInteger(item.quantityKg) || item.quantityKg <= 0) {
      return res.status(400).json({ error: "Order quantity must be a whole number of kilos, more than 0." });
    }
  }
  const ids = items.map((item) => item.listingId);
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: "The same listing is in the cart twice. Remove one of them." });
  }

  // 2. The transaction: read every listing, check every item, then write everything at once
  try {
    const orders = await adminDb.runTransaction(async (transaction) => {
      // 2a. READ: a transaction must do all its reads before any write
      const refs = ids.map((id) => adminDb.collection("listings").doc(id));
      const listings = await transaction.getAll(...refs);

      // 2b. CHECK each item. Throwing a problem() stops the transaction, so NOTHING is saved.
      listings.forEach((listing, i) => {
        const wanted = items[i].quantityKg;
        if (!listing.exists) {
          throw problem(404, "One of the crops in your cart was deleted by the farmer. Remove it and try again.");
        }
        const data = listing.data();
        if (data.ownerId === req.user.uid) {
          throw problem(403, `You can't order your own ${data.crop} listing.`);
        }
        if (data.status !== "available" || data.quantityKg <= 0) {
          throw problem(409, `${data.crop} from ${data.ownerName} is sold out. Remove it from your cart.`);
        }
        if (wanted > data.quantityKg) {
          throw problem(409, `Only ${data.quantityKg} kg of ${data.crop} from ${data.ownerName} is left. Lower the quantity.`);
        }
      });

      // 2c. WRITE: lower each listing's stock, and save one order per listing
      return listings.map((listing, i) => {
        const data = listing.data();
        const quantityKg = items[i].quantityKg;
        const left = Math.round((data.quantityKg - quantityKg) * 100) / 100; // rounded, so 12.3 - 12 is 0.3

        // Lower the stock. At 0 kg the listing is sold out, so it leaves the Marketplace.
        transaction.update(listing.ref, { quantityKg: left, ...(left === 0 && { status: "sold" }) });

        const order = {
          listingId: listing.id,
          crop: data.crop,
          quantityKg,
          pricePerKg: data.pricePerKg, // the price at the time of ordering
          total: Math.round(quantityKg * data.pricePerKg * 100) / 100, // rounded to centavos
          town: data.town,
          buyerId: req.user.uid, // from the checked token, so nobody can order in someone else's name
          buyerName: req.user.name || "",
          buyerEmail: req.user.email || "",
          farmerId: data.ownerId,
          farmerName: data.ownerName || "",
          farmerContact: data.contactNumber || "",
          status: "pending", // the farmer still has to accept or decline
        };
        const orderRef = adminDb.collection("orders").doc(); // a new empty document with a new ID
        transaction.set(orderRef, { ...order, createdAt: FieldValue.serverTimestamp() });
        return { id: orderRef.id, ...order };
      });
    });
    res.status(201).json(orders); // 201 Created
  } catch (error) {
    sendProblem(res, error);
  }
});

// ---- GET /api/orders/mine: the orders I sent (the buyer's "My orders") ----
router.get("/mine", requireLogin, async (req, res) => {
  const snapshot = await adminDb.collection("orders").where("buyerId", "==", req.user.uid).get();
  res.json(newestFirst(snapshot.docs.map(toJson))); // 200 OK
});

// ---- GET /api/orders/received: the orders on my listings (the farmer's "Orders received") ----
router.get("/received", requireLogin, async (req, res) => {
  const snapshot = await adminDb.collection("orders").where("farmerId", "==", req.user.uid).get();
  res.json(newestFirst(snapshot.docs.map(toJson))); // 200 OK
});

// ---- PATCH /api/orders/:id: change an order's status ----
// React sends { status: "accepted" }, "declined" (the farmer) or "cancelled" (the buyer).
// Only a "pending" order can change. Declined and cancelled orders put the kilos back.
router.patch("/:id", requireLogin, async (req, res) => {
  const status = req.body && req.body.status;
  if (!["accepted", "declined", "cancelled"].includes(status)) {
    return res.status(400).json({ error: 'Status must be "accepted", "declined" or "cancelled".' });
  }

  try {
    // A transaction again, because we may change the order AND its listing's stock together
    const updated = await adminDb.runTransaction(async (transaction) => {
      // 1. READ the order (and its listing, if we must put kilos back)
      const orderRef = adminDb.collection("orders").doc(req.params.id);
      const order = await transaction.get(orderRef);
      if (!order.exists) {
        throw problem(404, "This order doesn't exist anymore.");
      }
      const data = order.data();

      // 2. CHECK who may do what
      const isBuyer = data.buyerId === req.user.uid;
      const isFarmer = data.farmerId === req.user.uid;
      if (status === "cancelled" && !isBuyer) {
        throw problem(403, "Only the buyer can cancel this order.");
      }
      if (status !== "cancelled" && !isFarmer) {
        throw problem(403, "Only the farmer who sells this crop can accept or decline the order.");
      }
      if (data.status !== "pending") {
        throw problem(409, `This order is already ${data.status}, so it can't change now.`); // 409 Conflict
      }

      const putBack = status === "declined" || status === "cancelled";
      const listingRef = adminDb.collection("listings").doc(data.listingId);
      const listing = putBack ? await transaction.get(listingRef) : null;

      // 3. WRITE: the new status, and the kilos go back to the listing
      transaction.update(orderRef, { status });
      if (listing && listing.exists) {
        const stock = listing.data();
        const changes = { quantityKg: Math.round((stock.quantityKg + data.quantityKg) * 100) / 100 };
        // It was sold out only because of orders, so it can be sold again
        if (stock.status === "sold" && stock.quantityKg === 0) changes.status = "available";
        transaction.update(listingRef, changes);
      }
      return { id: order.id, ...data, status, createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null };
    });
    res.json(updated); // 200 OK
  } catch (error) {
    sendProblem(res, error);
  }
});

export default router;
