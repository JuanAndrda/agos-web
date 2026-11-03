// SearchBar.js: a search box with a label. Used on Market Prices and the Marketplace.
// If the page gives us onSubmit, we show a Search button; otherwise the page filters as you type.
import { useId } from "react";

function SearchBar({ label, value, onChange, onSubmit, placeholder }) {
  const inputId = useId(); // a unique id, so the <label> is connected to the <input>

  function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    if (onSubmit) onSubmit();
  }

  return (
    <form className="search-bar" role="search" onSubmit={handleSubmit}>
      <label htmlFor={inputId}>{label}</label>
      <div className="search-row">
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={50}
        />
        {onSubmit && (
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        )}
      </div>
    </form>
  );
}

export default SearchBar;
