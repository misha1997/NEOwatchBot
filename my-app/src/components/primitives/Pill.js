// Status pill (.pill / .pill.gold / .pill.teal / .pill.coral).
export default function Pill({ className = "", children, ...p }) {
  return <span className={"pill " + className} {...p}>{children}</span>;
}