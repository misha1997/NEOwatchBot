// Location pill — shows the observer city with "Змінити" + "Знайти мене".
// "Змінити" opens the picker modal; "Знайти мене" fires geolocation directly
// (no modal) and only falls back to the modal on a detection failure.
import { useTranslation } from "react-i18next";
import { useLoc } from "../context/LocationContext";
import { usePicker } from "./LocationPickerModal";

export default function LocationPill() {
  const { t } = useTranslation();
  const { loc } = useLoc();
  const { openPicker, requestDetect } = usePicker();
  const city = loc && loc.label ? loc.label : t("loc.default");
  return (
    <div className="loc-pill">
      <span className="pin"></span>
      {" "}{city}{" "}
      <a href="#" className="chg" onClick={(e) => { e.preventDefault(); openPicker(); }}>{t("picker.change")}</a>
      <a href="#" className="detect"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); requestDetect(); }}>
        📍 {t("picker.detect")}
      </a>
    </div>
  );
}