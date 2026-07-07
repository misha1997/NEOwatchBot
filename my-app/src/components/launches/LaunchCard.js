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
  // Webcast URL takes priority; fall back to the launch's detail page.
  const href = l.webcast || l.url || "";
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
            {l.webcast ? t("launches.link.webcast") : t("launches.link.details")} ↗
          </a>
        )}
      </div>
    </div>
  );
}