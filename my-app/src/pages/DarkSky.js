// Dark-sky page: light-pollution map (David Lorenz Light Pollution Atlas
// overlay, see DarkSkyMap.js) + a plain-language "conditions tonight" verdict
// for the observer's saved location, combining cloud forecast + Moon phase/alt
// + Kp from /api/observing-conditions with a client-side light-pollution zone
// read (lib/lightPollution.js — no backend round-trip for that part).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LocationPill from "../components/LocationPill";
import DarkSkyMap from "../components/DarkSkyMap";
import DarkSkyMapFullscreen from "../components/DarkSkyMapFullscreen";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import { useApi } from "../hooks/useApi";
import { useLang } from "../context/LanguageContext";
import { useLoc, DEFAULT_LOC } from "../context/LocationContext";
import { getObservingConditions } from "../lib/api";
import { getZoneAtPoint, TIER_COLORS } from "../lib/lightPollution";

// Legend swatches, in severity order — colors come from lib/lightPollution's
// TIER_COLORS (a single-hue ordinal ramp validated for this dark surface),
// the same encoding the map-click popup's trend chart uses.
const LEGEND = ["excellent", "good", "moderate", "bright", "poor"].map((tier) => ({
  tier, hex: TIER_COLORS[tier],
}));

// Coarse rank (0 = best .. 3 = worst) so cloud cover and the light-pollution
// tier can be combined into one verdict by taking the worse of the two.
const ZONE_RANK = { excellent: 0, good: 1, moderate: 2, bright: 3, poor: 3 };
const VERDICT_KEYS = ["excellent", "good", "moderate", "poor"];

function cloudRank(pct) {
  if (pct == null) return null;
  if (pct < 20) return 0;
  if (pct < 50) return 1;
  if (pct < 80) return 2;
  return 3;
}

function computeVerdict(cloudPct, zoneTier) {
  if (cloudPct != null && cloudPct >= 70) return 3; // overcast trumps everything else
  const cR = cloudRank(cloudPct);
  const zR = zoneTier != null ? ZONE_RANK[zoneTier] : null;
  const ranks = [cR, zR].filter((r) => r != null);
  if (!ranks.length) return null;
  return Math.max(...ranks);
}

