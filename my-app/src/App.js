// SPA routes — one per legacy HTML page. Lazy-loaded so the heavy Leaflet /
// Chart.js / satellite.js bundles only download on the pages that need them.
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { LocationProvider } from "./context/LocationContext";
import { LanguageProvider } from "./context/LanguageContext";
import { PickerProvider } from "./components/LocationPickerModal";
import Layout from "./components/layout/Layout";
import NotFound from "./pages/NotFound";

const Home = lazy(() => import("./pages/Home"));
const Weather = lazy(() => import("./pages/Weather"));
const Iss = lazy(() => import("./pages/Iss"));
const Satellites = lazy(() => import("./pages/Satellites"));
const Sky = lazy(() => import("./pages/Sky"));
const Meteors = lazy(() => import("./pages/Meteors"));
const Asteroids = lazy(() => import("./pages/Asteroids"));
const Events = lazy(() => import("./pages/Events"));
const Launches = lazy(() => import("./pages/Launches"));
const Deep = lazy(() => import("./pages/Deep"));
const Voyager = lazy(() => import("./pages/Voyager"));
const Comets = lazy(() => import("./pages/Comets"));
const Exoplanets = lazy(() => import("./pages/Exoplanets"));
const Constellations = lazy(() => import("./pages/Constellations"));
const Mast = lazy(() => import("./pages/Mast"));
const Gallery = lazy(() => import("./pages/Gallery"));
// RtlSdr / Community pages are kept on disk but currently unlinked — their
// routes are disabled. Re-add the lazy imports + <Route>s below to restore.

function Loading() {
  return <div style={{ height: "60vh" }} />;
}

// GA4 pageview on every SPA route change. The gtag() snippet in
// public/index.html fires the initial pageview; this sends the rest so
// client-side navigations (e.g. / -> /iss) are tracked too.
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search + location.hash,
    });
  }, [location.pathname, location.search, location.hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteTracker />
      <LanguageProvider>
      <LocationProvider>
        <PickerProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/iss" element={<Iss />} />
                <Route path="/satellites" element={<Satellites />} />
                <Route path="/weather" element={<Weather />} />
                <Route path="/sky" element={<Sky />} />
                <Route path="/meteors" element={<Meteors />} />
                <Route path="/asteroids" element={<Asteroids />} />
                <Route path="/events" element={<Events />} />
                <Route path="/launches" element={<Launches />} />
                <Route path="/deep" element={<Deep />} />
                <Route path="/voyager" element={<Voyager />} />
                <Route path="/comets" element={<Comets />} />
                <Route path="/exoplanets" element={<Exoplanets />} />
                <Route path="/constellations" element={<Constellations />} />
                <Route path="/mast" element={<Mast />} />
                <Route path="/gallery" element={<Gallery />} />
                {/* RtlSdr (/rtl-sdr) and Community (/community) routes disabled —
                    pages kept on disk but unlinked. Re-enable above to restore. */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </PickerProvider>
      </LocationProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}