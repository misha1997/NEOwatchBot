// Event row (.event) — icon tile + title/time/detail. `kind` tints the icon:
//   planet → teal, meteor → coral, else default. (app.js loadSkyEvents)
export default function EventRow({ emoji, title, time, detail, kind, iconClass }) {
  const ic = iconClass
    ? "ic " + iconClass
    : kind === "planet" ? "ic teal"
    : kind === "meteor" ? "ic coral"
    : "ic";
  return (
    <div className="event">
      <div className={ic}>{emoji}</div>
      <div>
        <div className="top"><h4>{title}</h4><span className="t">{time}</span></div>
        <p>{detail}</p>
      </div>
    </div>
  );
}