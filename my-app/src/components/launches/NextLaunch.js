// Next-launch hero block (launches.html .next-launch). Port of renderNextLaunch.
import Countdown from "../Countdown";
import { useTranslation } from "react-i18next";
import { PadIcon } from "../../lib/icons";
import { formatLaunchDt } from "../../lib/format";

export default function NextLaunch({ l }) {
  const { t } = useTranslation();
  if (!l) return null;
  const dt = l.net_ts ? formatLaunchDt(l.net_ts) : l.date;
  // Webcast URL takes priority; otherwise a YouTube search for the mission.
  const href = (l && (l.webcast || l.search || l.url)) || "";
  return (
    <div className="next-launch" id="next-launch">
      <span className="badge-live"><span className="dot" />{t("launches.next")}</span>
      <div className="next-launch-grid">
        <div>
          <h2 id="next-launch-name">{l.name}</h2>
          <p id="next-launch-sub" style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 5 }}>
            {l.lsp} · {l.rocket}
          </p>
          <div className="icon-line" id="next-launch-pad">
            <PadIcon /> {l.pad}
          </div>
          <div className="launch-datetime" id="next-launch-dt">{dt}</div>
          {href && (
            <a className="btn primary launch-watch" href={href} target="_blank" rel="noreferrer"
              style={{ marginTop: 16 }}>
              ▶ {t("launches.link.watch")}
            </a>
          )}
        </div>
        <Countdown ts={l.net_ts || 0} units="dhms" />
      </div>
    </div>
  );
}