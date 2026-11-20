// index.js: our Express server. It has four jobs:
// 0. Crops: GET /api/crops sends our crop catalog (crops.js) with each crop's newest PSA price.
// 1. Prices: React asks this server, this server asks PSA, cleans the answer, remembers it
//    for one hour, and sends back only what the page needs. If PSA is down later, we send the
//    last prices we got instead of an error.
// 2. Listings: React sends every listing request here, and listings.js checks it and
//    talks to Firestore.
// 3. Orders: the cart's checkout and the order requests (orders.js).

import express from "express";
import cors from "cors";
import { fetchPsaPrices } from "./psa.js";
import { CROPS, CATEGORIES, findCrop } from "./crops.js";
import listingsRouter from "./listings.js";
import ordersRouter from "./orders.js";

const app = express();
app.use(cors()); // lets our React app (a different port) call this server
app.use(express.json()); // lets the server read the JSON that React sends with POST and PATCH

// ---- The cache: we keep PSA's prices for one hour so pages load fast ----
const ONE_HOUR = 60 * 60 * 1000;
let cache = { prices: null, savedAt: 0 };
// The trip to PSA that is on its way right now (null when there is none). If 3 people open the
// app at the same moment, they all wait for this ONE trip instead of sending 3 trips to PSA.
let psaTrip = null;
// When PSA last failed. For 5 minutes after a failure we don't make people wait for PSA again.
const FIVE_MINUTES = 5 * 60 * 1000;
let lastFailedAt = 0;

// Gives back { prices, savedAt, stale }. "stale: true" means PSA didn't answer, so these are
// the older prices from our last successful trip.
async function getPrices() {
  // 1. Fresh enough (less than one hour old)? Use the cache, no trip to PSA.
  if (cache.prices && Date.now() - cache.savedAt <= ONE_HOUR) {
    return { prices: cache.prices, savedAt: cache.savedAt, stale: false };
  }

  // 2. PSA failed less than 5 minutes ago and we have older prices: send those right away
  if (cache.prices && Date.now() - lastFailedAt < FIVE_MINUTES) {
    return { prices: cache.prices, savedAt: cache.savedAt, stale: true };
  }

  // 3. Too old, or no prices yet: ask PSA (or join the trip that is already on its way)
  try {
    if (!psaTrip) psaTrip = fetchPsaPrices();
    const prices = await psaTrip;
    cache = { prices: prices, savedAt: Date.now() };
    return { prices: cache.prices, savedAt: cache.savedAt, stale: false };
  } catch (error) {
    // 4. PSA failed. If we still have older prices, send those instead of an error.
    lastFailedAt = Date.now();
    if (cache.prices) {
      console.error("PSA didn't answer, so we send the prices from our last trip:", error.message);
      return { prices: cache.prices, savedAt: cache.savedAt, stale: true };
    }
    throw error; // no prices at all: the route answers 502
  } finally {
    psaTrip = null; // the trip is over (it worked or it failed), so the next one can start
  }
}

// From all months, keep only the newest price of each crop.
// We also add the crop's category, and "older: true" when its newest price is from an earlier
// month than PSA's newest month (some crops have no price for the newest month). React shows
// those with their month and an "older price" note, so nobody thinks it is this month's price.
function latestPerCrop(prices) {
  const latest = {};
  let newestMonth = ""; // the newest month of ALL crops, like "2026-06"
  for (const p of prices) {
    if (!latest[p.crop] || p.monthKey > latest[p.crop].monthKey) {
      latest[p.crop] = p;
    }
    if (p.monthKey > newestMonth) newestMonth = p.monthKey;
  }
  const result = [];
  for (const p of Object.values(latest)) {
    result.push({
      ...p, // crop, monthKey, month, pricePerKg
      category: findCrop(p.crop).category,
      older: p.monthKey < newestMonth,
    });
  }
  return result.sort((a, b) => a.crop.localeCompare(b.crop));
}

const PSA_ERROR = "We couldn't get prices from PSA right now. Please try again later.";

