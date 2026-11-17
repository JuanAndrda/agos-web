// Logo.js: our small leaf logo, drawn with SVG (shapes written as code, so there is no image file
// to load). "currentColor" means the leaf takes the text color around it, so the same logo works
// on the white top bar and on the green panels.
function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15H5v-1z" />
      <path fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" d="M7 18c3-4 6-7 10-10" />
    </svg>
  );
}

export default Logo;
