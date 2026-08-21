// Header opt-in for browser Web Push (real-time/rare alerts only — ISS
// passes, launches, hazardous asteroids, space weather, GRBs; see
// services/scheduler.py's push fan-out). Renders nothing on browsers without
// the Push API (desktop Safari, old browsers) — no point showing a bell that
// can't do anything.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../../context/LanguageContext";
import { useLoc } from "../../context/LocationContext";
import { isPushSupported, getPushStatus, subscribeToPush, unsubscribeFromPush } from "../../lib/push";

export default function PushBell() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { loc } = useLoc();
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState("unsubscribed"); // "unsubscribed" | "subscribed" | "busy"

  useEffect(() => {
    if (!isPushSupported()) return;
    setSupported(true);
    getPushStatus(loc, lang).then((s) => setStatus(s === "subscribed" ? "subscribed" : "unsubscribed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = useCallback(async () => {
    if (status === "busy") return;
    setStatus("busy");
    try {
      if (status === "subscribed") {
        await unsubscribeFromPush();
      } else {
        await subscribeToPush(loc, lang);
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
    } finally {
      const s = await getPushStatus(loc, lang);
      setStatus(s === "subscribed" ? "subscribed" : "unsubscribed");
    }
  }, [status, loc, lang]);

  if (!supported) return null;

  const isOn = status === "subscribed";
  const label = isOn ? t("push.disable") : t("push.enable");

  return (
    <button
      type="button"
      className={"push-bell" + (isOn ? " on" : "") + (status === "busy" ? " busy" : "")}
      onClick={handleClick}
      disabled={status === "busy"}
      aria-pressed={isOn}
      title={label}
      aria-label={label}
    >
      {isOn ? "🔔" : "🔕"}
    </button>
  );
}
