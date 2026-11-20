// CropPicker.js: a search box with a drop-down list, for choosing one crop out of about 100.
// A normal <select> with 104 options is a very long list that is hard to use on a phone,
// so instead:
//   - you TYPE part of the name ("mang") and the list shows only the crops that match,
//   - the crops are GROUPED by category (Fruit vegetables, Leafy vegetables, ... Fruits),
//   - the list has a fixed height and scrolls by itself, so the form doesn't get longer,
//   - each crop shows its newest PSA price and the MONTH of that price.
// It works with the mouse, touch and the keyboard (arrow keys, Enter, Escape).
//
// It is a reusable component: any form can use it (today: the listing form; later maybe a
// demand form). The form gives it the crops (from GET /api/crops) and gets the chosen name back:
//   <CropPicker id="crop" crops={crops} categories={categories} value={form.crop} onChange={...} />
import { useEffect, useState } from "react";
import { formatPeso } from "../constants";
import { groupByCategory } from "../services/cropsService";

function CropPicker({ id, crops, categories, value, onChange, disabled, invalid, describedBy }) {
  const [open, setOpen] = useState(false); // is the list showing?
  const [query, setQuery] = useState(""); // what the person typed
  const [activeIndex, setActiveIndex] = useState(0); // the crop the arrow keys are on

  // 1. Keep the crops whose name (or category) has the typed text, then group them
  const text = query.trim().toLowerCase();
  const matches = crops.filter(
    (crop) => crop.name.toLowerCase().includes(text) || crop.category.toLowerCase().includes(text)
  );
  const groups = groupByCategory(categories, matches);
  // The same crops in one list, in the order they appear on screen (for the arrow keys)
  const shownInOrder = [];
  for (const group of groups) {
    for (const crop of group.crops) shownInOrder.push(crop);
  }

  const selected = crops.find((crop) => crop.name === value); // the chosen crop, or undefined

  // When the arrow keys move, scroll the list so the highlighted crop can be seen
  useEffect(() => {
    if (!open) return;
    const option = document.getElementById(`${id}-option-${activeIndex}`);
    if (option) option.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, id]);

  function openList() {
    setQuery(""); // start with every crop
    // Start the highlight on the chosen crop, so Enter keeps it. (With nothing typed, the list
    // shows every crop in category order, the same order as the catalog.)
    const allInOrder = [];
    for (const group of groupByCategory(categories, crops)) {
      for (const crop of group.crops) allInOrder.push(crop);
    }
    const index = allInOrder.findIndex((crop) => crop.name === value);
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    setQuery("");
  }

  function choose(crop) {
    onChange(crop.name); // tell the form
    closeList();
  }

  function handleTyping(event) {
    setQuery(event.target.value);
    setActiveIndex(0); // the list changed, so highlight the first match
    setOpen(true);
  }

  // Keyboard: Down/Up move the highlight, Enter chooses it, Escape closes the list
  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault(); // don't scroll the page
      if (!open) return openList();
      setActiveIndex(Math.min(activeIndex + 1, shownInOrder.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault(); // Enter would submit the whole form
      if (shownInOrder[activeIndex]) choose(shownInOrder[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      closeList();
    }
  }

  // Close the list when the cursor leaves the picker (Tab key, or a click somewhere else)
  function handleBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) closeList();
  }

  // The ▾ button opens or closes the list, and puts the cursor in the search box
  function toggleList() {
    if (open) {
      closeList();
    } else {
      openList();
      document.getElementById(id).focus();
    }
  }

  // The price part of one crop row: the newest PSA price and its month, or "no price"
  function priceText(crop) {
    if (!crop.latest) return <span className="crop-option-price muted">No PSA price yet</span>;
    return (
      <span className="crop-option-price">
        ₱{formatPeso(crop.latest.pricePerKg)}/kg
        <small className={crop.latest.older ? "older-month" : ""}>
          {crop.latest.month}
          {crop.latest.older ? " · older" : ""}
        </small>
      </span>
    );
  }

  const listId = `${id}-list`;
  let optionNumber = -1; // counts the rows while we draw them, to match shownInOrder

  return (
    <div className="crop-picker" onBlur={handleBlur}>
      <div className="crop-picker-box">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && shownInOrder.length > 0 ? `${id}-option-${activeIndex}` : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          // While the list is open the box shows what you type; when closed, the chosen crop
          value={open ? query : value}
          placeholder={open && value ? value : `Type to search ${crops.length} crops`}
          onChange={handleTyping}
          onFocus={openList}
          onClick={() => !open && openList()}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={40}
        />
        <button
          type="button"
          className="crop-picker-toggle"
          tabIndex={-1}
          aria-label={open ? "Close the crop list" : "Open the crop list"}
          onMouseDown={(event) => event.preventDefault()} // keep the cursor in the search box
          onClick={toggleList}
          disabled={disabled}
        >
          {open ? "▴" : "▾"}
        </button>
      </div>

      {/* The chosen crop stays visible under the box, with its category */}
      {selected && !open && <p className="crop-picker-selected">✓ {selected.name} · {selected.category}</p>}

      {open && (
        // onMouseDown preventDefault: clicking a crop must not take the cursor out of the
        // search box first, or the list would close before the click counts
        <div id={listId} className="crop-picker-list" role="listbox" aria-label="Crops" onMouseDown={(event) => event.preventDefault()}>
          {groups.map((group) => (
            <div key={group.category} role="group" aria-label={group.category}>
              <p className="crop-picker-group" aria-hidden="true">
                {group.category} <span>({group.crops.length})</span>
              </p>
              {group.crops.map((crop) => {
                optionNumber = optionNumber + 1;
                const number = optionNumber; // this row's place in shownInOrder
                return (
                  <div
                    key={crop.name}
                    id={`${id}-option-${number}`}
                    role="option"
                    aria-selected={crop.name === value}
                    className={`crop-option${number === activeIndex ? " active" : ""}${crop.name === value ? " chosen" : ""}`}
                    onClick={() => choose(crop)}
                    onMouseMove={() => number !== activeIndex && setActiveIndex(number)}
                  >
                    <span className="crop-option-name">
                      {crop.name === value ? "✓ " : ""}
                      {crop.name}
                    </span>
                    {priceText(crop)}
                  </div>
                );
              })}
            </div>
          ))}
          {matches.length === 0 && (
            <p className="crop-picker-empty">No crop matches "{query.trim()}". Try another name, like mango or sitao.</p>
          )}
          <p className="crop-picker-count" aria-live="polite">
            {text ? `${matches.length} of ${crops.length} crops match` : `${crops.length} crops`} · prices: PSA farmgate, Iloilo
          </p>
        </div>
      )}
    </div>
  );
}

export default CropPicker;
