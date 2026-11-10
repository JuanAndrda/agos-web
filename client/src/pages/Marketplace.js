// Marketplace.js: every available listing, for buyers (and farmers) to browse.
// We load the listings from Firestore once, then search, filter and sort them in React
// with .filter() and .sort(). Nothing is sent to the database when a filter changes.
import { useCallback, useEffect, useState } from "react";
import { getAvailableListings } from "../services/listingsService";
import { TOWNS } from "../constants";
import SearchBar from "../components/SearchBar";
import ListingCard from "../components/ListingCard";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";

// Firestore saves the time as a Timestamp. This gives us a number we can sort by.
function timeOf(listing) {
  return listing.createdAt ? listing.createdAt.toMillis() : 0;
}

function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The filters
  const [search, setSearch] = useState("");
  const [town, setTown] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");

  // The name in the browser tab
  useEffect(() => {
    document.title = "Marketplace · AgosUgnayan Web";
  }, []);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setListings(await getAvailableListings()); // READ from Firestore
    } catch (err) {
      console.error(err);
      setError("We couldn't load the listings. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  // 1. Filter: keep only the listings that match every filter
  const text = search.trim().toLowerCase();
  const shown = listings
    .filter((l) => l.crop.toLowerCase().includes(text))
    .filter((l) => town === "" || l.town === town)
    .filter((l) => minPrice === "" || l.pricePerKg >= Number(minPrice))
    .filter((l) => maxPrice === "" || l.pricePerKg <= Number(maxPrice));

  // 2. Sort
  if (sort === "newest") shown.sort((a, b) => timeOf(b) - timeOf(a));
  if (sort === "price-low") shown.sort((a, b) => a.pricePerKg - b.pricePerKg);
  if (sort === "price-high") shown.sort((a, b) => b.pricePerKg - a.pricePerKg);

  const filtersOn = text !== "" || town !== "" || minPrice !== "" || maxPrice !== "";

  // A max price below the min price can never match anything, so we explain it
  const priceRangeWrong = minPrice !== "" && maxPrice !== "" && Number(maxPrice) < Number(minPrice);

  function clearFilters() {
    setSearch("");
    setTown("");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <section>
      <h1>Marketplace</h1>
      <p className="muted">Crops that Iloilo farmers are selling now.</p>

      <div className="filters card">
        <SearchBar label="Search a crop" value={search} onChange={setSearch} placeholder="e.g. eggplant" />

        <div className="filter-row">
          <div className="field">
            <label htmlFor="town-filter">Town</label>
            <select id="town-filter" value={town} onChange={(e) => setTown(e.target.value)}>
              <option value="">All towns</option>
              {TOWNS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="min-price">Min price per kg (₱)</label>
            <input
              id="min-price"
              type="number"
              min="0"
              inputMode="decimal"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="max-price">Max price per kg (₱)</label>
            <input
              id="max-price"
              type="number"
              min="0"
              inputMode="decimal"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              aria-invalid={priceRangeWrong}
              aria-describedby={priceRangeWrong ? "max-price-error" : undefined}
            />
            {priceRangeWrong && (
              <p id="max-price-error" className="field-error">
                Max price can't be lower than min price.
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <Loading text="Loading listings..." />}
      {error && <ErrorMessage message={error} onRetry={loadListings} />}

      {!loading && !error && listings.length === 0 && (
        <div className="empty">
          <p>No crops are for sale right now. Please check again later.</p>
        </div>
      )}

      {!loading && !error && listings.length > 0 && (
        <>
          <p className="result-note" aria-live="polite">
            Showing {shown.length} of {listings.length} listing{listings.length === 1 ? "" : "s"}.{" "}
            {filtersOn && (
              <button type="button" className="link-button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>

          {shown.length === 0 ? (
            <div className="empty">
              <p>
                {priceRangeWrong
                  ? "The max price is lower than the min price. Change one of them, or clear the filters."
                  : "No listings match your filters."}
              </p>
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="listing-grid">
              {shown.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Marketplace;
