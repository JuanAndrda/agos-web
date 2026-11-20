// Orders.js: the order requests. What you see depends on your role:
// - a buyer sees "My orders" (what I asked to buy, with Cancel)
// - a farmer sees "Orders received" (requests for their crops, with Accept and Decline)
// Each button sends PATCH /api/orders/:id with the new status. Decline and Cancel put the kilos
// back on the listing (the server does it in server/orders.js).
// Since Nov 20 the orders come ONE PAGE at a time from the server (GET /api/orders/...?page=2&limit=6),
// with status buttons (All, Waiting, Accepted, ...) and the page buttons from Pagination.js.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyOrders, getReceivedOrders, setOrderStatus } from "../services/ordersService";
import { formatPeso } from "../constants";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import Pagination from "../components/Pagination";

// The words we show for each status
const STATUS_TEXT = {
  pending: "Waiting for the farmer",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
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
          {/* Test data (server/demo/seed.js), not a real order */}
          {order.demo && <span className="demo-badge">Demo</span>}
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

// user is a prop from App.js
function Orders({ user }) {
  const isFarmer = user.role === "farmer";
  const [orders, setOrders] = useState([]); // only the orders on THIS page
  // The page, the status filter, and the numbers the server sends back
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(6); // orders per page: 6, 12 or 24
  const [status, setStatus] = useState(""); // "" = all statuses
  const [total, setTotal] = useState(0); // orders with this status, on all pages
  const [totalPages, setTotalPages] = useState(1);
  const [totalAll, setTotalAll] = useState(0); // all my orders, any status
  const [counts, setCounts] = useState({}); // like { pending: 3, accepted: 1 }
  // The page and page size of the orders ON SCREEN (from the server's answer), see Marketplace.js
  const [shownPage, setShownPage] = useState(1);
  const [shownLimit, setShownLimit] = useState(6);
  const [reloadCount, setReloadCount] = useState(0); // +1 = load this page again
  const [loading, setLoading] = useState(true); // waiting for the server right now
  const [loadedOnce, setLoadedOnce] = useState(false); // the first page has arrived
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null); // the order that is being changed right now

  useEffect(() => {
    document.title = "Orders · AgosUgnayan Web";
  }, []);

  // READ: GET one page of orders. It runs when the page opens, and again when the page, the
  // page size, the status filter or reloadCount changes (the list in [ ] at the end).
  // "stale" makes sure an old, slow answer never replaces a newer one.
  useEffect(() => {
    let stale = false;
    async function loadOrders() {
      setLoading(true);
      setError("");
      try {
        const options = { page: page, limit: limit, status: status };
        const data = isFarmer
          ? await getReceivedOrders(options) // READ: GET /api/orders/received?page=...
          : await getMyOrders(options); // READ: GET /api/orders/mine?page=...
        if (stale) return;
        setOrders(data.orders);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setTotalAll(data.totalAll);
        setCounts(data.counts);
        setShownPage(data.page);
        setShownLimit(data.limit);
        setLoadedOnce(true);
        if (data.page !== page) setPage(data.page); // the page we asked for no longer exists
      } catch (err) {
        console.error(err);
        if (!stale) setError(err.message);
      } finally {
        if (!stale) setLoading(false);
      }
    }
    loadOrders();
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status, reloadCount]);

  function changeStatusFilter(value) {
    setStatus(value);
    setPage(1); // a new filter starts on page 1
  }

  function goToPage(n) {
    setPage(n);
    document.getElementById("order-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changeLimit(n) {
    setLimit(n);
    setPage(1);
  }

  // Accept, Decline or Cancel one order: UPDATE with PATCH /api/orders/:id
  async function changeStatus(order, status, successText) {
    setBusyId(order.id);
    setMessage("");
    setActionError("");
    try {
      await setOrderStatus(order.id, status);
      setMessage(successText);
      setReloadCount(reloadCount + 1); // load this page again, so the change and the counts show
    } catch (err) {
      console.error(err);
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // The status buttons: All (12), Waiting (3), Accepted (2), ... The numbers come from the server.
  const statusButtons =
    totalAll > 0 ? (
      <div className="category-chips" role="group" aria-label="Show orders by status">
        <button type="button" className="chip" aria-pressed={status === ""} onClick={() => changeStatusFilter("")}>
          All <span>{totalAll}</span>
        </button>
        {Object.keys(STATUS_TEXT).map((key) => (
          <button key={key} type="button" className="chip" aria-pressed={status === key} onClick={() => changeStatusFilter(key)}>
            {STATUS_TEXT[key]} <span>{counts[key] || 0}</span>
          </button>
        ))}
      </div>
    ) : null;

  const pagination = (
    <Pagination
      id="orders"
      page={shownPage}
      totalPages={totalPages}
      total={total}
      limit={shownLimit}
      itemName="orders"
      onPageChange={goToPage}
      onLimitChange={changeLimit}
    />
  );

  return (
    <section>
      <div className="page-banner">
        <h1>Orders</h1>
        <p>
          {isFarmer
            ? "Order requests from buyers for your crops. Accept or decline each one, then mark it completed after pickup."
            : "Your order requests. The farmer accepts or declines each one."}
        </p>
      </div>

      {message && (
        <p className="success-box" role="status">
          {message}
        </p>
      )}
      {actionError && <ErrorMessage message={actionError} />}
      <div id="order-results" />
      {/* "Loading" only for the first page; after that the old page stays (dimmed) until the new one comes */}
      {loading && !loadedOnce && <Loading text="Loading orders..." />}
      {error && <ErrorMessage message={error} onRetry={() => setReloadCount(reloadCount + 1)} />}

      {loadedOnce && !error && (
        <>
          {isFarmer && (
            <div className="card orders-card">
              <h2>Orders received</h2>
              {statusButtons}
              {orders.length === 0 ? (
                <p className="muted">{totalAll === 0 ? "No one has ordered your crops yet." : "No orders with this status."}</p>
              ) : (
                <ul className={loading ? "order-list results-loading" : "order-list"} aria-busy={loading}>
                  {orders.map((order) => (
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
                      {/* An accepted order can't be declined anymore. When the buyer has picked up and paid,
                          the farmer marks it completed. That also unlocks the listing. */}
                      {order.status === "accepted" && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busyId === order.id}
                          onClick={() => changeStatus(order, "completed", `The ${order.crop} order is completed. Thank you!`)}
                        >
                          Mark as completed
                        </button>
                      )}
                    </OrderRow>
                  ))}
                </ul>
              )}
              {totalAll > 0 && pagination}
            </div>
          )}

          {!isFarmer && (
            <div className="card orders-card">
              <h2>My orders</h2>
              {statusButtons}
              {orders.length === 0 ? (
                totalAll === 0 ? (
                  <p className="muted">
                    You haven't ordered anything yet. <Link to="/marketplace">Browse the Marketplace</Link>
                  </p>
                ) : (
                  <p className="muted">No orders with this status.</p>
                )
              ) : (
                <ul className={loading ? "order-list results-loading" : "order-list"} aria-busy={loading}>
                  {orders.map((order) => (
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
              {totalAll > 0 && pagination}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Orders;
