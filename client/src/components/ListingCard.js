// ListingCard.js: one crop listing as a card. Used on the Marketplace and on My Listings.
// "children" are extra buttons (Edit, Delete...) that only My Listings passes in.
// "showFarmer" is false on My Listings, where every listing is the farmer's own,
// so we hide the farmer's name and contact number there.
import { Link } from "react-router-dom";
import { formatPeso } from "../constants";

// "2026-11-18" -> "Nov 18, 2026"
function formatDate(text) {
  if (!text) return "";
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "09171234567" -> "0917 123 4567", easier to read (and "+639171234567" -> "+63 917 123 4567")
function formatPhone(number) {
  if (number.startsWith("+63")) {
    return `+63 ${number.slice(3, 6)} ${number.slice(6, 9)} ${number.slice(9)}`;
  }
  return `${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}`;
}

function ListingCard({ listing, children, showFarmer = true }) {
  const sold = listing.status === "sold";

  return (
    <article className={sold ? "card listing-card sold" : "card listing-card"}>
      <div className="listing-top">
        <h3>
          <Link to={`/crops/${listing.crop}`}>{listing.crop}</Link>
        </h3>
        {/* The status is written in words, not shown by color alone */}
        <span className={sold ? "status status-sold" : "status status-available"}>
          {sold ? "Sold" : "Available"}
        </span>
      </div>

      <p className="listing-price">
        ₱{formatPeso(listing.pricePerKg)} <span>per kg</span>
      </p>

      <dl className="listing-facts">
        <div>
          <dt>Quantity</dt>
          <dd>{Number(listing.quantityKg).toLocaleString("en-PH")} kg</dd>
        </div>
        <div>
          <dt>Town</dt>
          <dd>{listing.town}</dd>
        </div>
        {listing.harvestDate && (
          <div>
            <dt>Harvest</dt>
            <dd>{formatDate(listing.harvestDate)}</dd>
          </div>
        )}
        {showFarmer && (
          <div>
            <dt>Farmer</dt>
            <dd>{listing.ownerName}</dd>
          </div>
        )}
        {/* Older listings were posted before we added the number, so we check that there is one */}
        {showFarmer && listing.contactNumber && (
          <div>
            <dt>Contact</dt>
            <dd>
              {/* "tel:" opens the phone app on a phone, so the buyer can call or text in one tap */}
              <a href={`tel:${listing.contactNumber}`} className="contact-link">
                {formatPhone(listing.contactNumber)}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {listing.notes && <p className="listing-notes">{listing.notes}</p>}

      {children && <div className="listing-actions">{children}</div>}
    </article>
  );
}

export default ListingCard;
