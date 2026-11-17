// MarketPrices.js: the newest farmgate price of each crop in Iloilo, from PSA through our server.
// Every API page has the same three states: loading, error and data (plus "empty" when there's no data).
// Each crop is a card with its Wikipedia photo. Clicking a card opens that crop's Crop Details page.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPrices } from "../services/pricesService";
import { getCropPhotos } from "../services/wikipediaService";
import SearchBar from "../components/SearchBar";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { CROPS, formatPeso } from "../constants";

function MarketPrices() {
  const [prices, setPrices] = useState([]);
  const [checkedAt, setCheckedAt] = useState(null); // when our server last asked PSA
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(""); // what is typed in the box
  const [searched, setSearched] = useState(""); // the search the cards are showing
  const [photos, setPhotos] = useState({}); // like { Tomato: "https://upload.wikimedia.org/..." }

  // The name in the browser tab
  useEffect(() => {
    document.title = "Market Prices · AgosUgnayan Web";
  }, []);

  // useCallback keeps the same function between redraws, so useEffect below runs only once
  const loadPrices = useCallback(async (text) => {
    setLoading(true);
    setError("");
    try {
      const data = await getPrices(text); // GET /api/prices?search=text
      setPrices(data.prices);
      setCheckedAt(data.checkedAt);
      setSearched(text);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load all prices when the page opens
  useEffect(() => {
    loadPrices("");
  }, [loadPrices]);

  // Load the photos of all 10 crops once, from Wikipedia. A search doesn't load them again.
  useEffect(() => {
    getCropPhotos(CROPS).then(setPhotos);
  }, []);

  function showAll() {
    setSearch("");
    loadPrices("");
  }

  // The cheapest and the most expensive crop in the list, for the summary boxes.
  // reduce() goes through the list once and keeps the lowest (or highest) one it has seen.
  const lowest = prices.length > 0 ? prices.reduce((a, b) => (b.pricePerKg < a.pricePerKg ? b : a)) : null;
  const highest = prices.length > 0 ? prices.reduce((a, b) => (b.pricePerKg > a.pricePerKg ? b : a)) : null;

  return (
    <section>
      {/* page-banner: the green box at the top of each page (App.css). The search sits inside it. */}
      <div className="page-banner">
        <h1>Market Prices</h1>
        <p className="source-line">
          Farmgate prices in Iloilo Province · Source: <strong>PSA OpenSTAT</strong>
        </p>
        <SearchBar
          label="Search a crop"
          value={search}
          onChange={setSearch}
          onSubmit={() => loadPrices(search.trim())}
          placeholder="e.g. tomato"
        />
      </div>

      {loading && <Loading text="Getting prices from PSA..." />}

      {error && <ErrorMessage message={error} onRetry={() => loadPrices(search.trim())} />}

      {!loading && !error && prices.length === 0 && (
        <div className="empty">
          <p>No crops found for "{searched}". Try another name, like tomato or onion.</p>
          <button type="button" className="btn btn-secondary" onClick={showAll}>
            Show all crops
          </button>
        </div>
      )}

      {!loading && !error && prices.length > 0 && (
        <>
          {/* Summary boxes: worked out in React from the same prices, no extra API call */}
          <div className="price-summary">
            <Link to={`/crops/${lowest.crop}`} className="summary-box">
              <span>Lowest price</span>
              <strong>₱{formatPeso(lowest.pricePerKg)}</strong>
              <small>{lowest.crop} · per kg</small>
            </Link>
            <Link to={`/crops/${highest.crop}`} className="summary-box">
              <span>Highest price</span>
              <strong>₱{formatPeso(highest.pricePerKg)}</strong>
              <small>{highest.crop} · per kg</small>
            </Link>
            <div className="summary-box">
              <span>Crops shown</span>
              <strong>{prices.length}</strong>
              <small>{searched ? `matching "${searched}"` : "all crops PSA tracks"}</small>
            </div>
          </div>

          <p className="result-note small">
            {searched && (
              <>
                Showing {prices.length} result{prices.length === 1 ? "" : "s"} for "{searched}".{" "}
                <button type="button" className="link-button" onClick={showAll}>
                  Show all crops
                </button>{" "}
              </>
            )}
            PSA updates these prices once a month, a few months late. They are a guide, not today's price.
            {checkedAt &&
              ` Last checked from PSA: ${new Date(checkedAt).toLocaleString("en-PH", {
                dateStyle: "medium", // "Nov 5, 2026", so nobody mixes up the day and the month
                timeStyle: "short", // "2:14 AM"
              })}.`}
          </p>

          {/* One card per crop. The whole card is a link, so it's easy to click or tap. */}
          <div className="price-grid">
            {prices.map((p) => (
              <Link key={p.crop} to={`/crops/${p.crop}`} className="price-card">
                {photos[p.crop] ? (
                  <img src={photos[p.crop]} alt="" />
                ) : (
                  <span className="price-card-letter" aria-hidden="true">
                    {p.crop[0]}
                  </span>
                )}
                <span className="price-card-body">
                  <strong className="price-card-name">{p.crop}</strong>
                  <span className="price-card-price">
                    ₱{formatPeso(p.pricePerKg)} <small>per kg</small>
                  </span>
                  <span className="price-card-month">{p.month}</span>
                  <span className="price-card-more">View price history →</span>
                </span>
              </Link>
            ))}
          </div>
          <p className="muted small">Photos: Wikipedia</p>
        </>
      )}
    </section>
  );
}

export default MarketPrices;
