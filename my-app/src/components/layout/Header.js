// Sticky site header: logo, grouped nav (single links + dropdown groups),
// language switcher, CTA button, and a mobile burger that toggles the dropdown
// panel. (index.html header.site, reworked into compact grouped submenus.)
import { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_GROUPS, BOT_URL } from "../../lib/constants";
import { useLang } from "../../context/LanguageContext";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { lang, setLang } = useLang();

  // A dropdown group is "active" (gold trigger) when any of its items matches.
  const groupActive = (items) => items.some((l) => pathname === l.to || pathname.startsWith(l.to + "/"));

  const closeMobile = () => { setOpen(false); setOpenGroup(null); };

  const LangBtn = ({ code }) => (
    <button
      type="button"
      className={"lang-btn " + code + (lang === code ? " active" : "")}
      onClick={() => setLang(code)}
      aria-pressed={lang === code}
      title={code === "uk" ? "Українська" : "English"}
    >
      {code === "uk" ? "UK" : "EN"}
    </button>
  );

  return (
    <header className="site">
      <div className="wrap nav">
        <Link to="/" className="logo" onClick={closeMobile}>
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
                  <NavLink key={l.to} to={l.to} end={l.end}
                    className={({ isActive }) => isActive ? "active" : ""}>
                    {t(l.labelKey)}
                  </NavLink>
                ))}
              </div>
            </div>
          ) : (
            <NavLink key={g.to} to={g.to} end={g.end}
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
        <button className="burger" aria-label={t("header.menu")} aria-expanded={open}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); setOpenGroup(null); }}>☰</button>
      </div>
    </header>
  );
}