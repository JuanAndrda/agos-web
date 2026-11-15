// listingsService.js: every listings call lives here. Since Nov 15 these functions don't talk to
// Firestore directly. They send HTTP requests to OUR Express server (server/listings.js), and the
// server checks each request before it reads or writes the database.
// The function names are the same as before, so the pages hardly changed.
import { auth } from "../firebase";

// Sends one request to our server and returns the JSON answer.
// "/api/listings" works without "http://localhost:5000" because of the "proxy" line in
// client/package.json (the same as pricesService.js).
async function callServer(path, method = "GET", body) {
  let response;
  try {
    // The token is a long code from Firebase that proves who is logged in. Our server checks it.
    const token = await auth.currentUser.getIdToken();
    response = await fetch("/api/listings" + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("We can't reach our server. Check your internet connection and try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    // Not JSON: usually our Express server is not running
    throw new Error("Our listings server isn't answering right now. Please try again in a moment.");
  }

  if (!response.ok) {
    // Our server always explains the problem in "error", like "Only farmers can do this."
    throw new Error(data.error || "Something went wrong with the listings. Please try again.");
  }
  return data;
}

// READ: GET /api/listings -> every listing that is still available (Marketplace page)
export function getAvailableListings() {
  return callServer("");
}

// READ: GET /api/listings/mine -> only my listings, available and sold (My Listings page)
export function getMyListings() {
  return callServer("/mine");
}

// CREATE: POST /api/listings -> post a new crop. The server adds the owner, status and date.
export function addListing(form) {
  return callServer("", "POST", form);
}

// UPDATE: PATCH /api/listings/abc123 -> change only the fields we send
export function updateListing(id, changes) {
  return callServer("/" + id, "PATCH", changes);
}

export function markSold(id) {
  return updateListing(id, { status: "sold" });
}

// DELETE: DELETE /api/listings/abc123 -> remove a listing
export function deleteListing(id) {
  return callServer("/" + id, "DELETE");
}

// Our server already answers in plain words, so we show its message as it is
export function friendlyListingError(error) {
  return error.message;
}
