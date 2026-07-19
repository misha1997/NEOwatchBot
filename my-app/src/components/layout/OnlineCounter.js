// "X online" badge for the footer's right column. Polls /api/online every
// 30 s — each poll both refreshes the count and heartbeats this visitor so
// the server keeps them counted. Stays a placeholder ("—") until the first
// successful response, and never throws into the footer on a network error.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getOnline } from "../../lib/api";

const POLL_MS = 30000;

export default function OnlineCounter() {
  const { t } = useTranslation();
  const [count, setCount] = useState(null);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      getOnline()
        .then((d) => alive && setCount(d.online))
        .catch(() => {});
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="online-counter" title={t("footer.onlineTip")}>
      <span className="online-dot" />
      <span className="online-count">{count ?? "—"}</span>
      <span>{t("footer.online")}</span>
    </div>
  );
}