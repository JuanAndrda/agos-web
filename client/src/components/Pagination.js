// Pagination.js: the page buttons under a long list: "← Previous  1 … 4 [5] 6 … 10  Next →",
// the text "Showing 49–60 of 115 listings", and a "Per page" box (6, 12 or 24).
// It doesn't load anything itself. The page gives it the numbers from the server's answer and
// two functions: onPageChange(5) when a page button is pressed, onLimitChange(24) for "Per page".
// Used by the Marketplace and Orders pages.

const PAGE_SIZES = [6, 12, 24]; // the same choices the server allows (server/paginate.js)

// Which page buttons to show. With 10 pages and page 5 open: [1, "…", 4, 5, 6, "…", 10].
// Always the first page, the last page, and the pages next to the open one.
function pageButtons(page, totalPages) {
  const buttons = [];
  for (let n = 1; n <= totalPages; n++) {
    const nearOpenPage = Math.abs(n - page) <= 1;
    if (n === 1 || n === totalPages || nearOpenPage) {
      buttons.push(n);
    } else if (buttons[buttons.length - 1] !== "…") {
      buttons.push("…"); // one "…" for every run of hidden pages
    }
  }
  return buttons;
}

function Pagination({ id, page, totalPages, total, limit, itemName, onPageChange, onLimitChange }) {
  // "Showing 13–24 of 58 listings": the numbers of the first and last item on this page
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <p className="pagination-info" aria-live="polite">
        Showing {first}–{last} of {total} {itemName}
      </p>

      {totalPages > 1 && (
        <nav className="pagination-pages" aria-label={`Pages of ${itemName}`}>
          <button type="button" className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
            ← Previous
          </button>
          {pageButtons(page, totalPages).map((n, i) =>
            n === "…" ? (
              <span key={"gap" + i} className="page-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className={n === page ? "page-btn page-number current" : "page-btn page-number"}
                aria-current={n === page ? "page" : undefined} // tells screen readers "this is the open page"
                aria-label={`Page ${n}`}
                onClick={() => onPageChange(n)}
              >
                {n}
              </button>
            )
          )}
          {/* On a phone the number buttons are hidden (App.css), so this short text shows instead */}
          <span className="page-of">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="page-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </nav>
      )}

      <div className="pagination-size">
        <label htmlFor={id + "-per-page"}>Per page</label>
        <select id={id + "-per-page"} value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default Pagination;
