// Detail panel for a selected exoplanet — shown when the user clicks a planet
// in the TOI-700 system diagram or a row in the catalog table. Renders the
// planet's parameters as definition rows (.dl-row, same style as asteroid
// cards) plus a one-line habitability interpretation. Works for both the
// illustrative diagram planets (partial data) and the live catalog rows.
import { useTranslation } from "react-i18next";
import { fmtNum } from "../../lib/format";

function DlRow({ label, val }) {
  if (val == null || val === "") return null;
  return (
    <div className="dl-row">
      <span className="lbl">{label}</span>
      <span className="val">{val}</span>
    </div>
  );
}

export default function ExoDetail({ planet, onClose }) {
  const { t } = useTranslation();
  if (!planet) return null;
  const p = planet;
  const K = t("exoplanets.detail.units.teq");
  const Msun = t("exoplanets.detail.units.stMass");
  const R = t("exoplanets.radiusUnit");   // R⊕
  const D = t("exoplanets.periodUnit");   // днів
  const LY = t("exoplanets.lyUnit");      // св. р.

  const habiKey = p.habitability || "unknown";
  const blurb = t("exoplanets.detail.blurb." + habiKey, { defaultValue: "" });
  const habiLabel = t("exoplanets.feat." + habiKey, { defaultValue: "—" });

  return (
    <div className="exo-detail">
      <div className="exo-detail-head">
        <div>
          <div className="k">{t("exoplanets.detail.title")}</div>
          <h3>{p.name}</h3>
        </div>
        <div className="exo-detail-right">
          <span className={p.confirmed ? "pill teal" : "pill gold"}>
            {p.confirmed ? t("exoplanets.catalog.confirmed") : t("exoplanets.catalog.candidate")}
          </span>
          {onClose && (
            <button type="button" className="exo-close" onClick={onClose} aria-label={t("exoplanets.detail.close")}>
              ✕
            </button>
          )}
        </div>
      </div>
      <DlRow label={t("exoplanets.detail.host")} val={p.host} />
      <DlRow label={t("exoplanets.detail.radius")} val={p.radius != null ? fmtNum(p.radius, 2) + " " + R : null} />
      <DlRow label={t("exoplanets.detail.period")} val={p.period != null ? fmtNum(p.period, 2) + " " + D : null} />
      <DlRow label={t("exoplanets.detail.distance")} val={p.distance_ly != null ? p.distance_ly + " " + LY : null} />
      <DlRow label={t("exoplanets.detail.teq")} val={p.teq != null ? fmtNum(p.teq, 0) + " " + K : null} />
      <DlRow label={t("exoplanets.detail.stTeff")} val={p.st_teff != null ? fmtNum(p.st_teff, 0) + " " + K : null} />
      <DlRow label={t("exoplanets.detail.stMass")} val={p.st_mass != null ? fmtNum(p.st_mass, 2) + " " + Msun : null} />
      <DlRow label={t("exoplanets.detail.discYear")} val={p.disc_year != null ? String(p.disc_year) : null} />
      <DlRow label={t("exoplanets.detail.facility")} val={p.facility || null} />
      <DlRow label={t("exoplanets.detail.habitability")} val={habiLabel} />
      {blurb && <p className="exo-blurb">{blurb}</p>}
    </div>
  );
}