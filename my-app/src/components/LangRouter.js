// Resolves a /:lang/<rest> URL to the right page component.
//
// The server (web/seo.py + web/app.py) already 301-redirects legacy unprefixed
// URLs and returns per-route meta + a real 404 for unknown slugs. This router
// runs only for /ua/... and /en/... paths: it maps the slug to the page by
// i18n name (via lib/seo.js nameFromPath), handles the news-article sub-route,
// and lazy-loads the page so heavy bundles (Leaflet/Chart.js/satellite.js)
// stay split per route.
import { useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { nameFromPath } from "../lib/seo";
import NotFound from "../pages/NotFound";

const Home = lazy(() => import("../pages/Home"));
const Weather = lazy(() => import("../pages/Weather"));
const Iss = lazy(() => import("../pages/Iss"));
const Satellites = lazy(() => import("../pages/Satellites"));
const Sky = lazy(() => import("../pages/Sky"));
const Meteors = lazy(() => import("../pages/Meteors"));
const Asteroids = lazy(() => import("../pages/Asteroids"));
const Events = lazy(() => import("../pages/Events"));
const Launches = lazy(() => import("../pages/Launches"));
const Deep = lazy(() => import("../pages/Deep"));
const Voyager = lazy(() => import("../pages/Voyager"));
const Comets = lazy(() => import("../pages/Comets"));
const Exoplanets = lazy(() => import("../pages/Exoplanets"));
const Constellations = lazy(() => import("../pages/Constellations"));
const Mast = lazy(() => import("../pages/Mast"));
const Gallery = lazy(() => import("../pages/Gallery"));
const Planetarium = lazy(() => import("../pages/Planetarium"));
const Mars = lazy(() => import("../pages/Mars"));
const Jupiter = lazy(() => import("../pages/Jupiter"));
const News = lazy(() => import("../pages/News"));
const NewsArticle = lazy(() => import("../pages/NewsArticle"));

const PAGES = {
  home: Home,
  weather: Weather,
  iss: Iss,
  satellites: Satellites,
  sky: Sky,
  meteors: Meteors,
  asteroids: Asteroids,
  events: Events,
  launches: Launches,
  deep: Deep,
  voyager: Voyager,
  comets: Comets,
  exoplanets: Exoplanets,
  constellations: Constellations,
  mast: Mast,
  gallery: Gallery,
  planetarium: Planetarium,
  mars: Mars,
  jupiter: Jupiter,
  news: News,
};

function Loading() {
  return <div style={{ height: "60vh" }} />;
}

export default function LangRouter() {
  const { lang, "*": rest } = useParams();
  const resolved = nameFromPath(`/${lang || ""}/${rest || ""}`);

  if (resolved.name === "404") {
    return <NotFound />;
  }
  if (resolved.name === "news" && resolved.articleSlug) {
    return (
      <Suspense fallback={<Loading />}>
        <NewsArticle slug={resolved.articleSlug} />
      </Suspense>
    );
  }
  const Page = PAGES[resolved.name];
  if (!Page) return <NotFound />;
  return (
    <Suspense fallback={<Loading />}>
      <Page />
    </Suspense>
  );
}