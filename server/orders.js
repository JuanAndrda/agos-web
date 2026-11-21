// orders.js: our orders API, 4 endpoints. A buyer puts crops in the cart and sends an
// "order request". There is no payment in our app: the farmer accepts or declines the request,
// and they agree on payment and pickup by phone.
//
// Status codes we use: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized (in auth.js),
// 403 Forbidden, 404 Not Found, 409 Conflict, 500 Internal Server Error, 503 Service Unavailable.
//
// The important part is POST /api/orders. It uses a Firestore TRANSACTION, so two buyers who
// order the last 5 kg at the same moment can't both get them. A transaction reads the listings,
// checks them, and writes the changes as ONE step: if the stock changed while we were checking,
// Firestore runs our code again with the new numbers.
import express from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.js";
import { requireLogin, requireFarmer, requireBuyer } from "./auth.js";
import { readPageQuery, paginate } from "./paginate.js";
import { cleanCropName } from "./crops.js";

const router = express.Router();
const MAX_ITEMS = 20; // the most different listings in one checkout

// Firestore saves the time as a Timestamp. We send React text like "2026-11-17T12:30:00.000Z".
function toJson(doc) {
  const data = doc.data();
  return { id: doc.id, ...data, crop: cleanCropName(data.crop), createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null };
}

// Newest orders first
function newestFirst(orders) {
  return orders.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

// Runs before every endpoint below: is the server connected to Firebase? (See firebaseAdmin.js.)
router.use((req, res, next) => {
  if (!adminDb) {
    // 503 Service Unavailable: the server is running, but this part can't work right now
    return res.status(503).json({
      error: "Orders are off because our server has no Firebase key yet. Add server/serviceAccountKey.json (README step 4), then restart the server.",
    });
  }
  next();
});

// ---- POST /api/orders: send the cart as order requests (checkout, buyers only) ----
// React sends: { items: [{ listingId: "abc123", quantityKg: 5 }, ...] }
// We make ONE order per listing, because each listing can be from a different farmer.
router.post("/", requireLogin, requireBuyer, async (req, res) => {
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

  // 2. The transaction: read every listing, check every item, then write everything at once.
  //    The transaction gives back a "result": { status, error } when something is wrong,
  //    or { status: 201, orders } when everything is saved.
  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      // 2a. READ: a transaction must do all its reads before any write
      const refs = ids.map((id) => adminDb.collection("listings").doc(id));
      const listings = await transaction.getAll(...refs);

      // 2b. CHECK each item. If one is wrong, we return before writing, so NOTHING is saved.
      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        const wanted = items[i].quantityKg;
        if (!listing.exists) {
          // 404 Not Found: the farmer deleted this listing
          return { status: 404, error: "One of the crops in your cart was deleted by the farmer. Remove it and try again." };
        }
        const data = listing.data();
        // Extra safety: buyers have no listings, but nobody may ever order their own crop
        if (data.ownerId === req.user.uid) {
          return { status: 403, error: `You can't order your own ${data.crop} listing.` }; // 403 Forbidden
        }
        if (data.status !== "available" || data.quantityKg <= 0) {
          // 409 Conflict: the stock changed since the buyer added it to the cart
          return { status: 409, error: `${data.crop} from ${data.ownerName} is sold out. Remove it from your cart.` };
        }
        if (wanted > data.quantityKg) {
          return { status: 409, error: `Only ${data.quantityKg} kg of ${data.crop} from ${data.ownerName} is left. Lower the quantity.` };
        }
      }

      // 2c. WRITE: lower each listing's stock, and save one order per listing
      const orders = [];
      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        const data = listing.data();
        const quantityKg = items[i].quantityKg;
        const left = Math.round((data.quantityKg - quantityKg) * 100) / 100; // rounded, so 12.3 - 12 is 0.3

        // Lower the stock. At 0 kg the listing is sold out, so it leaves the Marketplace.
        const listingChanges = { quantityKg: left };
        if (left === 0) listingChanges.status = "sold";
        transaction.update(listing.ref, listingChanges);

        const order = {
          listingId: listing.id,
          crop: cleanCropName(data.crop),
          quantityKg: quantityKg,
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
        // An order on a DEMO listing (made by server/demo/seed.js) is demo data too, so
        // "npm run demo:reset" removes it with the rest of the demo data
        if (data.demo === true) order.demo = true;
        const orderRef = adminDb.collection("orders").doc(); // a new empty document with a new ID
        transaction.set(orderRef, { ...order, createdAt: FieldValue.serverTimestamp() });
        orders.push({ id: orderRef.id, ...order });
      }
      return { status: 201, orders: orders };
    });

    // 3. Answer
    if (result.error) {
      return res.status(result.status).json({ error: result.error }); // 403, 404 or 409
    }
    res.status(201).json(result.orders); // 201 Created
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "We couldn't send your order. Please try again." }); // 500
  }
});

const STATUSES = ["pending", "accepted", "declined", "cancelled", "completed"];

