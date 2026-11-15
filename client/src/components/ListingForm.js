// ListingForm.js: the form to post a new crop or edit one. It checks every field
// before saving and explains what to fix. My Listings decides what "save" does.
import { useEffect, useRef, useState } from "react";
import { CROPS, TOWNS } from "../constants";

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

function ListingForm({ initialValues, onSave, onCancel, saveText }) {
  const editing = Boolean(initialValues);
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initialValues });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const formRef = useRef(null);

  // When the form opens, scroll to it so the farmer sees it (the Edit button may be far below)
  useEffect(() => {
    formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // After a failed save, put the cursor in the first field that needs fixing.
  // This helps people who use the keyboard or a screen reader find the problem.
  useEffect(() => {
    const firstProblem = FIELD_ORDER.find((name) => errors[name]);
    if (firstProblem) document.getElementById(firstProblem).focus();
  }, [errors]);

  // One change handler for every field: the input's "name" says which field to update
  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problems = checkForm(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return; // stop: something needs fixing

    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        crop: form.crop,
        quantityKg: Number(form.quantityKg),
        pricePerKg: Number(form.pricePerKg),
        town: form.town,
        harvestDate: form.harvestDate,
        contactNumber: cleanNumber(form.contactNumber),
        notes: form.notes.trim(),
        ...(editing && { status: form.status }), // only the edit form can change the status
      });
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
    <form ref={formRef} className="card listing-form" onSubmit={handleSubmit} noValidate>
      <h2>{editing ? `Edit your ${initialValues.crop} listing` : "Post a crop"}</h2>

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
            aria-invalid={Boolean(errors.crop)}
            aria-describedby={errors.crop ? "crop-error" : undefined}
          >
            <option value="">Choose a crop</option>
            {CROPS.map((crop) => (
              <option key={crop}>{crop}</option>
            ))}
          </select>
          {fieldError("crop")}
        </div>

        <div className="field">
          <label htmlFor="town">Town</label>
          <select
            id="town"
            name="town"
            value={form.town}
            onChange={handleChange}
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
            aria-invalid={Boolean(errors.pricePerKg)}
            aria-describedby={errors.pricePerKg ? "pricePerKg-error" : "pricePerKg-help"}
          />
          {fieldError("pricePerKg") || (
            <p id="pricePerKg-help" className="help">
              Tip: check Market Prices to see PSA's farmgate price.
            </p>
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
