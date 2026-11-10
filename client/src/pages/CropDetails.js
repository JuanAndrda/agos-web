// CropDetails.js: one crop's page. It uses TWO APIs at the same time:
// Wikipedia (photo and description, called directly) and our server (PSA prices by month).
// The crop name comes from the URL: /crops/Tomato -> cropName = "Tomato".
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CROPS, formatPeso } from "../constants";
import { getCropInfo } from "../services/wikipediaService";
import { getPriceHistory } from "../services/pricesService";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";

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

  const loadInfo = useCallback(async () => {
    setInfoLoading(true);
    setInfoError("");
    try {
      setInfo(await getCropInfo(cropName)); // GET Wikipedia /page/summary/<title>
    } catch (err) {
      setInfoError(err.message);
    } finally {
      setInfoLoading(false);
    }
  }, [cropName]);

  const loadPrices = useCallback(async () => {
    setPricesLoading(true);
    setPricesError("");
    try {
      const data = await getPriceHistory(cropName); // GET /api/prices/<cropName>
      setHistory(data.history.slice(0, 12)); // the newest 12 months
    } catch (err) {
      setPricesError(err.message);
    } finally {
      setPricesLoading(false);
    }
  }, [cropName]);

  // Load both when the page opens (or when the crop in the URL changes)
  useEffect(() => {
    if (knownCrop) {
      loadInfo();
      loadPrices();
    }
  }, [knownCrop, loadInfo, loadPrices]);

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

  const latest = history[0];

  return (
    <section>
      <Link to="/prices" className="back-link">
        ← Back to Market Prices
      </Link>
      <h1>{cropName}</h1>

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
          <p className="source-line small">
            Source: <strong>PSA OpenSTAT</strong> · monthly, not real-time
          </p>
          {pricesLoading && <Loading text="Getting prices from PSA..." />}
          {pricesError && <ErrorMessage message={pricesError} onRetry={loadPrices} />}
          {!pricesLoading && !pricesError && history.length === 0 && (
            <p className="muted">PSA has no recent prices for {cropName}.</p>
          )}
          {!pricesLoading && !pricesError && latest && (
            <>
              <p className="big-price">
                ₱{formatPeso(latest.pricePerKg)} <span>per kg</span>
              </p>
              <p className="muted small">Newest PSA price: {latest.month}</p>
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
            </>
          )}
        </article>
      </div>
    </section>
  );
}

export default CropDetails;
