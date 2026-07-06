// Inline SVG icons used across cards (port of the `SVG` object in app.js).
// Each inherits color via `stroke="currentColor"` so CSS `.dl-row svg` etc.
// can tint them. `size` overrides the default width/height.

const base = (w, h) => ({
  width: w, height: h, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.6,
  strokeLinecap: "round", strokeLinejoin: "round",
});

export function ProviderIcon({ size = 15, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </svg>
  );
}

export function RocketIcon({ size = 15, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M12 2c3 2 5 6 5 10 0 3-1 5-2 6l-3 3-3-3c-1-1-2-3-2-6 0-4 2-8 5-10z" />
      <path d="M9 15l-3 3 1 3 3-1" />
      <path d="M15 15l3 3-1 3-3-1" />
      <circle cx="12" cy="10" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PadIcon({ size = 15, ...p }) {
  return (
    <svg {...base(size, size)} {...p}>
      <path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

export function BellIcon({ size = 13, ...p }) {
  return (
    <svg {...base(size, size)} strokeWidth={1.7} {...p}>
      <path d="M6 8a6 6 0 1112 0c0 4 1.5 6 2 7H4c.5-1 2-3 2-7z" />
      <path d="M10 20a2 2 0 004 0" />
    </svg>
  );
}

export function DiameterIcon({ size = 14, ...p }) {
  return (
    <svg {...base(size, size)} strokeWidth={1.7} {...p}>
      <rect x="2.5" y="8" width="19" height="8" rx="1.4" transform="rotate(-45 12 12)" />
      <path d="M8.5 12.5l1.3 1.3M11 10l1.3 1.3M13.5 7.5l1.3 1.3" transform="rotate(-45 12 12)" />
    </svg>
  );
}

export function DistanceIcon({ size = 14, ...p }) {
  return (
    <svg {...base(size, size)} strokeWidth={1.7} {...p}>
      <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function VelocityIcon({ size = 14, ...p }) {
  return (
    <svg {...base(size, size)} strokeWidth={1.7} {...p}>
      <path d="M4 15a8 8 0 1116 0" />
      <path d="M12 15l4-5" />
      <circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WarnIcon({ size = 12, ...p }) {
  return (
    <svg {...base(size, size)} strokeWidth={1.8} {...p}>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17.3" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}