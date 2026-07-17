// Sticky site header: logo, grouped nav (single links + dropdown groups),
// language switcher, CTA button, and a mobile burger that toggles the dropdown
// panel. (index.html header.site, reworked into compact grouped submenus.)
import { useState, useEffect } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_GROUPS, BOT_URL } from "../../lib/constants";
import { useLang } from "../../context/LanguageContext";
import { pathFor, switchLangPath } from "../../lib/seo";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { lang } = useLang();

  // Path for a nav entry by i18n name, in the active language.
  const to = (name) => pathFor(name, lang);

  // A dropdown group is "active" (gold trigger) when any of its items matches.
  const groupActive = (items) => items.some((l) => {
    if (l.disabled) return false;
    const p = to(l.name);
    return pathname === p || pathname.startsWith(p + "/");
  });

  const closeMobile = () => { setOpen(false); setOpenGroup(null); };

  // Close the mobile menu on route change.
  useEffect(() => { closeMobile(); }, [pathname]);

  // Close on Escape and on any click outside the header while the burger
  // panel is open. The burger button stops propagation on its own click, and
  // link taps inside the panel close via the nav onClick below.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") closeMobile(); };
    const onDocClick = (e) => { if (!e.target.closest("header.site")) closeMobile(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
    };
  }, [open]);

  // Language switcher: navigate to the same content in the other language.
  // The URL is the source of truth; Layout's effect then syncs localStorage +
  // i18next to the new prefix. (setLang alone doesn't change the URL.)
  const switchLang = (code) => navigate(switchLangPath(pathname, code));

  const LangBtn = ({ code }) => (
    <button
      type="button"
      className={"lang-btn " + code + (lang === code ? " active" : "")}
      onClick={() => switchLang(code)}
      aria-pressed={lang === code}
      title={code === "uk" ? "Українська" : "English"}
    >
      {code === "uk" ? "UK" : "EN"}
    </button>
  );

  return (
    <header className="site">
      <div className="wrap nav">
        <Link to={to("home")} className="logo" onClick={closeMobile}>
          <img className="logo-img" src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
          <span>OrbitLight<small>{t("header.tagline")}</small></span>
        </Link>
        <nav className={"links" + (open ? " open" : "")} onClick={(e) => {
          // Close the mobile panel when a leaf link is tapped.
          if (e.target.tagName === "A") closeMobile();
        }}>
          {NAV_GROUPS.map((g) => g.items ? (
            <div
              key={g.labelKey}
              className={"nav-group" + (openGroup === g.labelKey ? " open" : "") + (groupActive(g.items) ? " active" : "")}
              onClick={(e) => {
                // Toggle this group on trigger click; ignore clicks on the
                // open dropdown itself (links handle their own close above).
                if (e.target.closest(".nav-trigger")) {
                  e.stopPropagation();
                  setOpenGroup((cur) => (cur === g.labelKey ? null : g.labelKey));
                }
              }}
            >
              <button type="button" className="nav-trigger" aria-expanded={openGroup === g.labelKey}>
                {t(g.labelKey)}<span className="caret">▾</span>
              </button>
              <div className="nav-dropdown">
                {g.items.map((l) => (
                  l.disabled ? (
                    <span key={l.name} className="nav-link disabled" aria-disabled="true">
                      {t(l.labelKey)} <small className="soon">{t("nav.soon")}</small>
                    </span>
                  ) : (
                    <NavLink key={l.name} to={to(l.name)} end={l.end}
                      className={({ isActive }) => isActive ? "active" : ""}>
                      {t(l.labelKey)}
                    </NavLink>
                  )
                ))}
              </div>
            </div>
          ) : (
            <NavLink key={g.name} to={to(g.name)} end={g.end}
              className={({ isActive }) => isActive ? "active" : ""}>
              {t(g.labelKey)}
            </NavLink>
          ))}
          <span className="lang-switch" role="group" aria-label="Language">
            <LangBtn code="uk" />
            <LangBtn code="en" />
          </span>
          <a href={BOT_URL} className="cta-btn" target="_blank" rel="noreferrer">{t("header.openBot")}</a>
        </nav>
        <button className={"burger" + (open ? " open" : "")} aria-label={t("header.menu")} aria-expanded={open}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); setOpenGroup(null); }}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
  );
}