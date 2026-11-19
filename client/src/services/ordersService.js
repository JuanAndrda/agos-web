// ordersService.js: every orders request lives here. Like listingsService.js, these functions
// send HTTP requests to OUR Express server (server/orders.js), which checks them and uses Firestore.
// Same 3 steps: get the login token -> fetch() with a method -> readResponse() checks the status.
import { auth } from "../firebase";
import { readResponse } from "./readResponse";

// CREATE: POST /api/orders -> send the cart as order requests.
// The cart looks like [{ listing: {...}, quantityKg: 5 }]. The server only needs the listing IDs
// and the kilos. It reads the price and the stock itself, so nobody can send a fake price.
// Success: 201 Created with the new orders. Not enough kilos left: 409 Conflict.
export async function placeOrders(cart) {
  const items = cart.map((item) => ({ listingId: item.listing.id, quantityKg: item.quantityKg }));

  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ items: items }),
  });
  return readResponse(response);
}

// READ: GET /api/orders/mine -> the orders I sent (buyers only). Success: 200 OK.
export async function getMyOrders() {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/orders/mine", {
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  });
  return readResponse(response);
}

// READ: GET /api/orders/received -> the orders on my listings (farmers only). Success: 200 OK.
export async function getReceivedOrders() {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/orders/received", {
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  });
  return readResponse(response);
}

// UPDATE: PATCH /api/orders/abc123 with { status: "accepted" | "declined" | "cancelled" }
// Success: 200 OK. Not your order: 403. Already accepted or cancelled: 409 Conflict.
export async function setOrderStatus(id, status) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/orders/" + id, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ status: status }),
  });
  return readResponse(response);
}
