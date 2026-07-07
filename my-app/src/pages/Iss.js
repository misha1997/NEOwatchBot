// ISS page (iss.html): live map (SatMap follow+track) with the header coords
// line + speed/altitude cards fed from the in-browser TLE propagation, the
// orbit-numbers grid (incl. crew from /api/iss/crew), the visible-passes table
// (/api/iss/passes), and observing tips. Port of the iss.html inline script.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import SatMap from "../components/SatMap";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import { useApi } from "../hooks/useApi";
import { useLoc, locCity } from "../context/LocationContext";
import { getIssPasses, getIssCrew, getIssNow } from "../lib/api";
import { fmtInt } from "../lib/format";
import { BOT_URL } from "../lib/constants";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function PassRow({ p, t }) {
  const parts = (p.start || "").split("· ");
  const date = parts[0] ? parts[0].trim() : "—";
  const time = parts[1] ? parts[1].trim() : "—";
  const mins = Math.round((p.duration_sec || 0) / 60);
  const pillCls = p.mag !== null && p.mag !== undefined && p.mag < -3 ? "pill gold" : "pill teal";
  return (
    <tr>
      <td>{date}</td>
      <td className="mono-accent">{time}</td>
      <td>{mins} {t("common.units.min")}</td>
      <td>{p.max_el || "—"}°</td>
      <td style={{ color: "var(--text-dim)" }}>{p.from_dir} → {p.to_dir}</td>
      <td style={{ textAlign: "right" }}>
        <span className={pillCls}>{p.mag !== null && p.mag !== undefined ? p.mag : "—"}</span>
      </td>
    </tr>
  );
}

// Expedition start timestamp (unix seconds or ms) → "5 лип 2026".
function fmtExpeditionStart(ts, t) {
  if (!ts) return "";
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  return d.getDate() + " " + t("common.months." + MONTH_KEYS[d.getMonth()]) + " " + d.getFullYear();
}

