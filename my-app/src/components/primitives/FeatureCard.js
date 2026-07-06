// Grid link card (.fcard) used by the homepage "Досліджуй усе небо" section.
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function FeatureCard({ to, href, icon, title, children }) {
  const { t } = useTranslation();
  const inner = (
    <>
      <div className="ic">{icon}</div>
      <h4>{title}</h4>
      <p>{children}</p>
      <span className="go">{t("common.open")}</span>
    </>
  );
  if (href) return <a href={href} className="fcard">{inner}</a>;
  return <Link to={to} className="fcard">{inner}</Link>;
}