// MyListings.js: a farmer's own listings, with all four CRUD actions:
// Create (Post a crop), Read (the list), Update (Edit, or Mark as sold) and Delete.
import { useEffect, useState } from "react";
import {
  getMyListings,
  addListing,
  updateListing,
  markSold,
  deleteListing,
} from "../services/listingsService";
import { getCropPhotos } from "../services/wikipediaService";
import ListingCard from "../components/ListingCard";
import ListingForm from "../components/ListingForm";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";

// Available listings first, then the newest first.
// The server sends the time as text like "2026-11-15T12:30:00.000Z", and Date.parse makes it a number.
function sortListings(list) {
  const time = (l) => (l.createdAt ? Date.parse(l.createdAt) : Date.now());
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === "available" ? -1 : 1;
    return time(b) - time(a);
  });
}

function MyListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState(null); // null (no form), "add", or the listing being edited
  const [message, setMessage] = useState(""); // success message, like "Listing deleted."
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null); // the listing that is being changed right now
  const [photos, setPhotos] = useState({}); // like { Tomato: "https://upload.wikimedia.org/..." }

  // The name in the browser tab
  useEffect(() => {
    document.title = "My Listings · AgosUgnayan Web";
  }, []);

  // READ: GET /api/listings/mine. A plain async function with try / catch / finally.
  async function loadListings() {
    setLoading(true);
    setError("");
    try {
      const data = await getMyListings(); // 200 OK: my listings
      setListings(sortListings(data));
      setLoading(false); // show the cards now; the photos come after
      loadPhotos(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // GET Wikipedia for the photo of each crop I sell (once per crop, not once per card)
  async function loadPhotos(list) {
    const crops = [];
    for (const listing of list) {
      if (!crops.includes(listing.crop)) crops.push(listing.crop);
    }
    setPhotos(await getCropPhotos(crops));
  }

  // Load my listings once, when the page opens
  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openForm(mode) {
    setFormMode(mode);
    setMessage("");
    setActionError("");
  }

  // Called by ListingForm after its checks pass. If this throws, the form shows the error.
  async function handleSave(form) {
    try {
      if (formMode === "add") {
        await addListing(form); // CREATE: POST /api/listings
        setMessage(`Your ${form.crop} listing is posted. Buyers can see it in the Marketplace now.`);
      } else {
        await updateListing(formMode.id, form); // UPDATE: PATCH /api/listings/:id
        setMessage(`Your ${form.crop} listing is updated.`);
      }
    } catch (err) {
      console.error(err);
      throw err; // ListingForm catches it and shows the message, like "Only farmers can do this." (403)
    }
    setFormMode(null);
    loadListings();
  }

  // Runs one action (mark sold or delete) on one listing, with a success or error message
  async function runAction(listing, action, successText) {
    setBusyId(listing.id);
    setMessage("");
    setActionError("");
    try {
      await action(listing.id);
      setMessage(successText);
      await loadListings();
    } catch (err) {
      console.error(err);
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function handleMarkSold(listing) {
    runAction(listing, markSold, `Your ${listing.crop} listing is marked as sold. You can change it back with Edit.`); // UPDATE: PATCH
  }

  function handleDelete(listing) {
    // Ask first, because deleting can't be undone
    const ok = window.confirm(`Delete your ${listing.crop} listing? This can't be undone.`);
    if (ok) runAction(listing, deleteListing, `Your ${listing.crop} listing is deleted.`); // DELETE: DELETE /api/listings/:id
  }

  return (
    <section>
      <div className="page-banner page-head">
        <div>
          <h1>My Listings</h1>
          <p>The crops you are selling. Only you can change them.</p>
        </div>
        {formMode === null && (
          <button type="button" className="btn btn-light" onClick={() => openForm("add")}>
            + Post a crop
          </button>
        )}
      </div>

      {message && (
        <p className="success-box" role="status">
          {message}
        </p>
      )}
      {actionError && <ErrorMessage message={actionError} />}

      {formMode !== null && (
        <ListingForm
          key={formMode === "add" ? "add" : formMode.id}
          initialValues={formMode === "add" ? undefined : formMode}
          saveText={formMode === "add" ? "Post listing" : "Save changes"}
          // Locked = buyers have waiting or accepted orders on it, so crop, price and town can't change
          locked={formMode !== "add" && formMode.pendingOrders + formMode.acceptedOrders > 0}
          onSave={handleSave}
          onCancel={() => setFormMode(null)}
        />
      )}

      {loading && <Loading text="Loading your listings..." />}
      {error && <ErrorMessage message={error} onRetry={loadListings} />}

      {!loading && !error && listings.length === 0 && formMode === null && (
        <div className="empty">
          <p>You haven't posted any crops yet. Post your first crop so buyers can find it.</p>
          <button type="button" className="btn btn-primary" onClick={() => openForm("add")}>
            + Post a crop
          </button>
        </div>
      )}

      {!loading && !error && listings.length > 0 && (
        <div className="listing-grid">
          {listings.map((listing) => {
            const busy = busyId === listing.id;
            // The server tells us how many orders are still open on this listing (GET /api/listings/mine)
            const openOrders = listing.pendingOrders + listing.acceptedOrders;
            return (
              <ListingCard key={listing.id} listing={listing} photo={photos[listing.crop]} showFarmer={false}>
                {openOrders > 0 && (
                  <p className="lock-note">
                    🔒 {listing.pendingOrders > 0 && `${listing.pendingOrders} order${listing.pendingOrders === 1 ? "" : "s"} waiting. `}
                    {listing.acceptedOrders > 0 && `${listing.acceptedOrders} accepted. `}
                    The crop, price and town are locked, and it can't be deleted until the orders are finished.
                  </p>
                )}
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => openForm(listing)}>
                  Edit
                </button>
                {listing.status === "available" && (
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handleMarkSold(listing)}>
                    Mark as sold
                  </button>
                )}
                {/* The server also says no (409), but we turn the button off so the farmer sees why first */}
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy || openOrders > 0}
                  title={openOrders > 0 ? "This listing has open orders, so it can't be deleted yet." : undefined}
                  onClick={() => handleDelete(listing)}
                >
                  Delete
                </button>
              </ListingCard>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default MyListings;
