// Homepage "Найцікавіше над містом" event list (index.html #sky-events).
// Live data from /api/sky → events[]. Static placeholder events shown pre-load.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLoc } from "../../context/LocationContext";
import { useLang } from "../../context/LanguageContext";
import { getSky } from "../../lib/api";
import EventRow from "../primitives/EventRow";

export default function SkyEvents() {
  const { loc } = useLoc();
  const { lang } = useLang();
  const { t } = useTranslation();
  const { data } = useApi(() => getSky(loc, lang), { deps: [loc && loc.lat, loc && loc.lon, lang] });
  const placeholders = [
    { emoji: "🛰️", title: t("home.skyEvents.issTitle"), time: "22:14", detail: t("home.skyEvents.issDetail"), kind: "iss" },
    { emoji: "🪐", title: t("home.skyEvents.planetTitle"), time: t("home.skyEvents.planetTime"), detail: t("home.skyEvents.planetDetail"), kind: "planet" },
    { emoji: "☄️", title: t("home.skyEvents.meteorTitle"), time: t("home.skyEvents.meteorTime"), detail: t("home.skyEvents.meteorDetail"), kind: "meteor" },
    { emoji: "🌙", title: t("home.skyEvents.moonTitle"), time: "—", detail: t("home.skyEvents.moonDetail"), kind: "moon" },
  ];
  const events = (data && data.events) || placeholders;
  return (
    <div className="event-list" id="sky-events">
      {events.map((e, i) => (
        <EventRow key={i} emoji={e.emoji} title={e.title} time={e.time}
          detail={e.detail} kind={e.kind} />
      ))}
    </div>
  );
}