// Homepage "Досліджуй усе небо" — port of the orbit-light SectionsGrid.
// A responsive grid of section tiles (icon + title + arrow + description),
// each linking to its language-prefixed page via LocalizedLink.
import { useTranslation } from "react-i18next";
import LocalizedLink from "../primitives/LocalizedLink";
import { HOME_SECTIONS } from "../../lib/homeSections";

export default function SectionsGrid() {
  const { t } = useTranslation();
  return (
    <ul className="sections-grid">
      {HOME_SECTIONS.map((s) => (
        <li key={s.to}>
          <LocalizedLink to={s.to} className="section-tile">
            <span className="st-ic">{s.icon}</span>
            <span className="st-body">
              <span className="st-title">
                {t(s.titleKey)}
                <span className="st-arrow" aria-hidden="true">→</span>
              </span>
              <span className="st-desc">{t(s.descKey)}</span>
            </span>
          </LocalizedLink>
        </li>
      ))}
    </ul>
  );
}