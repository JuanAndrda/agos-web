// ListingForm.js: the form to post a new crop or edit one. It checks every field
// before saving and explains what to fix. My Listings decides what "save" does.
import { useEffect, useState } from "react";
import { CROPS, TOWNS, formatPeso } from "../constants";
import { getPrices } from "../services/pricesService";
import { getCropInfo } from "../services/wikipediaService";

const EMPTY_FORM = {
  crop: "",
  quantityKg: "",
  pricePerKg: "",
  town: "",
  harvestDate: "",
  contactNumber: "",
  notes: "",
  status: "available",
};

// The fields in the order they appear on screen, so we can find the first one with a problem
const FIELD_ORDER = ["crop", "town", "quantityKg", "pricePerKg", "contactNumber", "notes"];

// "0917 123-4567" -> "09171234567": we keep only the digits (and a + at the start)
function cleanNumber(text) {
  return text.replace(/[^\d+]/g, "");
}

// Returns an object with one message per wrong field, like { pricePerKg: "..." }
function checkForm(form) {
  const errors = {};
  const quantity = Number(form.quantityKg);
  const price = Number(form.pricePerKg);

  if (!CROPS.includes(form.crop)) errors.crop = "Choose a crop.";
  if (form.quantityKg === "" || !(quantity > 0)) {
    errors.quantityKg = "Enter how many kilos you have, more than 0.";
  } else if (quantity > 100000) {
    errors.quantityKg = "That's too many kilos. Please check the number.";
  }
  if (form.pricePerKg === "" || !(price > 0)) {
    errors.pricePerKg = "Enter your price per kilo, more than ₱0.";
  } else if (price > 10000) {
    errors.pricePerKg = "That price looks too high. Please check the number.";
  }
  if (!TOWNS.includes(form.town)) errors.town = "Choose your town.";
  // A Philippine mobile number: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX
  if (!/^(09\d{9}|\+639\d{9})$/.test(cleanNumber(form.contactNumber))) {
    errors.contactNumber = "Enter your mobile number, like 0917 123 4567.";
  }
  if (form.notes.length > 200) errors.notes = "Notes can be up to 200 characters.";
  return errors;
}

