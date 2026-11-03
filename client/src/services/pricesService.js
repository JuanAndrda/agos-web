// pricesService.js: calls OUR Express server (server/index.js), which gets the prices from PSA.
// We write "/api/prices" without "http://localhost:5000" because of the "proxy" line in
// client/package.json: the React development server passes /api/... requests to our server.

async function callServer(path) {
  let response;
  try {
    response = await fetch(path);
  } catch {
    throw new Error("We can't reach our server. Check your internet connection and try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    // Not JSON: usually our Express server is not running
    throw new Error("Our price server isn't answering right now. Please try again in a moment.");
  }

  if (!response.ok) {
    throw new Error(data.error || "We couldn't load the prices. Please try again.");
  }
  return data;
}

// GET /api/prices?search=tomato -> the newest price of each crop
export function getPrices(search = "") {
  return callServer("/api/prices?search=" + encodeURIComponent(search));
}

// GET /api/prices/Tomato -> every month's price of one crop
export function getPriceHistory(cropName) {
  return callServer("/api/prices/" + encodeURIComponent(cropName));
}
