// pricesService.js: calls OUR Express server (server/index.js), which gets the prices from PSA.
// The prices are public, so these requests need no login token.
// "/api/prices" works without "http://localhost:5000" because of the "proxy" line in
// client/package.json: the React development server passes /api/... requests to our server.
import { readResponse } from "./readResponse";

// READ: GET /api/prices?search=tomato -> the newest price of each crop
// "?search=tomato" is a query parameter. encodeURIComponent() makes spaces and symbols safe in a URL.
// Success: 200 OK. PSA is down: 502 Bad Gateway.
export async function getPrices(search) {
  const response = await fetch("/api/prices?search=" + encodeURIComponent(search || ""), {
    method: "GET",
  });
  return readResponse(response);
}

// READ: GET /api/prices/Tomato -> every month's price of one crop
// Success: 200 OK. A crop we don't track: 404 Not Found.
export async function getPriceHistory(cropName) {
  const response = await fetch("/api/prices/" + encodeURIComponent(cropName), {
    method: "GET",
  });
  return readResponse(response);
}
