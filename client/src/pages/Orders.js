// Orders.js: the order requests. What you see depends on your role:
// - a buyer sees "My orders" (what I asked to buy, with Cancel)
// - a farmer sees "Orders received" (requests for their crops, with Accept and Decline)
// Each button sends PATCH /api/orders/:id with the new status. Decline and Cancel put the kilos
// back on the listing (the server does it in server/orders.js).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyOrders, getReceivedOrders, setOrderStatus } from "../services/ordersService";
import { formatPeso } from "../constants";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";

// The words we show for each status
const STATUS_TEXT = {
  pending: "Waiting for the farmer",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
};

// "2026-11-17T12:30:00.000Z" -> "Nov 17, 2026"
function formatDay(text) {
  return text ? new Date(text).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "";
}

// One order as a row: what, how much, the total, who, the status, and the buttons
function OrderRow({ order, who, children }) {
  return (
    <li className="order-row">
      <div className="order-main">
        <strong>
          {order.quantityKg} kg {order.crop}
        </strong>
        <span className="muted">
          ₱{formatPeso(order.pricePerKg)}/kg · {formatDay(order.createdAt)}
        </span>
        <span>{who}</span>
      </div>
      <p className="order-total">₱{formatPeso(order.total)}</p>
      {/* The status in words, so it doesn't rely on color alone */}
      <span className={`order-status order-${order.status}`}>{STATUS_TEXT[order.status]}</span>
      {children && <div className="order-actions">{children}</div>}
    </li>
  );
}

function Orders() {
  const { user } = useAuth();
  const isFarmer = user.role === "farmer";
  const [myOrders, setMyOrders] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null); // the order that is being changed right now

  useEffect(() => {
    document.title = "Orders · AgosUgnayan Web";
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isFarmer) {
        setReceived(await getReceivedOrders()); // READ: GET /api/orders/received
      } else {
        setMyOrders(await getMyOrders()); // READ: GET /api/orders/mine
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isFarmer]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Accept, Decline or Cancel one order: UPDATE with PATCH /api/orders/:id
  async function changeStatus(order, status, successText) {
    setBusyId(order.id);
    setMessage("");
    setActionError("");
    try {
      await setOrderStatus(order.id, status);
      setMessage(successText);
      await loadOrders();
    } catch (err) {
      console.error(err);
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="page-banner">
        <h1>Orders</h1>
        <p>
          {isFarmer
            ? "Order requests from buyers for your crops. Accept or decline each one."
            : "Your order requests. The farmer accepts or declines each one."}
        </p>
      </div>

      {message && (
        <p className="success-box" role="status">
          {message}
        </p>
      )}
      {actionError && <ErrorMessage message={actionError} />}
      {loading && <Loading text="Loading orders..." />}
      {error && <ErrorMessage message={error} onRetry={loadOrders} />}

      {!loading && !error && (
        <>
          {isFarmer && (
            <div className="card orders-card">
              <h2>Orders received</h2>
              {received.length === 0 ? (
                <p className="muted">No one has ordered your crops yet.</p>
              ) : (
                <ul className="order-list">
                  {received.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      who={
                        <>
                          From <strong>{order.buyerName}</strong>{" "}
                          {order.buyerEmail && <a href={`mailto:${order.buyerEmail}`}>{order.buyerEmail}</a>}
                        </>
                      }
                    >
                      {order.status === "pending" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busyId === order.id}
                            onClick={() =>
                              changeStatus(
                                order,
                                "accepted",
                                `You accepted ${order.buyerName}'s order. Contact them to arrange pickup.`,
                              )
                            }
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={busyId === order.id}
                            onClick={() =>
                              changeStatus(
                                order,
                                "declined",
                                `You declined the order. ${order.quantityKg} kg went back to your ${order.crop} listing.`,
                              )
                            }
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </OrderRow>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!isFarmer && (
            <div className="card orders-card">
              <h2>My orders</h2>
              {myOrders.length === 0 ? (
                <p className="muted">
                  You haven't ordered anything yet. <Link to="/marketplace">Browse the Marketplace</Link>
                </p>
              ) : (
                <ul className="order-list">
                  {myOrders.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      who={
                        <>
                          From <strong>{order.farmerName}</strong> in {order.town}{" "}
                          {order.farmerContact && <a href={`tel:${order.farmerContact}`}>{order.farmerContact}</a>}
                        </>
                      }
                    >
                      {order.status === "pending" && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busyId === order.id}
                          onClick={() => changeStatus(order, "cancelled", `Your ${order.crop} order is cancelled.`)}
                        >
                          Cancel order
                        </button>
                      )}
                    </OrderRow>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Orders;
