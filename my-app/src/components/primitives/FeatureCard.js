// Grid link card (.fcard) used by the homepage "Досліджуй усе небо" section.
// `to` is an i18n route name (e.g. "iss") resolved to a language-prefixed path
// by LocalizedLink.
import LocalizedLink from "./LocalizedLink";
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
  return <LocalizedLink to={to} className="fcard">{inner}</LocalizedLink>;
}