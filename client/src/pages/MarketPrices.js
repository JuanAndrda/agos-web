// MarketPrices.js: the newest farmgate price of each crop in Iloilo, from PSA through our server.
// Every API page has the same three states: loading, error and data (plus "empty" when there's no data).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPrices } from "../services/pricesService";
import SearchBar from "../components/SearchBar";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { formatPeso } from "../constants";

function MarketPrices() {
  const [prices, setPrices] = useState([]);
  const [checkedAt, setCheckedAt] = useState(null); // when our server last asked PSA
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(""); // what is typed in the box
  const [searched, setSearched] = useState(""); // the search the table is showing

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

  function showAll() {
    setSearch("");
    loadPrices("");
  }

  return (
    <section>
      <h1>Market Prices</h1>
      <p className="source-line">
        Farmgate prices in Iloilo Province · Source: <strong>PSA OpenSTAT</strong>
      </p>
      <p className="muted small">
        PSA updates these prices once a month, a few months late. They are a guide, not today's price.
        {checkedAt &&
          ` Last checked from PSA: ${new Date(checkedAt).toLocaleString("en-PH", {
            dateStyle: "medium", // "Nov 5, 2026", so nobody mixes up the day and the month
            timeStyle: "short", // "2:14 AM"
          })}.`}
      </p>

      <SearchBar
        label="Search a crop"
        value={search}
        onChange={setSearch}
        onSubmit={() => loadPrices(search.trim())}
        placeholder="e.g. tomato"
      />

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
          {searched && (
            <p className="result-note">
              Showing {prices.length} result{prices.length === 1 ? "" : "s"} for "{searched}".{" "}
              <button type="button" className="link-button" onClick={showAll}>
                Show all crops
              </button>
            </p>
          )}
          <div className="table-wrap">
            <table className="price-table">
              <thead>
                <tr>
                  <th scope="col">Crop</th>
                  <th scope="col">Month</th>
                  <th scope="col" className="num">
                    Price per kg
                  </th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.crop}>
                    <td>
                      <Link to={`/crops/${p.crop}`}>{p.crop}</Link>
                    </td>
                    <td>{p.month}</td>
                    <td className="num price">₱{formatPeso(p.pricePerKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Click a crop to see its photo and its price month by month.</p>
        </>
      )}
    </section>
  );
}

export default MarketPrices;
