// Segmented countdown clock (.clock .seg). `units` = "dhm" (launch cards) or
// "dhms" (next-launch hero). Driven by useCountdown so it ticks once a second.
import { useTranslation } from "react-i18next";
import { useCountdown } from "../hooks/useCountdown";

function Seg({ n, u }) {
  return (
    <div className="seg">
      <div className="n">{n}</div>
      <span className="u">{u}</span>
    </div>
  );
}

export default function Countdown({ ts, units = "dhm" }) {
  const { t } = useTranslation();
  const { d, h, m, s, pad2 } = useCountdown(ts);
  return (
    <div className="clock" data-units={units}>
      <Seg n={pad2(d)} u={t("common.units.days")} />
      <Seg n={pad2(h)} u={t("common.units.hrs")} />
      <Seg n={pad2(m)} u={t("common.units.min")} />
      {units === "dhms" && <Seg n={pad2(s)} u={t("common.units.sec")} />}
    </div>
  );
}