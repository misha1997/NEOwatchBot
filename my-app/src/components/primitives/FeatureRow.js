// Numbered feature row (.feat-row) used by several pages' "how-to" sections.
// tag → small mono label (e.g. "01 МІСЦЕ"); title → h4; children → description.
import { Link } from "react-router-dom";
export default function FeatureRow({ tag, title, num, children, to, href }) {
  const inner = (
    <>
      <div>
        {tag && <div className="tag">{tag}</div>}
        <h4>{title}</h4>
        <p>{children}</p>
      </div>
      {num != null && <div className="num">{num}</div>}
    </>
  );
  if (to) return <Link to={to} className="feat-row">{inner}</Link>;
  if (href) return <a href={href} className="feat-row">{inner}</a>;
  return <div className="feat-row">{inner}</div>;
}