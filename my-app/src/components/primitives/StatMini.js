// asteroids.html stat pair (.stat-mini > two .box tiles).
export default function StatMini({ boxes }) {
  // boxes = [{ n, l, danger }]
  return (
    <div className="stat-mini">
      {boxes.map((b, i) => (
        <div key={i} className={"box" + (b.danger ? " danger" : "")}>
          <div className="n">{b.n}</div>
          <div className="l">{b.l}</div>
        </div>
      ))}
    </div>
  );
}