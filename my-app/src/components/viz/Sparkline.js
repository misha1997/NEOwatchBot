// 24-hour trend sparkline. Optionally draws a zero baseline (used by Bz, where
// the sign is what matters for aurora). Ported from orbit-light.
export default function Sparkline({ data, color = "var(--teal)", zeroLine = false, className = "sparkline" }) {
  if (!data || data.length < 2) return <svg className={className} aria-hidden="true" />;
  const W = 140, H = 40, pad = 3;
  const min = Math.min(...data, zeroLine ? 0 : Infinity);
  const max = Math.max(...data, zeroLine ? 0 : -Infinity);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - pad * 2)) / (data.length - 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(data.length - 1)} ${H} L ${x(0)} ${H} Z`;
  const last = data[data.length - 1];
  const gid = "sg-" + color.replace(/[^a-z]/gi, "");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {zeroLine && (
        <line x1={0} y1={y(0)} x2={W} y2={y(0)} stroke="var(--text)" strokeOpacity={0.2}
          strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      )}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"
        strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(data.length - 1)} cy={y(last)} r={2.5} fill={color} />
    </svg>
  );
}