import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { getMastLightcurve, getMastHubbleJwst, getExoplanets } from "../lib/api";
import ChartCanvas from "../components/charts/ChartCanvas";
import "../styles/mast.css";

export default function Mast() {
  const { t } = useTranslation();
  const { lang } = useLang();

  // State
  const [transits, setTransits] = useState([]);
  const [selectedTransit, setSelectedTransit] = useState(null);
  const [customLightCurve, setCustomLightCurve] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [obsList, setObsList] = useState([]);
  const [loadingObs, setLoadingObs] = useState(true);
  const [toiCandidates, setToiCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [activeFfiImage, setActiveFfiImage] = useState(null);

  // Load pre-calculated famous transits on mount
  useEffect(() => {
    fetch("/data/famous_transits.json")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load famous transits");
        return r.json();
      })
      .then((data) => {
        setTransits(data);
        if (data.length > 0) {
          setSelectedTransit(data[0]);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  // Load Hubble/JWST observations on mount
  useEffect(() => {
    setLoadingObs(true);
    getMastHubbleJwst()
      .then((data) => {
        if (Array.isArray(data)) {
          setObsList(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load Hubble/JWST observations:", err);
      })
      .finally(() => {
        setLoadingObs(false);
      });
  }, []);

  // Load TOI candidates on mount
  useEffect(() => {
    setLoadingCandidates(true);
    getExoplanets()
      .then((data) => {
        if (data && Array.isArray(data.candidates) && data.candidates.length > 0) {
          setToiCandidates(data.candidates.slice(0, 8));
        } else {
          setToiCandidates([
            { name: "TOI-700.01", radius: 1.19, period: 37.4, distance_ly: 101, confirmed: true },
            { name: "TOI-1452.01", radius: 1.67, period: 11.06, distance_ly: 100, confirmed: true },
            { name: "TOI-6002.01", radius: 2.30, period: 15.2, distance_ly: 310, confirmed: false },
            { name: "TOI-7145.01", radius: 1.40, period: 6.8, distance_ly: 190, confirmed: false }
          ]);
        }
      })
      .catch((err) => {
        console.error("Failed to load TOI candidates:", err);
        setToiCandidates([
          { name: "TOI-700.01", radius: 1.19, period: 37.4, distance_ly: 101, confirmed: true },
          { name: "TOI-1452.01", radius: 1.67, period: 11.06, distance_ly: 100, confirmed: true },
          { name: "TOI-6002.01", radius: 2.30, period: 15.2, distance_ly: 310, confirmed: false },
          { name: "TOI-7145.01", radius: 1.40, period: 6.8, distance_ly: 190, confirmed: false }
        ]);
      })
      .finally(() => {
        setLoadingCandidates(false);
      });
  }, []);

  // Determine active light curve data to display in the chart
  const activeData = useMemo(() => {
    if (customLightCurve) {
      return customLightCurve;
    }
    return selectedTransit;
  }, [customLightCurve, selectedTransit]);

  // Chart configuration factory
  const chartFactory = () => {
    if (!activeData || !activeData.time || !activeData.flux) return null;

    const isCustom = !!customLightCurve;
    const chartLabel = isCustom
      ? `${activeData.label} (${activeData.mission} ${activeData.sector ? `Sector ${activeData.sector}` : ""})`
      : activeData.name;

    return {
      type: "line",
      data: {
        labels: activeData.time.map((t) => t.toFixed(4)),
        datasets: [
          {
            label: chartLabel,
            data: activeData.flux,
            borderColor: isCustom ? "#E8B94D" : "#4FD1C5", // gold for custom query, teal for transit
            borderWidth: 1.5,
            pointRadius: isCustom ? 1 : 0, // tiny dots for custom live data, line for transit
            pointBackgroundColor: isCustom ? "#E8B94D" : undefined,
            fill: false,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 400,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              boxWidth: 14,
              font: {
                family: "ui-monospace, 'JetBrains Mono', monospace",
                size: 11,
              },
            },
          },
          tooltip: {
            mode: "index",
            intersect: false,
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            title: {
              display: true,
              text: isCustom ? "Час (BTJD / BJD) / Time" : "Час від центру транзиту (дні) / Phase Time (days)",
              color: "#8B90AC",
            },
          },
          y: {
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            title: {
              display: true,
              text: "Нормалізована яскравість / Normalized Flux",
              color: "#8B90AC",
            },
          },
        },
      },
    };
  };

  // Perform live search for star / TIC ID in MAST using lightkurve backend
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getMastLightcurve(searchQuery);
      if (data && data.time && data.time.length > 0) {
        setCustomLightCurve(data);
        setSelectedTransit(null);
      } else {
        setError(
          lang === "uk"
            ? "Зорю не знайдено або в архіві MAST немає побудованих кривих блиску для цього об'єкта."
            : "Star not found, or there are no pre-processed light curves in MAST for this target."
        );
      }
    } catch (err) {
      console.error(err);
      setError(
        lang === "uk"
          ? "Помилка зв'язку з MAST. Будь ласка, перевірте правильність TIC ID / назви та спробуйте ще раз."
          : "Connection failed. Please verify the target name or TIC ID and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Click handler to select and plot one of the showcase transits
  const handleSelectTransit = (t) => {
    setSelectedTransit(t);
    setCustomLightCurve(null);
    setError(null);
  };

  const handleViewToi = async (e, candidateName) => {
    e.preventDefault();
    const resolvedStarName = candidateName.split(".")[0].replace("-", " ");
    setSearchQuery(resolvedStarName);
    setLoading(true);
    setError(null);

    try {
      const data = await getMastLightcurve(resolvedStarName);
      if (data && data.time && data.time.length > 0) {
        setCustomLightCurve(data);
        setSelectedTransit(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(
          lang === "uk"
            ? `Не вдалося отримати криву для ${candidateName} з MAST.`
            : `Could not retrieve light curve for ${candidateName} from MAST.`
        );
      }
    } catch (err) {
      setError(
        lang === "uk"
          ? "Помилка при запиті кривої TOI кандидата."
          : "Error querying TOI candidate curve."
      );
    } finally {
      setLoading(false);
    }
  };

  // Sparkline builder helper
  const getSparklinePoints = (flux) => {
    if (!flux || flux.length === 0) return "";
    const min = Math.min(...flux);
    const max = Math.max(...flux);
    const range = max - min || 1;

    return flux
      .map((v, i) => {
        const x = (i / (flux.length - 1)) * 148 + 6;
        const y = 54 - ((v - min) / range) * 44; // y fits nicely inside the sparkbox
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow">MAST · Mikulski Archive for Space Telescopes</div>
            <h1 className="hero-title">
              {lang === "uk" ? "Побач криву блиску" : "Explore the light curves"}
              <br />
              <span className="accent">{lang === "uk" ? "будь-якої зорі" : "of any star"}</span>
            </h1>
            <p className="hero-sub">
              {lang === "uk"
                ? "MAST — це сховище сирих і оброблених даних телескопів Kepler, K2, TESS, Hubble та JWST. Наш бекенд звертається до архівів під капотом за допомогою Python-бібліотек lightkurve та astroquery."
                : "MAST is the primary archive for Kepler, K2, TESS, Hubble, and JWST. Our backend queries the archive in real-time using lightkurve and astroquery Python modules."}
            </p>
            <form onSubmit={handleSearch} className="star-search">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "uk" ? "Назва зорі або TIC ID (напр. TIC 307210830)" : "Star name or TIC ID (e.g. TIC 307210830)"}
                disabled={loading}
              />
              <button type="submit" className="btn primary" disabled={loading}>
                {loading ? t("common.loading", "Завантаження…") : (lang === "uk" ? "Побудувати графік" : "Plot curve")}
              </button>
            </form>
          </div>

          {/* Main Chart Area */}
          <div className="lc-wrap">
            {loading ? (
              <div className="spinner-wrap">
                <div className="spinner"></div>
                <div className="chart-subtitle">{lang === "uk" ? "Запит до архівів MAST..." : "Querying MAST archives..."}</div>
              </div>
            ) : error ? (
              <div className="chart-error">
                <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>⚠️</span>
                {error}
              </div>
            ) : activeData ? (
              <>
                <div className="chart-header">
                  <div className="chart-title">
                    {customLightCurve ? activeData.label : activeData.name}
                  </div>
                  <div className="chart-subtitle">
                    {customLightCurve
                      ? `${activeData.mission} | Sector ${activeData.sector || "N/A"}`
                      : (lang === "uk" ? `Підтверджений транзит (${activeData.type})` : `Confirmed transit (${activeData.type})`)}
                  </div>
                </div>
                <div style={{ height: "200px", position: "relative" }}>
                  <ChartCanvas factory={chartFactory} deps={[activeData]} />
                </div>
              </>
            ) : (
              <div className="chart-subtitle" style={{ textAlign: "center" }}>
                {lang === "uk" ? "Оберіть планету або введіть назву зорі" : "Select a planet or search for a star"}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Famous Transits Showcase */}
      <section className="section" id="famous" style={{ paddingTop: "8px" }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{lang === "uk" ? "Вітрина" : "Showcase"}</div>
            <h2 className="section-title">{lang === "uk" ? "Знамениті транзити" : "Famous Transits"}</h2>
          </div>
        </div>

        <div className="transit-grid">
          {transits.map((t) => {
            const isActive = !customLightCurve && selectedTransit?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() => handleSelectTransit(t)}
                className={`transit-card ${isActive ? "active" : ""}`}
              >
                <h4>{t.name}</h4>
                <div className="spark">
                  <svg viewBox="0 0 160 64" xmlns="http://www.w3.org/2000/svg">
                    <polyline
                      points={getSparklinePoints(t.flux)}
                      fill="none"
                      stroke={isActive ? "var(--gold)" : "var(--teal)"}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="stats">
                  <span>{lang === "uk" ? `Період ${t.period} д` : `Period ${t.period} d`}</span>
                  <span>{t.radius}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Transit Details (Showcase only) */}
        {!customLightCurve && selectedTransit && (
          <div className="transit-details">
            <div className="transit-details-info">
              <h3>{selectedTransit.name}</h3>
              <div className="pill teal" style={{ display: "inline-block", width: "max-content", marginBottom: "8px" }}>
                {lang === "uk" ? selectedTransit.uk.type : selectedTransit.en.type}
              </div>
              <p className="desc">
                {lang === "uk" ? selectedTransit.uk.desc : selectedTransit.en.desc}
              </p>
            </div>
            <div className="transit-details-stats">
              <div className="transit-details-stat-box">
                <div className="lbl">{lang === "uk" ? "Орбітальний період" : "Orbital Period"}</div>
                <div className="val">{selectedTransit.period} {lang === "uk" ? "днів" : "days"}</div>
              </div>
              <div className="transit-details-stat-box">
                <div className="lbl">{lang === "uk" ? "Радіус планети" : "Planet Radius"}</div>
                <div className="val">{selectedTransit.radius}</div>
              </div>
              <div className="transit-details-stat-box">
                <div className="lbl">{lang === "uk" ? "Температура" : "Temperature"}</div>
                <div className="val">{selectedTransit.temp}</div>
              </div>
              <div className="transit-details-stat-box">
                <div className="lbl">{lang === "uk" ? "Метод відкриття" : "Discovery Method"}</div>
                <div className="val">{lang === "uk" ? "Транзитний" : "Transit"}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* TESS Full Frame Images Section */}
      <section className="section" id="ffi">
        <div className="section-head">
          <div>
            <div className="eyebrow">Full Frame Images</div>
            <h2 className="section-title">
              {lang === "uk" ? "Як небо бачив TESS" : "How TESS Saw the Sky"}
            </h2>
          </div>
        </div>
        <p className="section-sub">
          {lang === "uk"
            ? "TESS знімає не лише окремі зорі, а цілі кадри неба. Ось повнокадрові знімки (FFI) з останнього сектора спостережень — кожна камера охоплює велетенську ділянку небесної сфери."
            : "TESS records full-frame images (FFIs) of entire fields of view. Here are previews from the latest observation sectors — each camera capturing a massive patch of the celestial dome."}
        </p>
        <div className="grid cols-4">
          <div className="ffi-tile" onClick={() => setActiveFfiImage({ src: "/data/ffi_cam1.jpg", title: lang === "uk" ? "Сектор 91 · камера 1" : "Sector 91 · Camera 1" })}>
            <img src="/data/ffi_cam1.jpg" alt="Camera 1" className="ffi-img" />
            <div className="info">{lang === "uk" ? "Сектор 91 · камера 1" : "Sector 91 · Camera 1"}</div>
          </div>
          <div className="ffi-tile" onClick={() => setActiveFfiImage({ src: "/data/ffi_cam2.jpg", title: lang === "uk" ? "Сектор 91 · камера 2" : "Sector 91 · Camera 2" })}>
            <img src="/data/ffi_cam2.jpg" alt="Camera 2" className="ffi-img" />
            <div className="info">{lang === "uk" ? "Сектор 91 · камера 2" : "Sector 91 · Camera 2"}</div>
          </div>
          <div className="ffi-tile" onClick={() => setActiveFfiImage({ src: "/data/ffi_cam3.jpg", title: lang === "uk" ? "Сектор 91 · камера 3" : "Sector 91 · Camera 3" })}>
            <img src="/data/ffi_cam3.jpg" alt="Camera 3" className="ffi-img" />
            <div className="info">{lang === "uk" ? "Сектор 91 · камера 3" : "Sector 91 · Camera 3"}</div>
          </div>
          <div className="ffi-tile" onClick={() => setActiveFfiImage({ src: "/data/ffi_cam4.jpg", title: lang === "uk" ? "Сектор 91 · камера 4" : "Sector 91 · Camera 4" })}>
            <img src="/data/ffi_cam4.jpg" alt="Camera 4" className="ffi-img" />
            <div className="info">{lang === "uk" ? "Сектор 91 · камера 4" : "Sector 91 · Camera 4"}</div>
          </div>
        </div>
      </section>

      {/* Recent Hubble & JWST Observations */}
      <section className="section" id="hubble-jwst" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Hubble & JWST</div>
            <h2 className="section-title">
              {lang === "uk" ? "Останні спостереження телескопів" : "Latest Space Telescope Targets"}
            </h2>
          </div>
        </div>
        <p className="section-sub">
          {lang === "uk"
            ? "Прямі наукові знімки з архіва MAST для відомих об'єктів глибокого космосу. Тільки перевірені та калібровані зображення з приладів ACS, WFC3 та NIRCam."
            : "Recent public science exposures fetched from MAST for prominent deep-space targets. Displays calibrated imaging from ACS, WFC3, and NIRCam instruments."}
        </p>

        {loadingObs ? (
          <div className="spinner-wrap" style={{ padding: "40px 0" }}>
            <div className="spinner"></div>
            <div className="chart-subtitle">{lang === "uk" ? "Завантаження спостережень..." : "Loading observations..."}</div>
          </div>
        ) : obsList.length === 0 ? (
          <div className="chart-subtitle" style={{ textAlign: "center", padding: "20px 0" }}>
            {lang === "uk" ? "Немає доступних спостережень." : "No recent observations found."}
          </div>
        ) : (
          <div className="obs-list-wrap">
            {obsList.map((obs, idx) => (
              <div key={idx} className="obs-row">
                <span className="inst">{obs.instrument}</span>
                <span className="target">{obs.target}</span>
                <span className="coord">{obs.coords}</span>
                <span className="date">{obs.date}</span>
                <span className="pill teal">{lang === "uk" ? "Каліброване" : "Calibrated"}</span>
                {obs.jpeg_url && (
                  <img
                    src={obs.jpeg_url}
                    alt={obs.target}
                    className="preview-img"
                    title={lang === "uk" ? "Переглянути у повному розмірі" : "View full size"}
                    onClick={() => setActiveFfiImage({ src: obs.jpeg_url, title: `${obs.target} (${obs.instrument})` })}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* TOI Live Catalog */}
      <section className="section" id="toi-catalog">
        <div className="section-head">
          <div>
            <div className="eyebrow">{lang === "uk" ? "Живий каталог" : "Live Catalog"}</div>
            <h2 className="section-title">
              {lang === "uk" ? "TOI-кандидати з переглядом кривої блиску" : "TOI Candidates Live Stream"}
            </h2>
          </div>
          <a href="/exoplanets" className="section-link">
            {lang === "uk" ? "Повний каталог →" : "Full Catalog →"}
          </a>
        </div>
        {loadingCandidates ? (
          <div className="spinner-wrap" style={{ padding: "40px 0" }}>
            <div className="spinner"></div>
            <div className="chart-subtitle">{lang === "uk" ? "Завантаження каталогу..." : "Loading catalog..."}</div>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>{lang === "uk" ? "Кандидат" : "Candidate"}</th>
                <th>{lang === "uk" ? "Радіус" : "Radius"}</th>
                <th>{lang === "uk" ? "Період" : "Period"}</th>
                <th>{lang === "uk" ? "Відстань" : "Distance"}</th>
                <th>{lang === "uk" ? "Статус" : "Status"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {toiCandidates.map((c, idx) => (
                <tr key={idx}>
                  <td>{c.name}</td>
                  <td className="mono">{c.radius ? `${c.radius} R⊕` : "—"}</td>
                  <td className="mono">{c.period ? `${c.period} ${lang === "uk" ? "д" : "d"}` : "—"}</td>
                  <td className="mono">{c.distance_ly ? `${c.distance_ly} ${lang === "uk" ? "св. р." : "ly"}` : "—"}</td>
                  <td>
                    <span className={`pill ${c.confirmed ? "teal" : "gold"}`}>
                      {c.confirmed
                        ? (lang === "uk" ? "Підтверджено" : "Confirmed")
                        : (lang === "uk" ? "Кандидат" : "Candidate")}
                    </span>
                  </td>
                  <td className="text-right">
                    <a
                      href="#"
                      onClick={(e) => handleViewToi(e, c.name)}
                      className="section-link"
                    >
                      {lang === "uk" ? "Переглянути криву →" : "View Curve →"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Lightbox Modal */}
      {activeFfiImage && (
        <div className="ffi-lightbox" onClick={() => setActiveFfiImage(null)}>
          <div className="ffi-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="ffi-lightbox-close" onClick={() => setActiveFfiImage(null)}>×</button>
            <img src={activeFfiImage.src} alt={activeFfiImage.title} />
            <div className="ffi-lightbox-title">{activeFfiImage.title}</div>
          </div>
        </div>
      )}
    </div>
  );
}
