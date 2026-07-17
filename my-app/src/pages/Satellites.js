// Satellites page (satellites.html): multi-group live map with a chip bar that
// toggles Celestrak groups on/off. Port of the satellites.html inline script.
// Default-on groups (starlink/visual/stations) load on first paint; chips come
// from /api/tle/groups and add/remove groups through the SatMap ref handle.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import SatMap from "../components/SatMap";
import LocalizedLink from "../components/primitives/LocalizedLink";
import SectionHead from "../components/primitives/SectionHead";
import { useApi } from "../hooks/useApi";
import { getTleGroups } from "../lib/api";

const DEFAULTS = ["starlink", "visual", "stations"];

export default function Satellites() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.satellites"); }, [t]);
  const { lang } = useLang();
  const mapRef = useRef(null);
  const { data: groups } = useApi(() => getTleGroups(lang), { deps: [lang] });
  const [active, setActive] = useState(() =>
    DEFAULTS.reduce((a, k) => { a[k] = true; return a; }, {})
  );
  const [count, setCount] = useState(null);

  const toggle = (g) => {
    const map = mapRef.current;
    if (!map) return;
    if (active[g.key]) {
      map.removeGroup(g.key);
      setActive((a) => ({ ...a, [g.key]: false }));
    } else {
      setActive((a) => ({ ...a, [g.key]: true }));
      map.addGroup(g.key).then(() => setCount(map.sats.length));
    }
    setCount(map.sats.length);
  };

  const countTxt = count == null ? t("satellites.loading") : t("satellites.onMap", { n: count });

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow"><span className="dot live" /> {t("satellites.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("satellites.hero.title") }} />
            <p className="hero-sub">{t("satellites.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#sat-map-card" className="btn primary">{t("satellites.hero.map")}</a>
              <LocalizedLink to="iss" className="btn ghost">{t("satellites.hero.iss")}</LocalizedLink>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="sat-map-card" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="map-card">
            <div className="sat-controls">
              {(groups || []).map((g) => (
                <button type="button" key={g.key}
                  className={"chip" + (active[g.key] ? " on" : "")}
                  style={{ color: active[g.key] ? g.color : "" }}
                  onClick={() => toggle(g)}>
                  <span className="swatch" style={{ background: g.color }} />
                  {g.icon ? g.icon + " " : ""}{g.label}
                </button>
              ))}
              <span className="count">{countTxt}</span>
            </div>
            <div className="map-body map-live">
              <SatMap ref={mapRef} groups={DEFAULTS} limit={400} lang={lang}
                onReady={(n) => setCount(n)}
                onCount={(n) => setCount(n)} />
            </div>
          </div>
          <p className="section-sub" style={{ marginTop: 14 }}>{t("satellites.s1_sub")}</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("satellites.s2.eyebrow")} title={t("satellites.s2.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("satellites.cards.tle")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{t("satellites.cards.tleBody")}</p>
            </div>
            <div className="card">
              <div className="k">{t("satellites.cards.sgp4")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{t("satellites.cards.sgp4Body")}</p>
            </div>
            <div className="card">
              <div className="k">{t("satellites.cards.realtime")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{t("satellites.cards.realtimeBody")}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}