// Shared by the two GET endpoints below: checks ?page, ?limit and ?status, filters by status,
// sorts newest first, and answers with ONE page of orders.
// "field" says whose orders: "buyerId" (orders I sent) or "farmerId" (orders I received).
async function sendOrderPage(req, res, field, errorText) {
  // 1. Check the query parameters, like /api/orders/mine?page=2&limit=6&status=pending
  const pageQuery = readPageQuery(req.query, 6); // 6 orders per page unless React asks for 12 or 24
  if (pageQuery.error) {
    return res.status(400).json({ error: pageQuery.error }); // 400 Bad Request
  }
  const status = String(req.query.status || "");
  if (status !== "" && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}.` }); // 400
  }

  try {
    // 2. Use the database: this person's orders
    const snapshot = await adminDb.collection("orders").where(field, "==", req.user.uid).get();
    const all = newestFirst(snapshot.docs.map(toJson));

    // 3. How many orders have each status, for the filter buttons: { pending: 3, accepted: 1, ... }
    const counts = {};
    for (const order of all) counts[order.status] = (counts[order.status] || 0) + 1;

    // 4. Filter by status, cut out the page, and answer: 200 OK
    const matching = status ? all.filter((o) => o.status === status) : all;
    const result = paginate(matching, pageQuery.page, pageQuery.limit);
    res.status(200).json({
      orders: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      totalAll: all.length, // all of this person's orders, without the status filter
      counts: counts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: errorText }); // 500
  }
}

// ---- GET /api/orders/mine: ONE PAGE of the orders I sent (the buyer's "My orders") ----
router.get("/mine", requireLogin, requireBuyer, (req, res) =>
  sendOrderPage(req, res, "buyerId", "We couldn't load your orders. Please try again.")
);

// ---- GET /api/orders/received: ONE PAGE of the orders on my listings (the farmer's "Orders received") ----
router.get("/received", requireLogin, requireFarmer, (req, res) =>
  sendOrderPage(req, res, "farmerId", "We couldn't load the orders. Please try again.")
);

// ---- PATCH /api/orders/:id: change an order's status ----
// React sends { status: "..." }. The allowed changes (like steps in a story):
//   pending  -> accepted   (the farmer agrees)
//   pending  -> declined   (the farmer says no)          -> the kilos go back to the listing
//   pending  -> cancelled  (the buyer changes their mind) -> the kilos go back to the listing
//   accepted -> completed  (the farmer: the buyer picked up and paid; the deal is done)
// An accepted order can't be declined or cancelled anymore: both sides must honor the deal.
router.patch("/:id", requireLogin, async (req, res) => {
  // 1. Check the data
  const status = req.body && req.body.status;
  if (!["accepted", "declined", "cancelled", "completed"].includes(status)) {
    return res.status(400).json({ error: 'Status must be "accepted", "declined", "cancelled" or "completed".' }); // 400
  }

  try {
    // 2. A transaction again, because we may change the order AND its listing's stock together.
    //    Like POST, it gives back { status, error } or { status: 200, order }.
    const result = await adminDb.runTransaction(async (transaction) => {
      // 2a. READ the order
      const orderRef = adminDb.collection("orders").doc(req.params.id);
      const order = await transaction.get(orderRef);
      if (!order.exists) {
        return { status: 404, error: "This order doesn't exist anymore." }; // 404 Not Found
      }
      const data = order.data();

      // 2b. CHECK who may do what
      const isBuyer = data.buyerId === req.user.uid;
      const isFarmer = data.farmerId === req.user.uid;
      if (status === "cancelled" && !isBuyer) {
        return { status: 403, error: "Only the buyer can cancel this order." }; // 403 Forbidden
      }
      if (status !== "cancelled" && !isFarmer) {
        return { status: 403, error: "Only the farmer who sells this crop can accept, decline or complete the order." };
      }

      // 2c. CHECK that this step is allowed from the order's current status
      if (status === "completed" && data.status !== "accepted") {
        // 409 Conflict: only an accepted order can be completed
        return { status: 409, error: `Only an accepted order can be marked as completed. This one is ${data.status}.` };
      }
      if (status !== "completed" && data.status !== "pending") {
        // 409 Conflict: the order already changed, so this change doesn't fit anymore
        let message = `This order is already ${data.status}, so it can't change now.`;
        if (data.status === "accepted") {
          message = "This order is already accepted, so it can't be declined or cancelled. The farmer and the buyer agreed on it.";
        }
        return { status: 409, error: message };
      }

      // Declined and cancelled orders give the kilos back, so we read the listing too
      const putBack = status === "declined" || status === "cancelled";
      const listingRef = adminDb.collection("listings").doc(data.listingId);
      let listing = null;
      if (putBack) listing = await transaction.get(listingRef);

      // 2d. WRITE: the new status, and the kilos go back to the listing
      transaction.update(orderRef, { status: status });
      if (listing && listing.exists) {
        const stock = listing.data();
        const changes = { quantityKg: Math.round((stock.quantityKg + data.quantityKg) * 100) / 100 };
        // It was sold out only because of orders, so it can be sold again
        if (stock.status === "sold" && stock.quantityKg === 0) changes.status = "available";
        transaction.update(listingRef, changes);
      }
      const updated = { id: order.id, ...data, status: status, createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null };
      return { status: 200, order: updated };
    });

    // 3. Answer
    if (result.error) {
      return res.status(result.status).json({ error: result.error }); // 403, 404 or 409
    }
    res.status(200).json(result.order); // 200 OK
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "We couldn't change the order. Please try again." }); // 500
  }
});

export default router;
