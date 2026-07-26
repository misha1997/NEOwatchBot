// Geometrically correct moon phase: the terminator is an ellipse whose
// semi-minor axis is r·|1−2k| for illuminated fraction k. Ported from
// orbit-light; disc colours mapped to the neowatch palette.
export default function Moon({ illumination, phase, size = 64 }) {
  const r = 50, c = 60;
  const k = Math.min(Math.max(illumination, 0), 1);
  const waxing = phase < 0.5;
  const rx = Math.max(0.01, r * Math.abs(1 - 2 * k));
  const sweep = k < 0.5 ? 0 : 1;
  const lit = [
    `M ${c} ${c - r}`,
    `A ${r} ${r} 0 0 1 ${c} ${c + r}`,
    `A ${rx} ${r} 0 0 ${sweep} ${c} ${c - r}`,
    "Z",
  ].join(" ");

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img"
      aria-label={`Місяць, освітленість ${Math.round(k * 100)}%`}>
      <circle cx={c} cy={c} r={r} fill="#1a1d33" />
      <g transform={waxing ? undefined : `translate(${c * 2} 0) scale(-1 1)`}>
        <path d={lit} fill="#E8E6D8" />
      </g>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--text)" strokeOpacity={0.18} />
    </svg>
  );
}