// Launch list card (launches.html #launches-list). Port of app.js launchCardHtml.
import Countdown from "../Countdown";
import { ProviderIcon, RocketIcon, PadIcon } from "../../lib/icons";
import { launchPillClass } from "../../lib/constants";
import { formatLaunchDt } from "../../lib/format";

function Meta({ icon, label }) {
  return <span>{icon} {label}</span>;
}

export default function LaunchCard({ l }) {
  const dt = l.net_ts ? formatLaunchDt(l.net_ts) : l.date;
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
      </div>
    </div>
  );
}