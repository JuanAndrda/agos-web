// listingsService.js: every listings request lives here. React does NOT talk to Firestore
// for listings. It sends HTTP requests to OUR Express server (server/listings.js), and the
// server checks each request before it reads or writes the database.
//
// Every function has the same 3 steps:
//   1. Get the login token from Firebase. It proves to our server who is logged in.
//   2. Send the request with fetch(): the address, the METHOD, the headers and (for POST and
//      PATCH) the body.
//   3. Read the response and its status code with readResponse() (see readResponse.js).
//
// "/api/listings" works without "http://localhost:5000" because of the "proxy" line in
// client/package.json: the React development server passes /api/... requests to our server.
import { auth } from "../firebase";
import { readResponse } from "./readResponse";

// READ: GET /api/listings -> every listing that is still available (Marketplace page)
// Success: 200 OK with a list of listings
export async function getAvailableListings() {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/listings", {
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  });
  return readResponse(response);
}

// READ: GET /api/listings/mine -> only my listings, available and sold (My Listings page)
// Success: 200 OK. A buyer gets 403 Forbidden, because only farmers have listings.
export async function getMyListings() {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/listings/mine", {
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  });
  return readResponse(response);
}

// CREATE: POST /api/listings -> post a new crop. The server adds the owner, status and date.
// The body is the new listing, turned into JSON text with JSON.stringify().
// Success: 201 Created with the saved listing. Wrong data: 400 Bad Request.
export async function addListing(listing) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // tells the server the body is JSON
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(listing),
  });
  return readResponse(response);
}

// UPDATE: PATCH /api/listings/abc123 -> change only the fields we send, like { status: "sold" }
// Success: 200 OK with the updated listing. Not yours: 403. Deleted already: 404.
export async function updateListing(id, changes) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/listings/" + id, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(changes),
  });
  return readResponse(response);
}

// "Mark as sold" is just a PATCH that changes one field
export function markSold(id) {
  return updateListing(id, { status: "sold" });
}

// DELETE: DELETE /api/listings/abc123 -> remove a listing. No body is needed.
// Success: 200 OK with { message: "Listing deleted." }. Not yours: 403. Deleted already: 404.
export async function deleteListing(id) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/listings/" + id, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token },
  });
  return readResponse(response);
}
