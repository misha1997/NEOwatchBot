// Bilingual path-prefix routing: /ua/... and /en/...
//
// Every page lives under a language prefix. A single /:lang/* route hands off
// to <LangRouter>, which maps the slug to the page by i18n name (translated
// slugs per language). The unprefixed "*" route is a client-side fallback for
// direct hits the server didn't already 301-redirect (legacy URLs are
// redirected server-side in web/app.py before the SPA loads). See lib/seo.js
// for the slug map (mirrors web/seo.py).
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { LocationProvider } from "./context/LocationContext";
import { LanguageProvider } from "./context/LanguageContext";
import { PickerProvider } from "./components/LocationPickerModal";
import Layout from "./components/layout/Layout";
import LangRouter from "./components/LangRouter";
import NotFound from "./pages/NotFound";

// GA4 pageview on every SPA route change. The gtag() snippet in
// public/index.html fires the initial pageview; this sends the rest so
// client-side navigations (e.g. /ua/ -> /ua/mks) are tracked too.
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
            <Routes>
              <Route element={<Layout />}>
                <Route path="/:lang/*" element={<LangRouter />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </PickerProvider>
        </LocationProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}