export default function DarkSky() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.darksky"); }, [t]);
  const { lang } = useLang();
  const { loc } = useLoc();
  const [showFs, setShowFs] = useState(false);

  const { data: cond } = useApi(() => getObservingConditions(loc), {
    deps: [loc && loc.lat, loc && loc.lon],
  });

  // undefined = still checking, null = couldn't read the tile, object = result.
  const [zone, setZone] = useState(undefined);
  const lat = loc ? loc.lat : DEFAULT_LOC.lat;
  const lon = loc ? loc.lon : DEFAULT_LOC.lon;

  useEffect(() => {
    let alive = true;
    setZone(undefined);
    getZoneAtPoint(lat, lon).then((z) => { if (alive) setZone(z || null); });
    return () => { alive = false; };
  }, [lat, lon]);

  const cloudPct = cond ? cond.cloud_cover_pct : null;
  const verdictRank = computeVerdict(cloudPct, zone && zone.tier);
  const verdictKey = verdictRank != null ? VERDICT_KEYS[verdictRank] : null;
  const moonPct = cond && cond.moon_illumination_pct != null ? Math.round(cond.moon_illumination_pct) : null;
  const kp = cond && cond.kp != null ? cond.kp : null;

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow"><span className="dot live" /> {t("darksky.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("darksky.hero.title") }} />
            <p className="hero-sub">{t("darksky.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#dark-sky-map" className="btn primary">{t("darksky.hero.map")}</a>
            </div>
            <LocationPill />
          </div>
        </div>
      </section>

      <section className="section" id="dark-sky-map" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="map-card">
            <div className="map-body map-live" style={{ position: "relative" }}>
              <button
                type="button"
                className="const-fs-cta"
                onClick={() => setShowFs(true)}
                aria-label={t("darksky.fullscreen")}
                title={t("darksky.fullscreenHint")}
                style={{ position: "absolute", top: 12, right: 12, left: "auto", zIndex: 1000 }}
              >
                <span className="const-fs-cta-ico">⛶</span>
                <span className="const-fs-cta-tip" style={{ left: "auto", right: 0, textAlign: "right" }}>
                  {t("darksky.fullscreenHint")}
                </span>
              </button>
              <DarkSkyMap loc={loc} />
            </div>
            <div className="sat-controls">
              <span className="count" style={{ marginLeft: 0, marginRight: 4 }}>{t("darksky.legend.title")}:</span>
              {LEGEND.map((l) => (
                <span key={l.tier} className="chip" style={{ color: l.hex }}>
                  <span className="swatch" style={{ background: l.hex }} />
                  {t("darksky.tier." + l.tier)}
                </span>
              ))}
            </div>
          </div>
          <p className="section-sub" style={{ marginTop: 14 }}>{t("darksky.legend.hint")}</p>
          <p className="section-sub" style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
            {t("darksky.attribution")}
          </p>
        </div>
      </section>

      {showFs && <DarkSkyMapFullscreen loc={loc} lang={lang} onClose={() => setShowFs(false)} />}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("darksky.verdict.eyebrow")} title={t("darksky.verdict.title")} />
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="k">{t("darksky.verdict.title")}</div>
            <div className={"v" + (verdictKey === "excellent" || verdictKey === "good" ? " accent" : "")} style={{ fontSize: 26 }}>
              {verdictKey ? t("darksky.verdict." + verdictKey) : t("darksky.verdict.loading")}
            </div>
            <div className="foot">{t("darksky.verdict.note." + (verdictKey || "unknown"))}</div>
          </div>
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("darksky.card.cloud")}</div>
              <div className="v">
                {cloudPct != null ? cloudPct : "—"}
                {cloudPct != null && <span className="unit">%</span>}
              </div>
              <div className="foot">{cloudPct == null ? t("darksky.card.cloudUnknown") : ""}</div>
            </div>
            <div className="card">
              <div className="k">{t("darksky.card.zone")}</div>
              <div className="v" style={{ fontSize: 20 }}>
                {zone === undefined
                  ? t("darksky.card.zoneChecking")
                  : zone
                  ? t("darksky.tier." + zone.tier)
                  : t("darksky.card.zoneUnknown")}
              </div>
              <div className="foot">{zone ? "Zone " + zone.zone : ""}</div>
            </div>
            <div className="card">
              <div className="k">{t("darksky.card.moon")}</div>
              <div className="v">
                {moonPct != null ? moonPct : "—"}
                {moonPct != null && <span className="unit">%</span>}
              </div>
              <div className="foot">
                {cond ? (cond.moon_up_now ? t("darksky.card.moonUp") : t("darksky.card.moonDown")) : ""}
                {cond && cond.moon_phase_name ? " · " + cond.moon_phase_name : ""}
              </div>
            </div>
            <div className="card">
              <div className="k">{t("darksky.card.kp")}</div>
              <div className="v">{kp != null ? kp : "—"}</div>
              <div className="foot">{cond ? (cond.kp_storm ? t("darksky.card.kpStorm") : t("darksky.card.kpCalm")) : ""}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("darksky.s1.eyebrow")} title={t("darksky.s1.title")} />
          <p className="section-sub">{t("darksky.s1.sub")}</p>
          <FeatureRow tag={t("darksky.tips.t1_tag")} title={t("darksky.tips.t1_title")}>{t("darksky.tips.t1_body")}</FeatureRow>
          <FeatureRow tag={t("darksky.tips.t2_tag")} title={t("darksky.tips.t2_title")}>{t("darksky.tips.t2_body")}</FeatureRow>
          <FeatureRow tag={t("darksky.tips.t3_tag")} title={t("darksky.tips.t3_title")}>{t("darksky.tips.t3_body")}</FeatureRow>
        </div>
      </section>
    </>
  );
}
