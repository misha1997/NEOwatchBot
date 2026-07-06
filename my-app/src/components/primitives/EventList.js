// Two-column event list (.event-list). Empty-state mirrors app.js renderList.
import { useTranslation } from "react-i18next";
import EventRow from "./EventRow";

export default function EventList({ items, empty }) {
  const { t } = useTranslation();
  const emptyText = empty || t("common.notFound");
  if (!items || items.length === 0) {
    return <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "6px 0" }}>{emptyText}</div>;
  }
  return (
    <div className="event-list">
      {items.map((e, i) => (
        <EventRow key={i} emoji={e.emoji} title={e.title} time={e.time}
          detail={e.detail} kind={e.kind} iconClass={e.iconClass} />
      ))}
    </div>
  );
}