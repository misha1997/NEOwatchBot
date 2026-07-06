// Section heading: eyebrow + title on the left, optional link on the right.
import { Link } from "react-router-dom";
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
          ? <Link to={linkTo} className="section-link">{linkLabel}</Link>
          : <a href={linkHref || "#"} className="section-link">{linkLabel}</a>
      )}
    </div>
  );
}