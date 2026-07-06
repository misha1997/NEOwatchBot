// Homepage launches table (index.html #launches-body). Port of renderLaunchesTable.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getLaunches } from "../../lib/api";
import { launchPillClass } from "../../lib/constants";

export default function LaunchesTable() {
  const { t } = useTranslation();
  const { data } = useApi(getLaunches);
  const placeholders = [
    { date: "05.07 · 17:31", name: "Crew-11", rocket: "Falcon 9 Block 5", pad: t("launches.ph.pad1"), country: t("launches.country.usa"), status_label: "Go", status_class: "gold" },
    { date: "07.07 · 11:12", name: "Starlink Group 12-8", rocket: "Falcon 9 Block 5", pad: t("launches.ph.pad2"), country: t("launches.country.usa"), status_label: "Go", status_class: "gold" },
    { date: "10.07 · 00:00", name: "Galileo L13", rocket: "Ariane 6", pad: t("launches.ph.pad3"), country: t("launches.country.eu"), status_label: "TBD", status_class: "" },
    { date: "12.07 · 06:45", name: "BlackSky Gen-3", rocket: "Electron", pad: t("launches.ph.pad4"), country: t("launches.country.nz"), status_label: "Go", status_class: "gold" },
    { date: "15.07 · 19:20", name: "Shijian-26", rocket: "Long March 3B", pad: t("launches.ph.pad5"), country: t("launches.country.cn"), status_label: "TBD", status_class: "" },
  ];
  const items = (data && data.items) || placeholders;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>{t("launches.col.date")}</th>
            <th>{t("launches.col.mission")}</th>
            <th>{t("launches.col.rocket")}</th>
            <th>{t("launches.col.pad")}</th>
            <th>{t("launches.col.country")}</th>
            <th style={{ textAlign: "right" }}>{t("launches.col.status")}</th>
          </tr>
        </thead>
        <tbody id="launches-body">
          {items.map((l, i) => (
            <tr key={i}>
              <td className="mono-accent">{l.date}</td>
              <td>{l.name}</td>
              <td>{l.rocket}</td>
              <td>{l.pad}</td>
              <td>{l.country || ""}</td>
              <td style={{ textAlign: "right" }}>
                <span className={launchPillClass(l)}>{l.status_label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}