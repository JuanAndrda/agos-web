// MyListings.js: a farmer's own listings, with all four CRUD actions:
// Create (Post a crop), Read (the list), Update (Edit, or Mark as sold) and Delete.
import { useCallback, useEffect, useState } from "react";
import {
  getMyListings,
  addListing,
  updateListing,
  markSold,
  deleteListing,
  friendlyListingError,
} from "../services/listingsService";
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

  // The name in the browser tab
  useEffect(() => {
    document.title = "My Listings · AgosUgnayan Web";
  }, []);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setListings(sortListings(await getMyListings())); // READ: GET /api/listings/mine
    } catch (err) {
      console.error(err);
      setError(friendlyListingError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

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
      throw new Error(friendlyListingError(err));
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
      setActionError(friendlyListingError(err));
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
            return (
              <ListingCard key={listing.id} listing={listing} showFarmer={false}>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => openForm(listing)}>
                  Edit
                </button>
                {listing.status === "available" && (
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handleMarkSold(listing)}>
                    Mark as sold
                  </button>
                )}
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => handleDelete(listing)}>
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
