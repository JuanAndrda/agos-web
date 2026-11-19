// Cart.js: the buyer's cart. Change the kilos, remove items, see the total, then send everything
// as order requests with ONE call: POST /api/orders. The server checks the stock again inside a
// Firestore transaction (server/orders.js), because another buyer may have ordered in the meantime.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { placeOrders } from "../services/ordersService";
import { formatPeso } from "../constants";
import ErrorMessage from "../components/ErrorMessage";

// Checks one cart item. Returns a message, or "" when it is OK.
function checkItem(item) {
  const kilos = item.quantityKg;
  if (!Number.isInteger(kilos) || kilos <= 0) return "Enter whole kilos, more than 0.";
  if (kilos > item.listing.quantityKg) return `Only ${item.listing.quantityKg} kg left.`;
  return "";
}

// cart and setCart are props from App.js
function Cart({ cart, setCart }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState(0); // how many orders were sent (0 = none yet)

  useEffect(() => {
    document.title = "Cart · AgosUgnayan Web";
  }, []);

  // Change the kilos of one item (the number box)
  function changeQuantity(listingId, quantityKg) {
    setCart(cart.map((item) => (item.listing.id === listingId ? { listing: item.listing, quantityKg: quantityKg } : item)));
  }

  // Remove one item: keep every item except this one
  function removeFromCart(listingId) {
    setCart(cart.filter((item) => item.listing.id !== listingId));
  }

  // The total of the whole cart: add up kilos × price of every item with reduce()
  const total = cart.reduce((sum, item) => sum + (item.quantityKg || 0) * item.listing.pricePerKg, 0);
  const hasProblem = cart.some((item) => checkItem(item) !== "");

  async function handleCheckout() {
    setSending(true);
    setError("");
    try {
      const orders = await placeOrders(cart); // CREATE: POST /api/orders -> 201 Created
      setCart([]); // the orders are sent, so empty the cart
      setSentCount(orders.length);
    } catch (err) {
      console.error(err);
      setError(err.message); // 409 Conflict, like "Only 3 kg of Tomato from Ana Reyes is left. Lower the quantity."
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <div className="page-banner">
        <h1>Your cart</h1>
        <p>Send an order request. The farmer accepts it, then you agree on payment and pickup by phone.</p>
      </div>

      {sentCount > 0 && (
        <p className="success-box" role="status">
          {sentCount === 1 ? "Your order request was sent." : `Your ${sentCount} order requests were sent.`} The farmer
          will accept or decline it. <Link to="/orders">See your orders</Link>
        </p>
      )}
      {error && <ErrorMessage message={error} />}

      {cart.length === 0 ? (
        <div className="empty">
          <p>Your cart is empty.</p>
          <Link to="/marketplace" className="btn btn-primary">
            Go to the Marketplace
          </Link>
        </div>
      ) : (
        <div className="card cart">
          <ul className="cart-list">
            {cart.map((item) => {
              const { listing } = item;
              const problem = checkItem(item);
              const inputId = `cart-kilos-${listing.id}`;
              return (
                <li key={listing.id} className="cart-item">
                  <div className="cart-item-info">
                    <strong>{listing.crop}</strong>
                    <span className="muted">
                      {listing.ownerName} · {listing.town} · ₱{formatPeso(listing.pricePerKg)}/kg
                    </span>
                  </div>
                  <div className="cart-item-kilos">
                    <label htmlFor={inputId}>Kilos</label>
                    <input
                      id={inputId}
                      type="number"
                      min="1"
                      max={listing.quantityKg}
                      step="1"
                      inputMode="numeric"
                      // An empty box is saved as 0, so checkItem() asks for a number
                      value={item.quantityKg || ""}
                      onChange={(e) => changeQuantity(listing.id, Number(e.target.value))}
                      aria-invalid={Boolean(problem)}
                      aria-describedby={problem ? `${inputId}-error` : undefined}
                    />
                    {problem && (
                      <p id={`${inputId}-error`} className="field-error">
                        {problem}
                      </p>
                    )}
                  </div>
                  <p className="cart-item-total">₱{formatPeso((item.quantityKg || 0) * listing.pricePerKg)}</p>
                  <button type="button" className="btn btn-danger" onClick={() => removeFromCart(listing.id)}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="cart-footer">
            <p className="cart-total">
              Total <strong>₱{formatPeso(total)}</strong>
            </p>
            <p className="help">No payment in the app. You and the farmer agree on payment and pickup by phone.</p>
            <button type="button" className="btn btn-primary" onClick={handleCheckout} disabled={sending || hasProblem}>
              {sending ? "Sending..." : "Send order request"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default Cart;
