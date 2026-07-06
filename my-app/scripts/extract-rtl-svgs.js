// One-off: extract the spectrogram + meteor-ping SVG blocks from the legacy
// rtl-sdr.html and emit two React components that render them verbatim via
// dangerouslySetInnerHTML (trusted static template markup, no interpolation).
const fs = require("fs");
const path = require("path");

// my-app/scripts -> my-app -> repo root -> site
const html = fs.readFileSync(path.join(__dirname, "..", "..", "site", "rtl-sdr.html"), "utf8");

// Grab the spectrogram SVG (viewBox 0 0 600 300) and the ping SVG (600 220).
function extract(viewBox) {
  const re = new RegExp("<svg viewBox=\"0 0 " + viewBox + "\"[\\s\\S]*?</svg>");
  const m = html.match(re);
  if (!m) throw new Error("SVG " + viewBox + " not found");
  return m[0];
}

const spectro = extract("600 300");
const ping = extract("600 220");

const wrap = (name, svg) =>
`// ${name} — static SVG ported verbatim from site/rtl-sdr.html (no live data).
// Rendered via dangerouslySetInnerHTML: the markup is trusted template
// content (hundreds of <rect> spectrogram cells), so a raw string keeps it
// byte-identical without hand-transcribing every element to JSX.
const SVG = ${JSON.stringify(svg)};

export default function ${name}() {
  return <div dangerouslySetInnerHTML={{ __html: SVG }} />;
}
`;

const out = path.join(__dirname, "..", "src", "components", "rtl");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "Spectrogram.js"), wrap("Spectrogram", spectro));
fs.writeFileSync(path.join(out, "MeteorPing.js"), wrap("MeteorPing", ping));
console.log("Wrote", out, "Spectrogram.js + MeteorPing.js");