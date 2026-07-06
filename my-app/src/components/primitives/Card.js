// Dashboard card — the recurring .card block:
//   <div class="card"><div class="k">LABEL [.dot]</div>
//     <div class="v [accent|teal]">VALUE<span class="unit">UNIT</span></div>
//     <div class="foot">FOOT</div></div>
// `dot` is "live" | "warn" | falsy. Use children to fully override the body.
export default function Card({ label, dot, value, unit, foot, accent, teal, children, className, style }) {
  const vClass = "v" + (accent ? " accent" : "") + (teal ? " teal" : "");
  return (
    <div className={"card" + (className ? " " + className : "")} style={style}>
      <div className="k">
        {label}
        {dot && <span className={"dot " + dot} />}
      </div>
      {children !== undefined ? children : (
        <div className={vClass}>
          {value}
          {unit != null && unit !== "" && <span className="unit">{unit}</span>}
        </div>
      )}
      {foot != null && <div className="foot">{foot}</div>}
    </div>
  );
}