// SPA routes — one per legacy HTML page. Lazy-loaded so the heavy Leaflet /
// Chart.js / satellite.js bundles only download on the pages that need them.
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
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
const RtlSdr = lazy(() => import("./pages/RtlSdr"));
const Community = lazy(() => import("./pages/Community"));

function Loading() {
  return <div style={{ height: "60vh" }} />;
}

export default function App() {
  return (
    <BrowserRouter>
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
                <Route path="/rtl-sdr" element={<RtlSdr />} />
                <Route path="/community" element={<Community />} />
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