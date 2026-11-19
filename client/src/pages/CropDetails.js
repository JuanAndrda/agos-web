// CropDetails.js: one crop's page. It uses TWO APIs at the same time:
// Wikipedia (photo and description, called directly) and our server (PSA prices by month).
// The crop name comes from the URL: /crops/Tomato -> cropName = "Tomato".
// The prices are shown as 3 boxes (latest, previous month, change) and a line chart (PriceChart.js).
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CROPS, formatPeso } from "../constants";
import { getCropInfo } from "../services/wikipediaService";
import { getPriceHistory } from "../services/pricesService";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import PriceChart from "../components/PriceChart";

function CropDetails() {
  const { cropName: nameInUrl } = useParams();
  // Find the crop whatever the capital letters are: /crops/tomato shows "Tomato"
  const cropName = CROPS.find((crop) => crop.toLowerCase() === nameInUrl.toLowerCase());
  const knownCrop = Boolean(cropName);

  // The name in the browser tab
  useEffect(() => {
    document.title = `${cropName || "Crop not found"} · AgosUgnayan Web`;
  }, [cropName]);

  // Wikipedia part
  const [info, setInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState("");

  // PSA prices part
  const [history, setHistory] = useState([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState("");
  const [stale, setStale] = useState(false); // true = PSA isn't answering, these are older prices

  // API 1: Wikipedia (photo and description). Plain async function with try / catch / finally.
  async function loadInfo() {
    setInfoLoading(true);
    setInfoError("");
    try {
      setInfo(await getCropInfo(cropName)); // GET Wikipedia /page/summary/<title>
    } catch (err) {
      console.error(err);
      setInfoError(err.message);
    } finally {
      setInfoLoading(false);
    }
  }

  // API 2: our server (PSA prices by month)
  async function loadPrices() {
    setPricesLoading(true);
    setPricesError("");
    try {
      const data = await getPriceHistory(cropName); // GET /api/prices/<cropName>
      setHistory(data.history.slice(0, 12)); // the newest 12 months
      setStale(data.stale);
    } catch (err) {
      console.error(err);
      setPricesError(err.message);
    } finally {
      setPricesLoading(false);
    }
  }

  // Load both when the page opens, and again when the crop in the URL changes ([cropName])
  useEffect(() => {
    if (knownCrop) {
      loadInfo();
      loadPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropName]);

  if (!knownCrop) {
    return (
      <section>
        <Link to="/prices" className="back-link">
          ← Back to Market Prices
        </Link>
        <div className="empty">
          <p>We don't have a crop called "{nameInUrl}". Choose one from the Market Prices list.</p>
        </div>
      </section>
    );
  }

  const latest = history[0]; // PSA sends the newest month first
  const previous = history[1]; // the month before it
  const change = latest && previous ? latest.pricePerKg - previous.pricePerKg : null;
  const changePercent = change !== null ? (change / previous.pricePerKg) * 100 : null;

  return (
    <section>
      <Link to="/prices" className="back-link">
        ← Back to Market Prices
      </Link>
      <div className="page-banner">
        <h1>{cropName}</h1>
        <p>Photo and description from Wikipedia, farmgate prices from PSA.</p>
      </div>

      <div className="details-grid">
        {/* About the crop, from Wikipedia */}
        <article className="card">
          <h2>About {cropName}</h2>
          {infoLoading && <Loading text="Getting the photo from Wikipedia..." />}
          {infoError && <ErrorMessage message={infoError} onRetry={loadInfo} />}
          {!infoLoading && !infoError && !info && (
            <p className="muted">Wikipedia has no page for this crop.</p>
          )}
          {!infoLoading && !infoError && info && (
            <>
              {info.photo && (
                <img className="crop-photo" src={info.photo} alt={`${cropName}, from Wikipedia`} />
              )}
              <p>{info.description}</p>
              <p className="muted small">
                Photo and text: Wikipedia ·{" "}
                {info.link && (
                  <a href={info.link} target="_blank" rel="noreferrer">
                    Read more on Wikipedia
                  </a>
                )}
              </p>
            </>
          )}
        </article>

        {/* Prices by month, from PSA through our server */}
        <article className="card">
          <h2>Farmgate price in Iloilo</h2>
          <p className="source-line small muted">
            Source: <strong>PSA OpenSTAT</strong> · monthly, not real-time
          </p>
          {pricesLoading && <Loading text="Getting prices from PSA..." />}
          {pricesError && <ErrorMessage message={pricesError} onRetry={loadPrices} />}
          {!pricesLoading && !pricesError && history.length === 0 && (
            <p className="muted">PSA has no recent prices for {cropName}.</p>
          )}
          {!pricesLoading && !pricesError && latest && (
            <>
              {stale && (
                <p className="warning-box" role="status">
                  PSA isn't answering right now, so these are the prices we got from PSA earlier.
                </p>
              )}
              {/* 3 boxes: the newest price, the month before, and the difference */}
              <div className="price-summary">
                <div className="summary-box">
                  <span>Latest price</span>
                  <strong>₱{formatPeso(latest.pricePerKg)}</strong>
                  <small>{latest.month} · per kg</small>
                </div>
                {previous && (
                  <div className="summary-box">
                    <span>Previous month</span>
                    <strong>₱{formatPeso(previous.pricePerKg)}</strong>
                    <small>{previous.month} · per kg</small>
                  </div>
                )}
                {change !== null && (
                  // The arrow AND the words say up or down, so it doesn't depend on color
                  <div className="summary-box">
                    <span>Change</span>
                    <strong>
                      {change > 0 ? "▲" : change < 0 ? "▼" : "="} ₱{formatPeso(Math.abs(change))}
                    </strong>
                    <small>
                      {change > 0 ? "Up" : change < 0 ? "Down" : "No change"}{" "}
                      {change !== 0 && `${Math.abs(changePercent).toFixed(1)}% `}from {previous.month}
                    </small>
                  </div>
                )}
              </div>

              <h3 className="chart-title">Price per kg, last {history.length} months</h3>
              {/* key={cropName}: start fresh (newest month selected) when the crop changes */}
              <PriceChart key={cropName} history={history} />
              <p className="muted small">Click a point, or press Tab and Enter, to see that month's price.</p>

              {/* The same numbers as a table, for anyone who prefers a list. <details> opens and closes by itself. */}
              <details className="table-toggle">
                <summary>Show all months as a table</summary>
                <div className="table-wrap">
                  <table className="price-table">
                    <caption>Price per kg, newest month first</caption>
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col" className="num">
                          Price per kg
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((p) => (
                        <tr key={p.monthKey}>
                          <td>{p.month}</td>
                          <td className="num price">₱{formatPeso(p.pricePerKg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </article>
      </div>
    </section>
  );
}

export default CropDetails;
