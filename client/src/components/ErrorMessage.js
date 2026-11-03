// ErrorMessage.js: shown when something fails. If the page gives us onRetry,
// we show a "Try again" button so the user can fix it without reloading.
function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-box" role="alert">
      <p>
        <strong>Something went wrong.</strong> {message}
      </p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
