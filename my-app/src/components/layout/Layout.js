// App shell: starfield background, sticky header, routed page, footer.
import { Outlet, useLocation, useParams } from "react-router-dom";
import { useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Starfield from "../Starfield";
import CookieBanner from "../CookieBanner";
import { useSeo } from "../../hooks/useSeo";
import { useLang } from "../../context/LanguageContext";
import { PREFIX_TO_LANG } from "../../lib/seo";

export default function Layout() {
  const { pathname } = useLocation();
  const { lang: urlPrefix } = useParams();
  const { setLang } = useLang();
  // The URL prefix ("ua"|"en") → internal lang code ("uk"|"en"). setLang only
  // updates state + localStorage + i18next (no navigation), keeping the rendered
  // language consistent with the URL a user landed on and with the
  // server-injected <html lang>.
  const urlLang = PREFIX_TO_LANG[urlPrefix];
  useEffect(() => {
    if (urlLang) setLang(urlLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLang]);
  // Reset scroll on navigation (static pages always start at the top).
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <>
      <Starfield />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
    </>
  );
}