function CrewSection({ crewD, t }) {
  const groups = (crewD && crewD.by_spacecraft) || null;
  const crew = (crewD && crewD.crew) || null;

  // No data yet — the request is still in flight or failed.
  if (!crewD) {
    return (
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.crew.eyebrow")} title={t("iss.crew.title")} />
          <p className="section-sub">{t("iss.crew.loading")}</p>
        </div>
      </section>
    );
  }
  if (!crew || !crew.length) {
    return (
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.crew.eyebrow")} title={t("iss.crew.title")} />
          <p className="section-sub">{t("iss.crew.unavailable")}</p>
        </div>
      </section>
    );
  }

  const patch = crewD.expedition_patch;
  const expUrl = crewD.expedition_url;
  const expedition = crewD.expedition;
  const since = fmtExpeditionStart(crewD.expedition_start_date, t);
  const groupEntries = Object.entries(groups || { "": crew });

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SectionHead eyebrow={t("iss.crew.eyebrow")} title={t("iss.crew.title")} />
        <p className="section-sub">{t("iss.crew.sub")}</p>

        <div className="crew-layout">
          <aside className="crew-exp-card">
            {patch ? (
              <img className="crew-patch" src={patch} alt="" loading="lazy" />
            ) : (
              <div className="crew-patch ph">🛰️</div>
            )}
            <div className="crew-exp-name">
              {expedition ? t("iss.expedition", { n: expedition }) : t("iss.hero.eyebrow")}
            </div>
            {since && <div className="crew-since">{t("iss.crew.since", { date: since })}</div>}
            {expUrl && expedition && (
              <a className="crew-link" href={expUrl} target="_blank" rel="noreferrer">
                {t("iss.crew.expeditionLink", { n: expedition })}
              </a>
            )}
          </aside>

          <div className="crew-groups">
            {groupEntries.map(([craft, members]) => (
              <div className="crew-group" key={craft || "_"}>
                <div className="crew-craft">🚀 {craft || t("iss.crew.unknownCraft")}</div>
                <div className="crew-list">
                  {members.map((p, i) => (
                    <div className="crew-person" key={i}>
                      <span className="cp-flag" aria-hidden="true">{p.flag || "🏳️"}</span>
                      <div className="cp-body">
                        <div className="cp-name">{p.name || "—"}</div>
                        <div className="cp-pos">{p.position}</div>
                        <div className="cp-meta">
                          {p.agency && <span>{p.agency}</span>}
                          {p.days_in_space != null && (
                            <span>{t("iss.crew.daysInSpace", { n: p.days_in_space })}</span>
                          )}
                          {p.country && <span>{p.country}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Iss() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.iss"); }, [t]);
  const { lang } = useLang();
  const mapRef = useRef(null);
  const { loc } = useLoc();
  const city = locCity(loc) || t("common.kyiv");
  const [note, setNote] = useState(t("iss.loadingPos"));
  const [pos, setPos] = useState(null); // {lat,lon,alt,vel} from onTick

  const { data: crewD } = useApi(() => getIssCrew(lang), { deps: [lang] });
  const { data: passD } = useApi(() => getIssPasses(loc, lang), { deps: [loc && loc.lat, loc && loc.lon, lang] });
  // Keep the live ISS position payload fetched with the active language (so
  // any localized fields follow the language switch).
  useApi(() => getIssNow(lang), { deps: [lang] });

  // Placeholder pass rows shown until /api/iss/passes resolves. Built inside
  // the component so they can use t(...).
  const PASS_PH = [
    { start: "5 " + t("common.months.jul") + " · 22:14", max_el: 78, from_dir: t("common.compass.NW"), to_dir: t("common.compass.SE"), duration_sec: 360, mag: -3.8 },
    { start: "6 " + t("common.months.jul") + " · 21:26", max_el: 54, from_dir: t("common.compass.W"), to_dir: t("common.compass.S"), duration_sec: 300, mag: -3.1 },
    { start: "7 " + t("common.months.jul") + " · 22:01", max_el: 32, from_dir: t("common.compass.NW"), to_dir: t("common.compass.S"), duration_sec: 240, mag: -2.4 },
    { start: "8 " + t("common.months.jul") + " · 21:13", max_el: 65, from_dir: t("common.compass.W"), to_dir: t("common.compass.SE"), duration_sec: 360, mag: -3.5 },
  ];

  const passes = (passD && passD.items) || PASS_PH;
  const crewCount = crewD && crewD.count != null ? crewD.count : 7;
  const expedition = crewD && crewD.expedition ? t("iss.expedition", { n: crewD.expedition }) : t("iss.expedition", { n: 72 });

  const coords = pos
    ? t("iss.coords", {
        lat: Math.abs(pos.lat).toFixed(2) + "°" + (pos.lat >= 0 ? t("common.compass.N") : t("common.compass.S")),
        lon: Math.abs(pos.lon).toFixed(2) + "°" + (pos.lon >= 0 ? t("common.compass.E") : t("common.compass.W")),
        alt: pos.alt.toFixed(0),
      })
    : t("iss.coords", { lat: "50.45°" + t("common.compass.N"), lon: "30.52°" + t("common.compass.E"), alt: "417" });

  const kmh = pos ? fmtInt(Math.round(pos.vel * 3600)) : "27 600";
  const kms = pos ? "~" + pos.vel.toFixed(2) + " " + t("common.units.km_s") : "~7.66 " + t("common.units.km_s");
  const altKm = pos ? pos.alt.toFixed(0) : "417";

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow"><span className="dot live" /> {t("iss.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("iss.hero.title") }} />
            <p className="hero-sub">{t("iss.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#passes" className="btn primary">{t("iss.hero.passes", { city })}</a>
              <a href={BOT_URL} className="btn ghost" target="_blank" rel="noreferrer">{t("iss.hero.telegram")}</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="map-card">
            <div className="map-head">
              <div className="live"><span className="dot live" /> {t("iss.map.live")}</div>
              <span className="coords">{coords}</span>
            </div>
            <div className="map-body map-live">
              <SatMap ref={mapRef} groups={["iss"]} limit={5} follow track lang={lang}
                onReady={() => setNote(t("iss.map.note"))}
                onTick={(p) => setPos(p)} />
              <div className="note">{note}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.s1.eyebrow")} title={t("iss.s1.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("iss.card.speed")}</div>
              <div className="v">{kmh}<span className="unit">{t("common.units.km_h")}</span></div>
              <div className="foot">{kms}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.card.alt")}</div>
              <div className="v">{altKm}<span className="unit">{t("common.units.km")}</span></div>
              <div className="foot">{t("iss.card.leo")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.card.orbit")}</div>
              <div className="v">92<span className="unit">{t("common.units.min")}</span></div>
              <div className="foot">{t("iss.card.orbitFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.card.crew")}</div>
              <div className="v accent">{crewCount}<span className="unit">{t("iss.card.crewUnit")}</span></div>
              <div className="foot">{expedition}</div>
            </div>
          </div>
        </div>
      </section>

      <CrewSection crewD={crewD} t={t} />

      <section className="section" id="passes" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead gold eyebrow={t("iss.s2.eyebrow", { city })} title={t("iss.s2.title")} linkTo="/" linkLabel={t("iss.s2.link")} />
          <p className="section-sub">{t("iss.s2.sub")}</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("iss.col.date")}</th>
                  <th>{t("iss.col.time")}</th>
                  <th>{t("iss.col.duration")}</th>
                  <th>{t("iss.col.maxAlt")}</th>
                  <th>{t("iss.col.dir")}</th>
                  <th style={{ textAlign: "right" }}>{t("iss.col.bright")}</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((p, i) => <PassRow key={i} p={p} t={t} />)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.s3.eyebrow")} title={t("iss.s3.title")} />
          <FeatureRow tag={t("iss.tips.t1_tag")} title={t("iss.tips.t1_title")} num={t("iss.tips.t1_num")}>{t("iss.tips.t1_body")}</FeatureRow>
          <FeatureRow tag={t("iss.tips.t2_tag")} title={t("iss.tips.t2_title")} num={t("iss.tips.t2_num")}>{t("iss.tips.t2_body")}</FeatureRow>
          <FeatureRow tag={t("iss.tips.t3_tag")} title={t("iss.tips.t3_title")} num={t("iss.tips.t3_num")}>{t("iss.tips.t3_body")}</FeatureRow>
        </div>
      </section>
    </>
  );
}