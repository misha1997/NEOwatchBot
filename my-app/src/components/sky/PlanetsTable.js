// Visible-planets table (sky.html #planets-table). Port of app.js loadPlanets.
// Static placeholder rows (verbatim) shown until /api/planets resolves.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLoc } from "../../context/LocationContext";
import { getPlanets } from "../../lib/api";

export default function PlanetsTable({ lang }) {
  const { t } = useTranslation();
  const { loc } = useLoc();
  const { data } = useApi(() => getPlanets(loc, lang), { deps: [loc && loc.lat, loc && loc.lon, lang] });

  // Placeholder rows shown until /api/planets resolves. Built inside the
  // component so they can use t(...).
  const PLACEHOLDER_ROWS = [
    { emoji: "♀", name: t("sky.planets.ph.venus"), vis: t("sky.planets.ph.venusVis"), best: t("sky.planets.ph.venusBest") },
    { emoji: "♂", name: t("sky.planets.ph.mars"), vis: t("sky.planets.ph.marsVis"), best: t("sky.planets.ph.marsBest") },
    { emoji: "♃", name: t("sky.planets.ph.jupiter"), vis: t("sky.planets.ph.jupiterVis"), best: t("sky.planets.ph.allNight") },
    { emoji: "♄", name: t("sky.planets.ph.saturn"), vis: t("sky.planets.ph.saturnVis"), best: t("sky.planets.ph.allNight") },
  ];

  const items = data && data.items;
  const rows = items
    ? items.map((p) => ({
        emoji: p.emoji, name: p.name,
        vis: p.visible ? t("sky.planets.visible", { alt: p.alt, az: p.az_dir }) : t("sky.planets.belowHorizon"),
        best: p.visible ? t("sky.planets.visibleNow") : "—",
      }))
    : PLACEHOLDER_ROWS;
  return (
    <table className="data">
      <thead>
        <tr>
          <th>{t("sky.planets.col_planet")}</th>
          <th>{t("sky.planets.col_vis")}</th>
          <th style={{ textAlign: "right" }}>{t("sky.planets.col_best")}</th>
        </tr>
      </thead>
      <tbody id="planets-table">
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.emoji} {r.name}</td>
            <td style={{ color: "var(--text-dim)" }}>{r.vis}</td>
            <td style={{ textAlign: "right" }} className="mono-accent">{r.best}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}