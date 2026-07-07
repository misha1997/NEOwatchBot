// Shimmer skeletons for the exoplanets page. Mirrors the three data-driven
// sections (4 feature cards, radius/period scatter, catalog table) so the page
// holds its shape while /api/exoplanets resolves. Hero text + TOI-700 diagram
// and the static "notable" section render immediately, so only these blocks
// need skeletons. Shimmer is the shared .sk gradient sweep — one animation.

function Sk({ className = "", style }) {
  return <span className={"sk " + className} style={style} aria-hidden="true" />;
}

export function CardsSkeleton() {
  const card = (
    <div className="card">
      <Sk className="sk-k" />
      <Sk className="sk-v" />
      <Sk className="sk-foot" />
    </div>
  );
  return (
    <section className="section" style={{ paddingTop: 8 }}>
      <div className="wrap">
        <div className="grid cols-4">{card}{card}{card}{card}</div>
      </div>
    </section>
  );
}

export function ScatterSkeleton() {
  return (
    <section className="section" id="scatter">
      <div className="wrap">
        <div className="section-head">
          <div>
            <Sk className="sk-eyebrow" />
            <Sk className="sk-h2" />
          </div>
        </div>
        <div className="exo-scatter-wrap">
          <Sk className="sk-chart" style={{ height: 280 }} />
        </div>
      </div>
    </section>
  );
}

export function CatalogSkeleton() {
  const rows = Array.from({ length: 7 });
  return (
    <section className="section" id="catalog">
      <div className="wrap">
        <div className="section-head">
          <div>
            <Sk className="sk-eyebrow" />
            <Sk className="sk-h2" />
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {Array.from({ length: 6 }).map((_, i) => (
                  <th key={i}><Sk className="sk-foot" style={{ width: 80 }} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><Sk className="sk-line" style={{ width: j === 0 ? 120 : 70 }} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}