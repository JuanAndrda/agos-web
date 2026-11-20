// CropDetails.js: one crop's page. It uses TWO APIs at the same time:
// Wikipedia (photo and description, called directly) and our server (PSA prices by month).
// The crop name comes from the URL: /crops/Tomato -> cropName = "Tomato".
// First we check the name in our crop catalog (GET /api/crops), then we call the two APIs.
// The prices are shown as 3 boxes (latest, previous month, change) and a line chart (PriceChart.js).
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatPeso } from "../constants";
import { getCrops } from "../services/cropsService";
import { getCropInfo } from "../services/wikipediaService";
import { getPriceHistory } from "../services/pricesService";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import PriceChart from "../components/PriceChart";

function CropDetails() {
  const { cropName: nameInUrl } = useParams();

  // Step 0: find the crop in our catalog, whatever the capital letters are (/crops/tomato -> "Tomato")
  const [crop, setCrop] = useState(null); // like { name: "Tomato", category: "Fruit vegetables", ... }
  const [cropLoading, setCropLoading] = useState(true);
  const [cropError, setCropError] = useState("");
  const cropName = crop ? crop.name : "";

  async function loadCrop() {
    setCropLoading(true);
    setCropError("");
    try {
      const data = await getCrops(); // GET /api/crops
      const found = data.crops.find((c) => c.name.toLowerCase() === nameInUrl.toLowerCase());
      setCrop(found || null); // null = we don't have this crop
    } catch (err) {
      console.error(err);
      setCropError(err.message);
    } finally {
      setCropLoading(false);
    }
  }

  // Check the crop when the page opens, and again when the name in the URL changes
  useEffect(() => {
    loadCrop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInUrl]);

  // The name in the browser tab
  useEffect(() => {
    if (!cropLoading) document.title = `${cropName || "Crop not found"} · AgosUgnayan Web`;
  }, [cropName, cropLoading]);

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

  // Load both once we know the crop, and again when the crop changes ([cropName])
  useEffect(() => {
    if (cropName) {
      loadInfo();
      loadPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropName]);

  if (cropLoading) return <Loading text="Finding the crop..." />;
  if (cropError) return <ErrorMessage message={cropError} onRetry={loadCrop} />;

  if (!crop) {
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
        <p>
          {crop.category} · Photo and description from Wikipedia, farmgate prices from PSA.
        </p>
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
            <p className="muted">
              PSA has no Iloilo price for {cropName} in the last 2 years. Farmers can still post it in the
              Marketplace with their own price.
            </p>
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
                  <span>Latest available price</span>
                  <strong>₱{formatPeso(latest.pricePerKg)}</strong>
                  <small>{latest.month} · per kg</small>
                  {/* PSA's newest month has no price for this crop, so we say this one is older */}
                  {crop.latest && crop.latest.older && <small className="older-month">Older price: newer months have none</small>}
                </div>
                {previous && (
                  <div className="summary-box">
                    {/* Some crops skip months, so this is the price before, which may be 2+ months back */}
                    <span>Previous price</span>
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
