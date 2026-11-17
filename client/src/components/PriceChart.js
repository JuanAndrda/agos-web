// PriceChart.js: a line chart of one crop's price, month by month. We draw it ourselves with SVG
// (shapes written as code), so we don't need a chart library.
//
// How it works:
//   1. We measure how wide the box is, so the chart fills it and the text stays a normal size.
//   2. Each month becomes a point. Left to right is old to new. Higher on the chart = more expensive.
//   3. You can click a point, or press Tab and Enter on it, to see that month's exact price.
import { useEffect, useRef, useState } from "react";
import { formatPeso } from "../constants";

const HEIGHT = 240; // the chart's height in pixels
const PAD = { top: 16, right: 16, bottom: 30, left: 52 }; // room for the labels around the chart

// "August 2026" or "Aug 2026" -> "Aug", for the labels under the chart
function shortMonth(month) {
  return month.slice(0, 3);
}

function PriceChart({ history }) {
  // PSA sends the newest month first. A chart reads left to right, so we put the oldest first.
  const points = [...history].reverse();

  const [selected, setSelected] = useState(points.length - 1); // start on the newest month
  const [width, setWidth] = useState(600);
  const boxRef = useRef(null);

  // 1. Measure the box now, and again whenever the window changes size
  useEffect(() => {
    const box = boxRef.current;
    const observer = new ResizeObserver(() => setWidth(box.clientWidth));
    observer.observe(box);
    return () => observer.disconnect(); // stop measuring when the page closes
  }, []);

  // 2. Turn each price into a position. The lowest price sits near the bottom, the highest near the top.
  const prices = points.map((p) => p.pricePerKg);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const room = (high - low) * 0.15 || 1; // a little space above and below the line
  const yMin = Math.max(0, low - room);
  const yMax = high + room;

  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const xOf = (i) => PAD.left + (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const yOf = (price) => PAD.top + ((yMax - price) / (yMax - yMin)) * plotHeight;

  // The line: "M x y" moves the pen to the first point, then "L x y" draws to each next point
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${yOf(p.pricePerKg)}`).join(" ");
  // The soft green area under the line: the same line, then down to the bottom and back
  const bottom = PAD.top + plotHeight;
  const area = `${line} L ${xOf(points.length - 1)} ${bottom} L ${xOf(0)} ${bottom} Z`;

  // 4 grid lines with their prices on the left
  const ticks = [0, 1, 2, 3].map((n) => yMin + ((yMax - yMin) * n) / 3);

  // On a narrow screen, label every other month so the labels don't overlap
  const labelEvery = plotWidth / points.length < 40 ? 2 : 1;

  // 3. The month that is selected, and how it changed from the month before it
  const current = points[selected];
  const before = points[selected - 1];
  const change = before ? current.pricePerKg - before.pricePerKg : null;

  function handleKey(event, i) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); // stop the page from scrolling on Space
      setSelected(i);
    }
  }

  return (
    <div className="price-chart">
      {/* The box above the chart: what the selected point means, in words */}
      <p className="chart-readout" aria-live="polite">
        <strong>{current.month}</strong>
        <span className="chart-readout-price">₱{formatPeso(current.pricePerKg)} per kg</span>
        {change !== null && (
          <span className="chart-readout-change">
            {change > 0 ? "▲" : change < 0 ? "▼" : "="} ₱{formatPeso(Math.abs(change))}{" "}
            {change > 0 ? "higher" : change < 0 ? "lower" : "the same"} than {before.month}
          </span>
        )}
      </p>

      <div ref={boxRef} className="chart-box">
        <svg width={width} height={HEIGHT} role="group" aria-label="Price per kg by month. Choose a point to see its price.">
          {/* Grid lines and the price labels on the left */}
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} />
              <text className="chart-label" x={PAD.left - 8} y={yOf(t) + 4} textAnchor="end">
                ₱{Math.round(t)}
              </text>
            </g>
          ))}

          {/* The month names along the bottom */}
          {points.map((p, i) =>
            i % labelEvery === (points.length - 1) % labelEvery ? (
              <text key={p.monthKey} className="chart-label" x={xOf(i)} y={HEIGHT - 8} textAnchor="middle">
                {shortMonth(p.month)}
              </text>
            ) : null
          )}

          {/* The dashed line straight down from the selected point */}
          <line className="chart-crosshair" x1={xOf(selected)} x2={xOf(selected)} y1={PAD.top} y2={bottom} />

          <path className="chart-area" d={area} />
          <path className="chart-line" d={line} />

          {/* One point per month. The big invisible circle makes it easy to click or tap. */}
          {points.map((p, i) => (
            <g
              key={p.monthKey}
              className={i === selected ? "chart-point selected" : "chart-point"}
              role="button"
              tabIndex={0}
              aria-label={`${p.month}: ₱${formatPeso(p.pricePerKg)} per kg`}
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              onKeyDown={(event) => handleKey(event, i)}
            >
              <circle className="chart-hit" cx={xOf(i)} cy={yOf(p.pricePerKg)} r={16} />
              <circle className="chart-dot" cx={xOf(i)} cy={yOf(p.pricePerKg)} r={i === selected ? 7 : 5} />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default PriceChart;
