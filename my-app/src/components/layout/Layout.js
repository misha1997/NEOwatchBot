// App shell: starfield background, sticky header, routed page, footer.
import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Starfield from "../Starfield";

export default function Layout() {
  const { pathname } = useLocation();
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
    </>
  );
}