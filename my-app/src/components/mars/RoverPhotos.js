// Mars rover photos section (templates/mars.html #rovers). Pulls the latest
// Perseverance / Curiosity imagery from /api/mars/rovers and renders a filter
// bar (All / Perseverance / Curiosity) plus a per-rover gallery. Real photos
// open in a lightbox (prev/next + Esc) reusing the .photo-modal classes from
// the gallery. When the Mars Vista API key isn't configured server-side,
// `configured` is false and we show placeholder gradient tiles instead.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getMarsRovers } from "../../lib/api";

// Placeholder gradient per tile — used when there are no real photos.
const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(160deg,#4d3a1a,#0d0f1c)",
  "linear-gradient(160deg,#3a2d1a,#0d0f1c)",
  "linear-gradient(160deg,#5a3f1e,#0d0f1c)",
  "linear-gradient(160deg,#43331a,#0d0f1c)",
];

// One rover's gallery: up to 4 tiles. Real photos carry their index in the
// flat visible-photos list so a click opens the lightbox at the right place;
// placeholder tiles (no real photo available) are not clickable.
function RoverGallery({ photos, rover, flatOffset, t, onOpen }) {
  const sol = photos && photos.length ? photos[0].sol : null;
  const location = rover === "perseverance" ? t("mars.rovers.jezero") : t("mars.rovers.sharp");
  return (
    <>
      <div className="eyebrow" style={{ marginTop: 22 }}>
        {rover === "perseverance" ? "Perseverance" : "Curiosity"} ·{" "}
        {sol != null ? t("mars.rovers.solN", { n: sol }) : t("mars.rovers.noSol")} · {location}
      </div>
      <div className="gal" style={{ marginTop: 14 }}>
        {(photos && photos.length ? photos.slice(0, 4) : Array.from({ length: 4 })).map((p, i) => {
          if (p && p.img_src) {
            const flatIdx = flatOffset + i;
            return (
              <div key={i} className="rover-photo clickable"
                style={{ backgroundImage: `url(${p.img_src})`, backgroundSize: "cover", backgroundPosition: "center" }}
                onClick={() => onOpen(flatIdx)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(flatIdx); } }}
                aria-label={t("mars.rovers.lightbox.open", { camera: p.camera || "—" })}>
                <span className="zoom-hint">{t("mars.rovers.lightbox.hint")}</span>
                <div className="info">{p.camera || "—"} · {p.earth_date || t("mars.rovers.noDate")}</div>
              </div>
            );
          }
          return (
            <div key={i} className="rover-photo" style={{ background: PLACEHOLDER_GRADIENTS[i % 4] }}>
              <div className="info">{t("mars.rovers.placeholder")}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function RoverPhotos() {
  const { t } = useTranslation();
  const { data, loading } = useApi(getMarsRovers);
  const [filter, setFilter] = useState("all"); // all | perseverance | curiosity
  const [modalIdx, setModalIdx] = useState(null);

  const configured = data && data.configured;
  const pers = (data && data.perseverance) || [];
  const curi = (data && data.curiosity) || [];
  const persSol = pers.length ? pers[0].sol : null;
  const curiSol = curi.length ? curi[0].sol : null;

  // Flat list of real photos currently visible (respecting the filter) — the
  // lightbox cycles through this list with prev/next.
  const persShown = show("perseverance") ? pers.slice(0, 4) : [];
  const curiShown = show("curiosity") ? curi.slice(0, 4) : [];
  const flat = [...persShown, ...curiShown];
  const persOffset = 0;
  const curiOffset = persShown.length;

  function show(which) { return filter === "all" || filter === which; }

  const modal = modalIdx != null && flat[modalIdx] ? flat[modalIdx] : null;

  // Lightbox keyboard nav + body scroll lock.
  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.key === "Escape") setModalIdx(null);
      else if (e.key === "ArrowLeft")
        setModalIdx((i) => (i == null ? null : (i - 1 + flat.length) % flat.length));
      else if (e.key === "ArrowRight")
        setModalIdx((i) => (i == null ? null : (i + 1) % flat.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modal, flat.length]);

  return (
    <section className="section" id="rovers">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t("mars.rovers.eyebrow")}</div>
            <h2 className="section-title">{t("mars.rovers.title")}</h2>
          </div>
        </div>

        <div className="filters" style={{ marginBottom: 18 }}>
          <button type="button" className={"filter-pill" + (filter === "all" ? " on" : "")}
            onClick={() => setFilter("all")}>{t("mars.rovers.all")}</button>
          <button type="button" className={"filter-pill" + (filter === "perseverance" ? " on" : "")}
            onClick={() => setFilter("perseverance")}>Perseverance</button>
          <button type="button" className={"filter-pill" + (filter === "curiosity" ? " on" : "")}
            onClick={() => setFilter("curiosity")}>Curiosity</button>
        </div>

        {configured === false && (
          <p className="section-sub" style={{ color: "var(--coral)" }}>
            {t("mars.rovers.notConfigured")}
          </p>
        )}

        {loading && !data ? (
          <div className="gal" style={{ marginTop: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rover-photo" style={{ background: PLACEHOLDER_GRADIENTS[i % 4] }} />
            ))}
          </div>
        ) : (
          <>
            {show("perseverance") && <RoverGallery photos={pers} rover="perseverance" flatOffset={persOffset} t={t} onOpen={setModalIdx} />}
            {show("curiosity") && <RoverGallery photos={curi} rover="curiosity" flatOffset={curiOffset} t={t} onOpen={setModalIdx} />}
          </>
        )}

        <div className="grid cols-4" style={{ marginTop: 22 }}>
          <div className="card">
            <div className="k">Perseverance</div>
            <div className="v" style={{ fontSize: 20 }}>{persSol != null ? t("mars.rovers.solN", { n: persSol }) : "—"}</div>
            <div className="foot">{t("mars.rovers.persFoot")}</div>
          </div>
          <div className="card">
            <div className="k">Curiosity</div>
            <div className="v" style={{ fontSize: 20 }}>{curiSol != null ? t("mars.rovers.solN", { n: curiSol }) : "—"}</div>
            <div className="foot">{t("mars.rovers.curiFoot")}</div>
          </div>
          <div className="card">
            <div className="k">{t("mars.rovers.distPers")}</div>
            <div className="v">32.4<span className="unit">{t("common.units.km")}</span></div>
            <div className="foot">{t("mars.rovers.distFoot")}</div>
          </div>
          <div className="card">
            <div className="k">{t("mars.rovers.distCuri")}</div>
            <div className="v">32.1<span className="unit">{t("common.units.km")}</span></div>
            <div className="foot">{t("mars.rovers.sinceFoot")}</div>
          </div>
        </div>
      </div>

      {modal && (
        <div className="photo-modal open" onClick={() => setModalIdx(null)}>
          <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-img"
              style={{ backgroundImage: `url("${modal.img_src}")` }}>
              <button className="photo-modal-close" onClick={() => setModalIdx(null)}
                aria-label={t("mars.rovers.lightbox.close")}>✕</button>
              {flat.length > 1 && (
                <>
                  <button className="photo-modal-nav prev"
                    onClick={() => setModalIdx((i) => (i - 1 + flat.length) % flat.length)}
                    aria-label={t("mars.rovers.lightbox.prev")}>‹</button>
                  <button className="photo-modal-nav next"
                    onClick={() => setModalIdx((i) => (i + 1) % flat.length)}
                    aria-label={t("mars.rovers.lightbox.next")}>›</button>
                </>
              )}
            </div>
            <div className="photo-modal-info">
              <div className="cat">{modal.rover || "—"} · {modal.camera || "—"}</div>
              <h3>{modal.camera || modal.rover || "—"}</h3>
              <div className="d">{t("mars.rovers.solN", { n: modal.sol })} · {modal.earth_date || "—"}</div>
              <p>{t("mars.rovers.lightbox.desc", { rover: modal.rover || "—" })}</p>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.camera")}</span><span className="val">{modal.camera || "—"}</span></div>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.rover")}</span><span className="val">{modal.rover || "—"}</span></div>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.date")}</span><span className="val">{modal.earth_date || "—"}</span></div>
              <a className="section-link" style={{ marginTop: "auto", paddingTop: 18 }}
                href={modal.img_src} target="_blank" rel="noopener noreferrer">
                {t("mars.rovers.lightbox.openFull")} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}