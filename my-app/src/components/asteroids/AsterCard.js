// Asteroid close-approach card (asteroids.html #neo-grid). Port of asterCardHtml.
import { useTranslation } from "react-i18next";
import { DiameterIcon, DistanceIcon, VelocityIcon, WarnIcon } from "../../lib/icons";

function DlRow({ icon, label, val }) {
  return (
    <div className="dl-row">{icon}<span className="lbl">{label}</span><span className="val">{val}</span></div>
  );
}

export default function AsterCard({ a }) {
  const { t } = useTranslation();
  const ld = a.distance_ld;
  const left = ld != null ? Math.min(ld * 7.69, 100) : 50;
  const dotCls = a.hazardous ? "coral" : "teal";
  return (
    <div className="aster-card">
      <div className="top">
        <h3>{a.name}</h3>
        {a.hazardous ? (
          <span className="pill coral" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <WarnIcon /> {t("asteroids.card.danger")}
          </span>
        ) : (
          <span className="pill teal">{t("asteroids.card.safe")}</span>
        )}
      </div>
      <div className="approach">{a.approach}</div>
      <DlRow icon={<DiameterIcon />} label={t("asteroids.card.diameter")} val={t("asteroids.card.diameterVal", { min: a.diameter_min, max: a.diameter_max })} />
      <DlRow icon={<DistanceIcon />} label={t("asteroids.card.distance")} val={ld != null ? ld + " " + t("common.units.ld") : "—"} />
      <DlRow icon={<VelocityIcon />} label={t("asteroids.card.velocity")} val={a.velocity_kms != null ? a.velocity_kms + " " + t("common.units.km_s") : "—"} />
      <div className="dist-bar">
        <div className="labels"><span>{t("asteroids.card.earth")}</span><span>{t("asteroids.card.moon")}</span></div>
        <div className="track">
          <span className={"dot " + dotCls} style={{ left: left.toFixed(1) + "%" }} />
        </div>
      </div>
    </div>
  );
}