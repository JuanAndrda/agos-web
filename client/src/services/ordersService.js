// ordersService.js: every orders call lives here. Like listingsService.js, these functions send
// HTTP requests to OUR Express server (server/orders.js), which checks them and uses Firestore.
import { callServer } from "./serverApi";

// CREATE: POST /api/orders -> send the cart as order requests.
// cartItems look like [{ listing: {...}, quantityKg: 5 }]. The server only needs the IDs and kilos;
// it reads the price and the stock itself, so nobody can send a fake price.
export function placeOrders(cartItems) {
  const items = cartItems.map((item) => ({ listingId: item.listing.id, quantityKg: item.quantityKg }));
  return callServer("/api/orders", "POST", { items });
}

// READ: GET /api/orders/mine -> the orders I sent (buyer)
export function getMyOrders() {
  return callServer("/api/orders/mine");
}

// READ: GET /api/orders/received -> the orders on my listings (farmer)
export function getReceivedOrders() {
  return callServer("/api/orders/received");
}

// UPDATE: PATCH /api/orders/abc123 -> { status: "accepted" | "declined" | "cancelled" }
export function setOrderStatus(id, status) {
  return callServer("/api/orders/" + id, "PATCH", { status });
}
