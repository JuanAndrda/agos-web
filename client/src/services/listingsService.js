// listingsService.js: every listings call lives here. Since Nov 15 these functions don't talk to
// Firestore directly. They send HTTP requests to OUR Express server (server/listings.js), and the
// server checks each request before it reads or writes the database.
// The function names are the same as before, so the pages hardly changed.
// Since Nov 17 the code that sends the request lives in serverApi.js (orders use it too).
import { callServer } from "./serverApi";

// Every listings address starts with /api/listings
function callListings(path, method, body) {
  return callServer("/api/listings" + path, method, body);
}

// READ: GET /api/listings -> every listing that is still available (Marketplace page)
export function getAvailableListings() {
  return callListings("");
}

// READ: GET /api/listings/mine -> only my listings, available and sold (My Listings page)
export function getMyListings() {
  return callListings("/mine");
}

// CREATE: POST /api/listings -> post a new crop. The server adds the owner, status and date.
export function addListing(form) {
  return callListings("", "POST", form);
}

// UPDATE: PATCH /api/listings/abc123 -> change only the fields we send
export function updateListing(id, changes) {
  return callListings("/" + id, "PATCH", changes);
}

export function markSold(id) {
  return updateListing(id, { status: "sold" });
}

// DELETE: DELETE /api/listings/abc123 -> remove a listing
export function deleteListing(id) {
  return callListings("/" + id, "DELETE");
}

// Our server already answers in plain words, so we show its message as it is
export function friendlyListingError(error) {
  return error.message;
}
