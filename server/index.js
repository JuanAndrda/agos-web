// index.js: our Express server. It has three jobs:
// 1. Prices: React asks this server, this server asks PSA, cleans the answer, remembers it
//    for one hour, and sends back only what the page needs.
// 2. Listings: React sends every listing request here, and listings.js checks it and
//    talks to Firestore.
// 3. Orders: the cart's checkout and the order requests (orders.js).

import express from "express";
import cors from "cors";
import { fetchPsaPrices, CROPS } from "./psa.js";
import listingsRouter from "./listings.js";
import ordersRouter from "./orders.js";

const app = express();
app.use(cors()); // lets our React app (a different port) call this server
app.use(express.json()); // lets the server read the JSON that React sends with POST and PATCH

// ---- The cache: we keep PSA's prices for one hour so pages load fast ----
const ONE_HOUR = 60 * 60 * 1000;
let cache = { prices: null, savedAt: 0 };

async function getPrices() {
  // Only call PSA if we have no prices yet, or they are older than one hour
  if (!cache.prices || Date.now() - cache.savedAt > ONE_HOUR) {
    cache = { prices: await fetchPsaPrices(), savedAt: Date.now() };
  }
  return cache;
}

// From all months, keep only the newest price of each crop
function latestPerCrop(prices) {
  const latest = {};
  for (const p of prices) {
    if (!latest[p.crop] || p.monthKey > latest[p.crop].monthKey) {
      latest[p.crop] = p;
    }
  }
  return Object.values(latest).sort((a, b) => a.crop.localeCompare(b.crop));
}

const PSA_ERROR = "We couldn't get prices from PSA right now. Please try again later.";

// ---- Endpoint 1: GET /api/prices?search=tomato ----
// The newest farmgate price of each crop. The search text is optional.
app.get("/api/prices", async (req, res) => {
  // 1. Check the search text sent by React
  const search = String(req.query.search || "").trim().toLowerCase();
  if (search.length > 50) {
    return res.status(400).json({ error: "Search text is too long. Use 50 characters or fewer." });
  }

  // 2. Get the prices (from the cache, or from PSA)
  let data;
  try {
    data = await getPrices();
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: PSA_ERROR });
  }

  // 3. Filter by the search text and send back clean JSON
  const prices = latestPerCrop(data.prices).filter((p) => p.crop.toLowerCase().includes(search));
  res.json({
    source: "PSA OpenSTAT",
    area: "Iloilo Province",
    checkedAt: new Date(data.savedAt).toISOString(), // when our server last asked PSA
    count: prices.length,
    prices,
  });
});

// ---- Endpoint 2: GET /api/prices/Tomato ----
// Every month's price of one crop, newest first (for the Crop Details page).
app.get("/api/prices/:crop", async (req, res) => {
  // 1. Check that we track this crop
  const crop = CROPS.find((c) => c.name.toLowerCase() === req.params.crop.toLowerCase());
  if (!crop) {
    return res.status(404).json({ error: `We don't have PSA prices for "${req.params.crop}".` });
  }

  // 2. Get the prices (from the cache, or from PSA)
  let data;
  try {
    data = await getPrices();
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: PSA_ERROR });
  }

  // 3. Keep only this crop, newest month first
  const history = data.prices
    .filter((p) => p.crop === crop.name)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  res.json({
    source: "PSA OpenSTAT",
    area: "Iloilo Province",
    checkedAt: new Date(data.savedAt).toISOString(),
    crop: crop.name,
    history,
  });
});

// ---- Endpoints 3 to 7: our listings API, GET, POST, PATCH and DELETE (see listings.js) ----
app.use("/api/listings", listingsRouter);

// ---- Endpoints 8 to 11: our orders API, POST, GET and PATCH (see orders.js) ----
app.use("/api/orders", ordersRouter);

// Any other address: answer with a clear 404 instead of an HTML page
app.use((req, res) => {
  res.status(404).json({ error: "This API address doesn't exist." });
});

// If any route crashes, answer with 500 instead of stopping the server
app.use((error, req, res, next) => {
  // express.json() could not read the data, because it isn't real JSON
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "The data sent to the server isn't valid JSON." });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, (error) => {
  // Express 5 gives us an error here if the server can't start (for example, the port is busy)
  if (error) {
    console.error(`The server could not start on port ${PORT}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Server running at http://localhost:${PORT}`);
});
