// Section heading: eyebrow + title on the left, optional link on the right.
// `linkTo` is an i18n route name resolved to a language-prefixed path.
import LocalizedLink from "./LocalizedLink";
import Eyebrow from "./Eyebrow";

export default function SectionHead({ eyebrow, gold, title, linkTo, linkHref, linkLabel, sub }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <Eyebrow gold={gold}>{eyebrow}</Eyebrow>}
        {title && <h2 className="section-title">{title}</h2>}
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {linkLabel && (
        linkTo
          ? <LocalizedLink to={linkTo} className="section-link">{linkLabel}</LocalizedLink>
          : <a href={linkHref || "#"} className="section-link">{linkLabel}</a>
      )}
    </div>
  );
}