// ---- Endpoint 0: GET /api/crops ----
// Our whole crop catalog, grouped by category, with each crop's newest PSA price.
// The crop picker in the listing form uses it. It ALWAYS answers 200 OK: if PSA is down, the
// crops still come back, just with "latest: null", so farmers can still choose any crop.
app.get("/api/crops", async (req, res) => {
  // 1. Get the newest price of each crop. If PSA fails, we carry on without prices.
  let latest = [];
  let pricesWorking = true;
  let stale = false;
  try {
    const data = await getPrices();
    latest = latestPerCrop(data.prices);
    stale = data.stale;
  } catch (error) {
    console.error("Crops sent without prices, because PSA didn't answer:", error.message);
    pricesWorking = false;
  }

  // 2. Join each crop with its price (or null when PSA has no recent price for it)
  const crops = CROPS.map((crop) => {
    const price = latest.find((p) => p.crop === crop.name);
    return {
      name: crop.name,
      category: crop.category,
      popular: Boolean(crop.popular),
      latest: price
        ? { pricePerKg: price.pricePerKg, month: price.month, monthKey: price.monthKey, older: price.older }
        : null,
    };
  });

  // 3. Answer: 200 OK
  res.status(200).json({
    source: "PSA OpenSTAT",
    categories: CATEGORIES.map((c) => c.name), // the order the picker shows them
    pricesWorking, // false = PSA is down and we have no saved prices
    stale,
    count: crops.length,
    crops,
  });
});

// ---- Endpoint 1: GET /api/prices?search=tomato ----
// The newest farmgate price of each crop. The search text is optional.
app.get("/api/prices", async (req, res) => {
  // 1. Check the search text sent by React
  const search = String(req.query.search || "").trim().toLowerCase();
  if (search.length > 50) {
    return res.status(400).json({ error: "Search text is too long. Use 50 characters or fewer." }); // 400 Bad Request
  }

  // 2. Get the prices (from the cache, or from PSA)
  let data;
  try {
    data = await getPrices();
  } catch (error) {
    console.error(error);
    // 502 Bad Gateway: OUR server is fine, but the server we depend on (PSA) didn't answer
    return res.status(502).json({ error: PSA_ERROR });
  }

  // 3. Filter by the search text (crop name or category) and answer: 200 OK with clean JSON
  const prices = latestPerCrop(data.prices).filter(
    (p) => p.crop.toLowerCase().includes(search) || p.category.toLowerCase().includes(search)
  );
  res.status(200).json({
    source: "PSA OpenSTAT",
    area: "Iloilo Province",
    checkedAt: new Date(data.savedAt).toISOString(), // when our server last asked PSA
    stale: data.stale, // true = PSA didn't answer, these are older prices
    categories: CATEGORIES.map((c) => c.name), // so React can group the cards in this order
    count: prices.length,
    prices,
  });
});

// ---- Endpoint 2: GET /api/prices/Tomato ----
// Every month's price of one crop, newest first (for the Crop Details page).
app.get("/api/prices/:crop", async (req, res) => {
  // 1. Check that we track this crop
  const crop = findCrop(req.params.crop);
  if (!crop) {
    return res.status(404).json({ error: `We don't have PSA prices for "${req.params.crop}".` }); // 404 Not Found
  }

  // 2. Get the prices (from the cache, or from PSA)
  let data;
  try {
    data = await getPrices();
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: PSA_ERROR }); // 502 Bad Gateway: PSA didn't answer
  }

  // 3. Keep only this crop, newest month first, and answer: 200 OK
  const history = data.prices
    .filter((p) => p.crop === crop.name)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  res.status(200).json({
    source: "PSA OpenSTAT",
    area: "Iloilo Province",
    checkedAt: new Date(data.savedAt).toISOString(),
    stale: data.stale,
    crop: crop.name,
    category: crop.category,
    history, // an empty list when PSA has no price for this crop in the last 2 years
  });
});

// ---- Endpoints 3 to 7: our listings API, GET, POST, PATCH and DELETE (see listings.js) ----
app.use("/api/listings", listingsRouter);

// ---- Endpoints 8 to 11: our orders API, POST, GET and PATCH (see orders.js) ----
app.use("/api/orders", ordersRouter);

// Any other address: answer with 404 Not Found (as JSON, not an HTML page)
app.use((req, res) => {
  res.status(404).json({ error: "This API address doesn't exist." });
});

// A safety net: if a route crashes in a way we didn't catch, answer with
// 500 Internal Server Error instead of stopping the server
app.use((error, req, res, next) => {
  // express.json() could not read the data, because it isn't real JSON
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "The data sent to the server isn't valid JSON." }); // 400
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// On Vercel the app is not started with app.listen: Vercel runs it as a function (see api/index.js).
export default app;

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) app.listen(PORT, (error) => {
  // Express 5 gives us an error here if the server can't start (for example, the port is busy)
  if (error) {
    console.error(`The server could not start on port ${PORT}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Server running at http://localhost:${PORT}`);

  // Get PSA's prices now, while nobody is waiting, so the first page that needs them is instant
  getPrices()
    .then(() => console.log("PSA prices are ready."))
    .catch((err) => console.error("PSA didn't answer yet. We'll try again when a page asks:", err.message));
});
