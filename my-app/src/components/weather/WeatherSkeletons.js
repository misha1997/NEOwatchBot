// Shimmer skeleton placeholders for the weather page. Each block mirrors the
// real layout (4 now-cards, a pair of chart-cards, the aurora card + map, the
// Mars cards) so the page holds its shape while /api/weather and
// /api/weather/series resolve. Renders nothing once `loading` is false.
// Shimmer is a single shared gradient sweep (.sk) — no per-block animation.

function Sk({ className = "", style }) {
  return <span className={"sk " + className} style={style} aria-hidden="true" />;
}

export function CurrentSkeleton() {
  // 4 now-cards: small label, big value, kp-gauge bar, foot line.
  const card = (
    <div className="card">
      <Sk className="sk-k" />
      <Sk className="sk-v" />
      <div className="kp-gauge"><Sk className="sk-gauge-bar" /></div>
      <Sk className="sk-foot" />
    </div>
  );
  return (
    <section className="section" id="current" style={{ paddingTop: 8 }}>
      <div className="wrap">
        <div className="section-head">
          <div>
            <Sk className="sk-eyebrow" />
            <Sk className="sk-h2" />
          </div>
        </div>
        <div className="grid cols-4">{card}{card}{card}{card}</div>
      </div>
    </section>
  );
}

function ChartCardSkeleton() {
  return (
    <div className="chart-card">
      <div className="ch-head">
        <Sk className="sk-ch-title" />
        <Sk className="sk-ch-sub" />
      </div>
      <div className="canvas-wrap"><Sk className="sk-chart" /></div>
    </div>
  );
}

export function ChartPairSkeleton() {
  return (
    <div className="grid cols-2">
      <ChartCardSkeleton />
      <ChartCardSkeleton />
    </div>
  );
}

export function ChartSingleSkeleton() {
  return (
    <div className="chart-card">
      <div className="ch-head">
        <Sk className="sk-ch-title" />
        <Sk className="sk-ch-sub" />
      </div>
      <div className="canvas-wrap" style={{ height: 260 }}><Sk className="sk-chart" /></div>
    </div>
  );
}

export function AuroraSkeleton() {
  return (
    <div className="grid cols-2" style={{ alignItems: "center" }}>
      <div className="card" style={{ textAlign: "center" }}>
        <Sk className="sk-k" style={{ margin: "0 auto" }} />
        <Sk className="sk-v big" style={{ margin: "10px auto" }} />
        <Sk className="sk-foot" style={{ margin: "0 auto" }} />
      </div>
      <div className="aurora-map-wrap"><Sk className="sk-map" /></div>
    </div>
  );
}

export function MarsSkeleton() {
  const card = (
    <div className="card">
      <Sk className="sk-k" />
      <Sk className="sk-v" style={{ marginTop: 14, width: "55%" }} />
      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <Sk className="sk-mini" /><Sk className="sk-mini" /><Sk className="sk-mini" />
      </div>
      <Sk className="sk-line" />
      <Sk className="sk-line" />
      <Sk className="sk-line" />
    </div>
  );
  return <div className="grid cols-2" style={{ gridTemplateColumns: "1fr 1fr" }}>{card}{card}</div>;
}