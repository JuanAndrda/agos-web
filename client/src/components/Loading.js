// Loading.js: shown while we wait for an API. role="status" lets screen readers announce it.
function Loading({ text = "Loading..." }) {
  return (
    <p className="loading" role="status">
      <span className="spinner" aria-hidden="true"></span>
      {text}
    </p>
  );
}

export default Loading;