// "locked" is true when buyers have waiting or accepted orders on this listing (from My Listings).
// Then the crop, price and town boxes are turned off, because the server won't allow changing them.
function ListingForm({ initialValues, onSave, onCancel, saveText, locked }) {
  const editing = Boolean(initialValues);
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initialValues });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // PSA's newest farmgate price of each crop, like { Tomato: { pricePerKg: 48.2, month: "June 2026" } }.
  // null means "not loaded (yet)". The form still works without it.
  const [psaPrices, setPsaPrices] = useState(null);
  // The Wikipedia photo of the chosen crop, so the farmer sees it without uploading anything.
  // "" means no photo (yet).
  const [cropPhoto, setCropPhoto] = useState("");

  // Load PSA's prices once when the form opens: GET /api/prices (our Express server asks PSA).
  // If PSA is down we just don't show a suggestion, because the farmer can still type a price.
  useEffect(() => {
    getPrices()
      .then((data) => {
        const byCrop = {};
        for (const p of data.prices) byCrop[p.crop] = p;
        setPsaPrices(byCrop);
      })
      .catch((err) => console.error("No PSA suggestion:", err));
  }, []);

  // Whenever the farmer chooses a crop, GET its photo from Wikipedia (the same call Crop Details uses).
  // If Wikipedia is down or has no photo, the preview just stays hidden.
  useEffect(() => {
    setCropPhoto("");
    if (form.crop === "") return;
    getCropInfo(form.crop)
      .then((info) => {
        if (info && info.photo) setCropPhoto(info.photo);
      })
      .catch((err) => console.error("No crop photo:", err));
  }, [form.crop]);

  // When the form opens, scroll to it so the farmer sees it (the Edit button may be far below)
  useEffect(() => {
    document.getElementById("listing-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // One change handler for every field: the input's "name" says which field to update
  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
    // The person is fixing this field, so its old error message goes away
    // (copy the errors, remove this field's message, save the copy)
    if (errors[name]) {
      const otherErrors = { ...errors };
      delete otherErrors[name];
      setErrors(otherErrors);
    }
  }

  // "Use this price" copies PSA's price into the price box. The farmer can still change it.
  function applySuggestedPrice() {
    setForm({ ...form, pricePerKg: String(suggestion.pricePerKg) });
    const otherErrors = { ...errors };
    delete otherErrors.pricePerKg; // the price is fine now
    setErrors(otherErrors);
  }

  // The PSA price of the crop the farmer chose (or undefined if no crop or no prices yet)
  const suggestion = psaPrices && psaPrices[form.crop];

  async function handleSubmit(event) {
    event.preventDefault();
    const problems = checkForm(form);
    setErrors(problems);
    // Something needs fixing: put the cursor in the first wrong field, and stop.
    // This helps people who use the keyboard or a screen reader find the problem.
    const firstProblem = FIELD_ORDER.find((name) => problems[name]);
    if (firstProblem) {
      document.getElementById(firstProblem).focus();
      return;
    }

    // The listing we send to the server, with the numbers as real numbers
    const listing = {
      crop: form.crop,
      quantityKg: Number(form.quantityKg),
      pricePerKg: Number(form.pricePerKg),
      town: form.town,
      harvestDate: form.harvestDate,
      contactNumber: cleanNumber(form.contactNumber),
      notes: form.notes.trim(),
    };
    if (editing) listing.status = form.status; // only the edit form can change the status

    setSaving(true);
    setSaveError("");
    try {
      await onSave(listing); // My Listings sends POST or PATCH
    } catch (err) {
      setSaveError(err.message);
      setSaving(false);
    }
  }

  // Shows the message under a field when it has a problem
  function fieldError(name) {
    return errors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null;
  }

  return (
    <form id="listing-form" className="card listing-form" onSubmit={handleSubmit} noValidate>
      <h2>{editing ? `Edit your ${initialValues.crop} listing` : "Post a crop"}</h2>

      {locked && (
        <p className="lock-note">
          🔒 Buyers have open orders on this listing, so the crop, price and town are locked. You can still
          change the kilos, harvest date, contact number, notes and status.
        </p>
      )}
      {Object.keys(errors).length > 0 && (
        <p className="form-error" role="alert">
          Please fix the fields marked below.
        </p>
      )}
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="crop">Crop</label>
          <select
            id="crop"
            name="crop"
            value={form.crop}
            onChange={handleChange}
            disabled={locked}
            aria-invalid={Boolean(errors.crop)}
            aria-describedby={errors.crop ? "crop-error" : undefined}
          >
            <option value="">Choose a crop</option>
            {CROPS.map((crop) => (
              <option key={crop}>{crop}</option>
            ))}
          </select>
          {fieldError("crop")}
          {cropPhoto && (
            <div className="crop-preview">
              <img src={cropPhoto} alt={`${form.crop}, from Wikipedia`} />
              <span className="help">Buyers will see this photo of {form.crop}. No upload needed.</span>
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="town">Town</label>
          <select
            id="town"
            name="town"
            value={form.town}
            onChange={handleChange}
            disabled={locked}
            aria-invalid={Boolean(errors.town)}
            aria-describedby={errors.town ? "town-error" : undefined}
          >
            <option value="">Choose your town</option>
            {TOWNS.map((town) => (
              <option key={town}>{town}</option>
            ))}
          </select>
          {fieldError("town")}
        </div>

        <div className="field">
          <label htmlFor="quantityKg">Quantity (kg)</label>
          <input
            id="quantityKg"
            name="quantityKg"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.quantityKg}
            onChange={handleChange}
            aria-invalid={Boolean(errors.quantityKg)}
            aria-describedby={errors.quantityKg ? "quantityKg-error" : undefined}
          />
          {fieldError("quantityKg")}
        </div>

        <div className="field">
          <label htmlFor="pricePerKg">Price per kg (₱)</label>
          <input
            id="pricePerKg"
            name="pricePerKg"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.pricePerKg}
            onChange={handleChange}
            disabled={locked}
            aria-invalid={Boolean(errors.pricePerKg)}
            aria-describedby={errors.pricePerKg ? "pricePerKg-error pricePerKg-help" : "pricePerKg-help"}
          />
          {fieldError("pricePerKg")}
          {/* PSA's price shows even when the price box has an error, because it helps fix it */}
          {suggestion ? (
            // The suggested price box: PSA's farmgate price for this crop, and a button to use it
            <div id="pricePerKg-help" className="price-suggestion">
              <p>
                PSA farmgate price for {form.crop}: <strong>₱{formatPeso(suggestion.pricePerKg)}/kg</strong>{" "}
                <span className="muted">({suggestion.month})</span>
              </p>
              <button type="button" className="btn btn-secondary btn-small" onClick={applySuggestedPrice} disabled={locked}>
                Use this price
              </button>
            </div>
          ) : (
            !errors.pricePerKg && (
              <p id="pricePerKg-help" className="help">
                {form.crop ? "PSA's price for this crop isn't available right now." : "Choose a crop to see PSA's farmgate price."}
              </p>
            )
          )}
        </div>

        <div className="field">
          <label htmlFor="harvestDate">
            Harvest date <span className="optional">(optional)</span>
          </label>
          <input
            id="harvestDate"
            name="harvestDate"
            type="date"
            value={form.harvestDate}
            onChange={handleChange}
          />
        </div>

        <div className="field">
          <label htmlFor="contactNumber">Contact number</label>
          <input
            id="contactNumber"
            name="contactNumber"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={16}
            value={form.contactNumber}
            onChange={handleChange}
            placeholder="0917 123 4567"
            aria-invalid={Boolean(errors.contactNumber)}
            aria-describedby={errors.contactNumber ? "contactNumber-error" : "contactNumber-help"}
          />
          {fieldError("contactNumber") || (
            <p id="contactNumber-help" className="help">
              Logged-in buyers will see it, so they can call or text you.
            </p>
          )}
        </div>

        {editing && (
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" value={form.status} onChange={handleChange}>
              <option value="available">Available</option>
              <option value="sold">Sold</option>
            </select>
          </div>
        )}

        <div className="field field-wide">
          <label htmlFor="notes">
            Notes for buyers <span className="optional">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows="3"
            maxLength={200}
            value={form.notes}
            onChange={handleChange}
            placeholder="e.g. Firm and ripe, sorted by size"
            aria-describedby="notes-count"
          />
          <p id="notes-count" className="help">
            {form.notes.length}/200 characters
          </p>
          {fieldError("notes")}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : saveText}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default ListingForm;
