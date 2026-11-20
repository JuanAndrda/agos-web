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

// Turns { page: 2, limit: 6, status: "pending" } into "page=2&limit=6&status=pending"
// (empty values are left out)
function toQuery(options) {
  const params = new URLSearchParams();
  for (const name in options) {
    if (options[name] !== "" && options[name] !== undefined) params.set(name, options[name]);
  }
  return params.toString();
}

// READ: GET /api/orders/mine?page=1&limit=6&status=pending -> ONE PAGE of the orders I sent (buyers only)
// Success: 200 OK with { orders, page, limit, total, totalPages, totalAll, counts }.
export async function getMyOrders(options) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/orders/mine?" + toQuery(options), {
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  });
  return readResponse(response);
}

// READ: GET /api/orders/received?page=1&limit=6 -> ONE PAGE of the orders on my listings (farmers only)
// Success: 200 OK, same shape as getMyOrders.
export async function getReceivedOrders(options) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/orders/received?" + toQuery(options), {
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
