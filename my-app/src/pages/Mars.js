// Mars planet page (/planetarium/mars). Ports templates/mars.html into the
// SPA: hero with the Mars+moons orbit animation, live InSight weather (reuses
// MarsWeatherView from the weather feature), a Mars-vs-Earth comparison table,
// Phobos & Deimos cards, the rover-photos section (live, via RoverPhotos), the
// Perseverance route map, dust-storm tracker, atmosphere-pressure scale,
// exploration timeline, mission-status list, next launch window and a facts
// grid. Most prose is static and localized via the `mars.*` i18n keys.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import { MarsWeatherView } from "../components/weather/MarsWeather";
import { MarsSkeleton } from "../components/weather/WeatherSkeletons";
import RoverPhotos from "../components/mars/RoverPhotos";
import { useApi } from "../hooks/useApi";
import { getMars } from "../lib/api";
import "../styles/planetarium.css";

// Mars-vs-Earth comparison rows. Both the parameter label and each cell value
// go through i18n (units like "год"/"h" differ per language).
const COMPARE_ROWS = ["day", "year", "gravity", "diameter", "temp", "atmosphere", "moons"];

// Perseverance landed in Jezero Crater on 2021-02-18 ~20:55 UTC (mission sol 0).
// A Mars sol is 88775.244 s (24h 39m 35.244s). The live mission-sol counter in
// the route section is derived from the landing date, so it stays correct
// without manual edits. The polyline itself is a SCHEMATIC of the documented
// early traverse (landing → Séítah → delta → Bright Angel); real lat/lon of
// the current position isn't exposed by any public API, so refresh the waypoint
// sols/positions manually from NASA Mars Trek before a release.
const PERSEVERANCE_LANDING = new Date("2021-02-18T20:55:00Z").getTime();
const SOL_SECONDS = 88775.244;
const currentPerseveranceSol = () =>
  Math.floor((Date.now() - PERSEVERANCE_LANDING) / 1000 / SOL_SECONDS);

const TIMELINE = [
  { tag: "1976", t: "Viking 1 і 2", n: "firstLandings" },
  { tag: "1997", t: "Mars Pathfinder / Sojourner", n: "firstRover" },
  { tag: "2004", t: "Spirit і Opportunity", n: "longevity" },
  { tag: "2012", t: "Curiosity", n: "today" },
  { tag: "2021", t: "Perseverance + Ingenuity", n: "firstFlight" },
  { tag: "2030-ті", t: "Mars Sample Return", n: "ahead" },
];

const MISSIONS = [
  { n: "Perseverance + Ingenuity*", ag: "NASA", yr: "2021", st: "active", s: "on" },
  { n: "Curiosity", ag: "NASA", yr: "2012", st: "active", s: "on" },
  { n: "Mars Reconnaissance Orbiter", ag: "NASA", yr: "2005", st: "orbit", s: "on" },
  { n: "Mars Express", ag: "ESA", yr: "2003", st: "orbit", s: "on" },
  { n: "MAVEN", ag: "NASA", yr: "2013", st: "orbit", s: "on" },
  { n: "ExoMars TGO", ag: "ESA/Роскосмос", yr: "2016", st: "orbit", s: "on" },
  { n: "Hope (Al-Amal)", ag: "ОАЕ", yr: "2021", st: "orbit", s: "on" },
  { n: "Tianwen-1 (орбітальний)", ag: "Китай", yr: "2021", st: "orbit", s: "on" },
  { n: "InSight", ag: "NASA", yr: "2018", st: "done2022", s: "off" },
  { n: "Zhurong", ag: "Китай", yr: "2021", st: "lost2022", s: "off" },
  { n: "Opportunity", ag: "NASA", yr: "2004", st: "done2018", s: "off" },
  { n: "Spirit", ag: "NASA", yr: "2004", st: "done2010", s: "off" },
];

