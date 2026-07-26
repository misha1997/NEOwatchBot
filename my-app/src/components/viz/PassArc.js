// Side-on view of a satellite pass across the sky dome. Arc height encodes
// maximum altitude, so a good pass is instantly readable as a tall arc.
// Ported from orbit-light; colours mapped to the neowatch tokens.
export default function PassArc({ maxAlt, startDir, endDir }) {
  const W = 168, H = 74, baseY = H - 16, r = 72, cx = W / 2;
  const left = cx - r, right = cx + r;
  const peakY = baseY - (Math.min(maxAlt, 90) / 90) * (r - 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pass-arc" aria-hidden="true">
      <path d={`M ${left} ${baseY} A ${r} ${r} 0 0 1 ${right} ${baseY}`}
        fill="none" stroke="var(--text)" strokeOpacity={0.1} strokeDasharray="2 4" />
      <path d={`M ${cx - r / 2} ${baseY} A ${r / 2} ${r / 2} 0 0 1 ${cx + r / 2} ${baseY}`}
        fill="none" stroke="var(--text)" strokeOpacity={0.07} strokeDasharray="2 4" />
      <line x1={left - 4} y1={baseY} x2={right + 4} y2={baseY}
        stroke="var(--text)" strokeOpacity={0.25} />
      <path d={`M ${left} ${baseY} Q ${cx} ${peakY - (baseY - peakY) * 0.35} ${right} ${baseY}`}
        fill="none" stroke="var(--teal)" strokeWidth={1.75} strokeLinecap="round" />
      <circle cx={cx} cy={peakY} r={3} fill="var(--teal)" />
      <text x={cx} y={peakY - 7} fill="var(--teal)" fontSize={9}
        fontFamily="var(--font-mono)" textAnchor="middle">{maxAlt}°</text>
      <text x={left} y={H - 3} fill="var(--text-dim)" fontSize={9}
        fontFamily="var(--font-mono)" textAnchor="middle">{startDir}</text>
      <text x={right} y={H - 3} fill="var(--text-dim)" fontSize={9}
        fontFamily="var(--font-mono)" textAnchor="middle">{endDir}</text>
    </svg>
  );
}