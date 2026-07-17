// react-router <Link> that resolves an i18n route name to a language-prefixed
// path. Use it instead of <Link to="/iss"> so the same code serves both /ua/
// and /en/. `to` may be:
//   - an i18n route name ("iss", "sky", "home") → resolves to /{prefix}/{slug};
//   - an already-built absolute path ("/ua/news/slug") → used as-is (so dynamic
//     routes like news articles can pass a pre-built path).
// Reads the active language from LanguageContext (the URL prefix).
import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import { pathFor } from "../../lib/seo";

export default function LocalizedLink({ to, ...rest }) {
  const { lang } = useLang();
  const target = to && typeof to === "string" && to.startsWith("/")
    ? to
    : pathFor(to, lang);
  return <Link to={target} {...rest} />;
}