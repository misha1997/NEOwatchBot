// Section eyebrow label (.eyebrow / .eyebrow.gold).
export default function Eyebrow({ gold, children }) {
  return <div className={"eyebrow" + (gold ? " gold" : "")}>{children}</div>;
}