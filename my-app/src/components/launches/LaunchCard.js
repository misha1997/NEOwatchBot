// Launch list card (launches.html #launches-list). Port of app.js launchCardHtml.
import { useTranslation } from "react-i18next";
import Countdown from "../Countdown";
import { ProviderIcon, RocketIcon, PadIcon } from "../../lib/icons";
import { launchPillClass } from "../../lib/constants";
import { formatLaunchDt } from "../../lib/format";

function Meta({ icon, label }) {
  return <span>{icon} {label}</span>;
}

export default function LaunchCard({ l }) {
  const { t } = useTranslation();
  const dt = l.net_ts ? formatLaunchDt(l.net_ts) : l.date;
  // Webcast URL takes priority; otherwise a YouTube search for the mission;
  // only fall back to the raw LL2 detail page if neither exists.
  const href = l.webcast || l.search || l.url || "";
  const labelKey = l.webcast ? "launches.link.webcast"
    : l.search ? "launches.link.search"
    : "launches.link.details";
  return (
    <div className="launch-card">
      <div>
        <div className="title-row">
          <h3>{l.name}</h3>
          <span className={launchPillClass(l)}>{l.status_label}</span>
        </div>
        <div className="meta-icons">
          <Meta icon={<ProviderIcon />} label={l.lsp} />
          <Meta icon={<RocketIcon />} label={l.rocket} />
          <Meta icon={<PadIcon />} label={l.pad} />
        </div>
        <div className="dt">{dt}</div>
      </div>
      <div className="side">
        <Countdown ts={l.net_ts || 0} units="dhm" />
        {href && (
          <a className="launch-link" href={href} target="_blank" rel="noreferrer">
            {t(labelKey)} ↗
          </a>
        )}
      </div>
    </div>
  );
}