export default function Mars() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.mars"); }, [t]);
  const { data: mars, loading } = useApi(getMars);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="hero">
        <div className="wrap hero-grid mars-hero-grid">
          <div>
            <div className="eyebrow">{t("mars.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("mars.hero.title") }} />
            <p className="hero-sub">{t("mars.hero.sub")}</p>
            <div className="stat-mini" style={{ marginTop: 26 }}>
              <div className="box"><div className="n">225 млн км</div><div className="l">{t("mars.stats.distanceL")}</div></div>
              <div className="box"><div className="n">12.5 хв</div><div className="l">{t("mars.stats.signalL")}</div></div>
            </div>
            <p className="mars-hero-note">{t("mars.stats.note")}</p>
          </div>
          <div className="orbit-wrap">
            <svg viewBox="0 0 480 420" xmlns="http://www.w3.org/2000/svg">
              <circle className="mars-orbit-ring" cx="240" cy="218.4" r="100" />
              <circle className="mars-orbit-ring" cx="240" cy="218.4" r="148" />
              <image
                href="/planets/Mars.png"
                x="170" y="148" width="140" height="140"
                className="mars-disc-img"
              />
              <g>
                <circle cx="340" cy="218.4" r="3.4" fill="#B7ADA3" />
                <animateTransform attributeName="transform" type="rotate" from="0 240 218.4" to="360 240 218.4" dur="6s" repeatCount="indefinite" />
              </g>
              <g>
                <circle cx="388" cy="218.4" r="2.6" fill="#9C948B" />
                <animateTransform attributeName="transform" type="rotate" from="0 240 218.4" to="360 240 218.4" dur="24s" repeatCount="indefinite" />
              </g>
              <text className="mars-moon-label" x="240" y="108.4" textAnchor="middle">{t("mars.hero.phobos")}</text>
              <text className="mars-moon-label" x="240" y="60.4" textAnchor="middle">{t("mars.hero.deimos")}</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ---------- weather ---------- */}
      <section className="section" id="weather" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead gold eyebrow={t("mars.weather.eyebrow")} title={t("mars.weather.title")} sub={t("mars.weather.sub")} />
          {loading && !mars ? <MarsSkeleton /> : <MarsWeatherView d={mars} />}
        </div>
      </section>

      {/* ---------- mars vs earth ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.compare.eyebrow")} title={t("mars.compare.title")} />
          <table className="data">
            <thead>
              <tr><th>{t("mars.compare.param")}</th><th>{t("nav.mars")}</th><th>{t("nav.earth")}</th></tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((k) => (
                <tr key={k}>
                  <td>{t("mars.compare.p." + k)}</td>
                  <td className="mono">{t("mars.compare.v." + k + ".mars")}</td>
                  <td className="mono">{t("mars.compare.v." + k + ".earth")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- moons ---------- */}
      <section className="section" id="moons">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.moons.eyebrow")} title={t("mars.moons.title")} />
          <div className="grid cols-2">
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <svg className="moon-phase-mini" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">
                  <defs><clipPath id="clipPhobos"><circle cx="27" cy="27" r="22" /></clipPath></defs>
                  <circle cx="27" cy="27" r="22" fill="#2a2d3d" />
                  <g clipPath="url(#clipPhobos)"><circle cx="43.7" cy="27" r="22" fill="#D9CBBE" /></g>
                  <circle cx="27" cy="27" r="22" fill="none" stroke="var(--border)" strokeWidth="1" />
                </svg>
                <div>
                  <div className="k">{t("mars.moons.phobos")}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--gold)", marginTop: 4 }}>{t("mars.moons.phobosIllum")}</div>
                </div>
              </div>
              <div className="mars-moon-desc">{t("mars.moons.phobosDesc")}</div>
            </div>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <svg className="moon-phase-mini" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">
                  <defs><clipPath id="clipDeimos"><circle cx="27" cy="27" r="22" /></clipPath></defs>
                  <circle cx="27" cy="27" r="22" fill="#2a2d3d" />
                  <g clipPath="url(#clipDeimos)"><circle cx="-4.7" cy="27" r="22" fill="#C4BBB1" /></g>
                  <circle cx="27" cy="27" r="22" fill="none" stroke="var(--border)" strokeWidth="1" />
                </svg>
                <div>
                  <div className="k">{t("mars.moons.deimos")}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--teal)", marginTop: 4 }}>{t("mars.moons.deimosIllum")}</div>
                </div>
              </div>
              <div className="mars-moon-desc">{t("mars.moons.deimosDesc")}</div>
            </div>
          </div>
          <p className="mars-moons-note">{t("mars.moons.note")}</p>
        </div>
      </section>

      {/* ---------- rovers (live) ---------- */}
      <RoverPhotos />

      {/* ---------- perseverance route ---------- */}
      <section className="section" id="route">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.route.eyebrow")} title={t("mars.route.title")} />
          <div className="route-live">
            <span className="dot live" />
            <span className="route-live-sol">{t("mars.route.sol", { n: currentPerseveranceSol() })}</span>
            <span className="route-live-lbl">{t("mars.route.liveNow")}</span>
          </div>
          <div className="route-wrap">
            <svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg">
              <polyline className="route-path" points="60,240 170,130 280,210 400,90 520,160 630,80 700,130" />
              <circle cx="60" cy="240" r="4" fill="var(--gold)" className="obj-dot" />
              <text className="route-label" x="60" y="226" textAnchor="middle">Octavia E. Butler</text>
              <text className="route-sol" x="60" y="237" textAnchor="middle">{t("mars.route.landing")}</text>
              <circle cx="170" cy="130" r="4" fill="var(--gold)" className="obj-dot" />
              <text className="route-label" x="170" y="150" textAnchor="middle">Séítah</text>
              <text className="route-sol" x="170" y="161" textAnchor="middle">{t("mars.route.sol", { n: 235 })}</text>
              <circle cx="280" cy="210" r="4" fill="var(--gold)" className="obj-dot" />
              <text className="route-label" x="280" y="196" textAnchor="middle">South Séítah</text>
              <text className="route-sol" x="280" y="207" textAnchor="middle">{t("mars.route.sol", { n: 400 })}</text>
              <circle cx="400" cy="90" r="4" fill="var(--gold)" className="obj-dot" />
              <text className="route-label" x="400" y="110" textAnchor="middle">{t("mars.route.delta")}</text>
              <text className="route-sol" x="400" y="121" textAnchor="middle">{t("mars.route.sol", { n: 600 })}</text>
              <circle cx="520" cy="160" r="4" fill="var(--gold)" className="obj-dot" />
              <text className="route-label" x="520" y="146" textAnchor="middle">Enchanted Lake</text>
              <text className="route-sol" x="520" y="157" textAnchor="middle">{t("mars.route.sol", { n: 780 })}</text>
              <circle cx="630" cy="80" r="4" fill="var(--gold)" className="obj-dot" />
              <text className="route-label" x="630" y="100" textAnchor="middle">Bright Angel</text>
              <text className="route-sol" x="630" y="111" textAnchor="middle">{t("mars.route.sol", { n: 1250 })}</text>
              <circle cx="700" cy="130" r="6" fill="var(--teal)" className="obj-dot" />
              <text className="route-label now" x="700" y="116" textAnchor="middle">{t("mars.route.latest")}</text>
              <text className="route-sol" x="700" y="127" textAnchor="middle">{t("mars.route.sol", { n: 1402 })}</text>
            </svg>
          </div>
          <p className="route-note">{t("mars.route.note")}</p>
        </div>
      </section>

      {/* ---------- dust storms ---------- */}
      <section className="section" id="dust">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.dust.eyebrow")} title={t("mars.dust.title")} sub={t("mars.dust.sub")} />
          <div className="dust-track">
            <div className="dust-seg" style={{ width: "50%", background: "rgba(79,209,197,.25)" }} />
            <div className="dust-seg" style={{ width: "39%", background: "linear-gradient(90deg,rgba(232,185,77,.3),rgba(255,107,74,.4))" }} />
            <div className="dust-seg" style={{ width: "11%", background: "rgba(79,209,197,.25)" }} />
          </div>
          <div style={{ position: "relative", height: 0 }}>
            <div className="dust-marker" style={{ left: "58%" }}>
              <span className="lbl">{t("mars.dust.now")}</span><span className="flag" />
            </div>
          </div>
          <div className="dust-axis" style={{ marginTop: 44 }}>
            <span>{t("mars.dust.ls0")}</span>
            <span>{t("mars.dust.ls90")}</span>
            <span>{t("mars.dust.ls180")}</span>
            <span>{t("mars.dust.ls270")}</span>
            <span>Ls 360°</span>
          </div>
          <div className="grid cols-3" style={{ marginTop: 22 }}>
            <div className="card"><div className="k">{t("mars.dust.risk")} <span className="dot warn" /></div><div className="v" style={{ fontSize: 20 }}>{t("mars.dust.riskVal")}</div><div className="foot">{t("mars.dust.riskFoot")}</div></div>
            <div className="card"><div className="k">{t("mars.dust.last")}</div><div className="v" style={{ fontSize: 20 }}>2018</div><div className="foot">{t("mars.dust.lastFoot")}</div></div>
            <div className="card"><div className="k">{t("mars.dust.low")}</div><div className="v" style={{ fontSize: 20 }}>Ls 0–160°</div><div className="foot">{t("mars.dust.lowFoot")}</div></div>
          </div>
        </div>
      </section>

      {/* ---------- pressure ---------- */}
      <section className="section" id="pressure">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.pressure.eyebrow")} title={t("mars.pressure.title")} sub={t("mars.pressure.sub")} />
          <div className="pressure-wrap">
            <div className="pressure-bar" />
            <div className="pressure-marks">
              <div className="pmark" style={{ top: "2%" }}><span className="txt">40 км</span><span className="ln" /></div>
              <div className="pmark hl" style={{ top: "14%" }}><span className="txt">{t("mars.pressure.m35")}</span><span className="ln" /></div>
              <div className="pmark" style={{ top: "48%" }}><span className="txt">{t("mars.pressure.armstrong")}</span><span className="ln" /></div>
              <div className="pmark" style={{ top: "72%" }}><span className="txt">{t("mars.pressure.jet")}</span><span className="ln" /></div>
              <div className="pmark" style={{ top: "96%" }}><span className="txt">{t("mars.pressure.sea")}</span><span className="ln" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- timeline ---------- */}
      <section className="section" id="timeline">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.timeline.eyebrow")} title={t("mars.timeline.title")} />
          {TIMELINE.map((e) => (
            <FeatureRow key={e.tag} tag={e.tag} title={e.t} num={t("mars.timeline.num." + e.n)}>
              {t("mars.timeline.desc." + e.n)}
            </FeatureRow>
          ))}
        </div>
      </section>

      {/* ---------- mission status ---------- */}
      <section className="section" id="mission-status">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.missions.eyebrow")} title={t("mars.missions.title")} />
          <div className="card" style={{ padding: "8px 22px" }}>
            {MISSIONS.map((m) => (
              <div className="mission-row" key={m.n}>
                <span className={m.s === "on" ? "dot live" : "dot-off"} />
                <span className="nm">{m.n}</span>
                <span className="ag">{m.ag}</span>
                <span className="yr">{m.yr}</span>
                <span className={"st " + (m.s === "on" ? "active" : "retired")}>{t("mars.missions.status." + m.st)}</span>
              </div>
            ))}
          </div>
          <p className="mars-missions-note">{t("mars.missions.note")}</p>
        </div>
      </section>

      {/* ---------- launch window ---------- */}
      <section className="section" id="launch-window">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.window.eyebrow")} title={t("mars.window.title")} />
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("mars.window.until")}</div>
              <div className="clock" style={{ marginTop: 14 }}>
                <div className="seg"><div className="n">07</div><span className="u">{t("mars.window.months")}</span></div>
                <div className="seg"><div className="n">14</div><span className="u">{t("mars.window.days")}</span></div>
              </div>
              <div className="foot" style={{ marginTop: 14 }}>{t("mars.window.foot")}</div>
            </div>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("mars.window.why")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>{t("mars.window.whyBody")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- facts ---------- */}
      <section className="section" id="facts">
        <div className="wrap">
          <SectionHead eyebrow={t("mars.facts.eyebrow")} title={t("mars.facts.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("mars.facts.olympus")}</div>
              <div className="v" style={{ fontSize: 20 }}>21.9 км</div>
              <div className="foot">{t("mars.facts.olympusFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("mars.facts.valles")}</div>
              <div className="v" style={{ fontSize: 20 }}>4 000 км</div>
              <div className="foot">{t("mars.facts.vallesFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("mars.facts.meteorites")}</div>
              <div className="v" style={{ fontSize: 20 }}>≈ 300</div>
              <div className="foot">{t("mars.facts.meteoritesFoot")}</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}