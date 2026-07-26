// Kp index as a 0–9 arc gauge with the G1 storm threshold (Kp 5) marked.
// Ported from the orbit-light sample; colours mapped to the neowatch tokens
// (--teal/--gold/--coral instead of live/highlight/destructive).
export default function KpGauge({ value }) {
  const W = 132, H = 76, cx = W / 2, cy = H - 8, r = 52;
  const start = Math.PI, end = 0;

  const pt = (tn) => {
    const a = start + (end - start) * tn;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };

  const t = Math.min(Math.max(value / 9, 0), 1);
  const head = pt(t);
  const a0 = pt(0);

  const arcPath = (from, to) => {
    const p1 = pt(from), p2 = pt(to);
    const large = to - from > 0.5 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  };

  const threshold = pt(5 / 9);
  const thresholdInner = {
    x: cx + (r - 9) * Math.cos(start + (end - start) * (5 / 9)),
    y: cy - (r - 9) * Math.sin(start + (end - start) * (5 / 9)),
  };

  const stroke = value >= 5 ? "var(--coral)" : value >= 4 ? "var(--gold)" : "var(--teal)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full kp-gauge" aria-hidden="true">
      <path d={`M ${a0.x} ${a0.y} A ${r} ${r} 0 1 1 ${pt(1).x} ${pt(1).y}`}
        fill="none" stroke="var(--text)" strokeOpacity={0.12} strokeWidth={7} strokeLinecap="round" />
      <path d={arcPath(0, t)} fill="none" stroke={stroke} strokeWidth={7} strokeLinecap="round" />
      <line x1={threshold.x} y1={threshold.y} x2={thresholdInner.x} y2={thresholdInner.y}
        stroke="var(--text)" strokeOpacity={0.45} strokeWidth={1.5} />
      <circle cx={head.x} cy={head.y} r={3.5} fill="var(--bg)" stroke={stroke} strokeWidth={2} />
      <text x={6} y={H - 1} fill="var(--text-dim)" fontSize={8} fontFamily="var(--font-mono)" opacity={0.7}>0</text>
      <text x={W - 12} y={H - 1} fill="var(--text-dim)" fontSize={8} fontFamily="var(--font-mono)" opacity={0.7}>9</text>
      <text x={threshold.x} y={threshold.y - 6} fill="var(--text-dim)" fontSize={8}
        fontFamily="var(--font-mono)" textAnchor="middle" opacity={0.8}>G1</text>
    </svg>
  );
}