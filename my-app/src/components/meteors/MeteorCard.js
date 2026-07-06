// Meteor-shower card (meteors.html #meteor-grid). Port of app.js meteorCardHtml.
import { useTranslation } from "react-i18next";
import { daysTxt } from "../../lib/format";

const CLS = { fire: "fire", active: "active", soon: "soon", future: "future" };
const EMOJI = { fire: "🔥", active: "✨", soon: "⏳", future: "📅" };

export default function MeteorCard({ s }) {
  const { t } = useTranslation();
  const sk = s.status_key || "future";
  const cls = CLS[sk] || "future";
  const emoji = EMOJI[sk] || "📅";
  const zhr = s.rate || 0;
  const zhrPct = Math.max(6, Math.min(100, (zhr / 150) * 100));
  const zhrTag = zhr >= 100 ? t("meteors.card.zhrHigh") : zhr >= 50 ? t("meteors.card.zhrMid") : zhr > 0 ? t("meteors.card.zhrLow") : "—";
  return (
    <div className={"meteor-card " + cls}>
      <div className="mc-streak" aria-hidden="true"></div>
      <div className="mc-head">
        <div className="mc-glyph">☄️</div>
        <div className="mc-titles">
          <h3>{s.name}</h3>
          <div className="mc-en">{s.name_en || ""}</div>
        </div>
        <span className={"pill " + (cls === "future" ? "" : cls)}>{emoji} {s.status}</span>
      </div>
      <div className="mc-peak">
        <div className="mc-date">{s.peak || "—"}</div>
        <div className="mc-countdown">{daysTxt(s.days_until)}</div>
      </div>
      <div className="mc-zhr">
        <div className="mc-zhr-top">
          <span className="mc-zhr-label">{t("meteors.card.activity")}</span>
          <span className="mc-zhr-tag">{zhrTag}</span>
        </div>
        <div className="mc-zhr-row">
          <div className="mc-zhr-num">{zhr || "—"}</div>
          <div className="mc-zhr-bar">
            <div className="mc-zhr-fill" style={{ width: zhrPct.toFixed(0) + "%" }} />
          </div>
        </div>
        <div className="mc-zhr-unit">{t("meteors.card.perHour")}</div>
      </div>
      <div className="mc-meta">
        <div className="mc-row"><span className="mc-ic">🧭</span>
          <div><div className="mc-k">{t("meteors.card.radiant")}</div><div className="mc-v">{s.direction || "—"}</div></div>
        </div>
        <div className="mc-row"><span className="mc-ic">🕘</span>
          <div><div className="mc-k">{t("meteors.card.bestTime")}</div><div className="mc-v">{s.best_time || "—"}</div></div>
        </div>
      </div>
      {s.description && <p className="mc-desc">{s.description}</p>}
      <div className="mc-period">
        <div className="mc-period-labels"><span>{t("meteors.card.from", { start: s.start })}</span><span>{t("meteors.card.to", { end: s.end })}</span></div>
        <div className="mc-period-track"><span className="mc-period-dot"></span></div>
      </div>
    </div>
  );
}