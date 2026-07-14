// Solar-system planet registry for the Planetarium hub. One entry per planet,
// in order from the Sun. `labelKey`/`blurbKey` resolve via i18next so names and
// descriptions follow the active UI language; the numeric `facts` are
// language-neutral. `to` is the SPA route; `disabled` marks pages that aren't
// built yet (rendered as "soon" tiles instead of links).
//
// `grad` is the SVG radial-gradient stop triple [hi, mid, lo] (kept for any
// future per-planet page that wants a vector disc); `accent` is a
// representative CSS color. `img` is the planet photo served from
// /public/planets (square RGBA PNGs; Saturn's rings are in the image).
export const PLANETS = [
  {
    key: "mercury", labelKey: "nav.mercury", to: "/planetarium/mercury",
    disabled: true, accent: "#9C948B", img: "/planets/Mercury.png",
    grad: ["#C9C2BC", "#8C8A89", "#56534F"],
    facts: { dia: "4 879", day: "58.6", year: "88", gravity: "3.7", moons: "0", temp: "−53 °C" },
    blurbKey: "planetarium.blurbs.mercury",
  },
  {
    key: "venus", labelKey: "nav.venus", to: "/planetarium/venus",
    disabled: true, accent: "#E8C07A", img: "/planets/Venus.png",
    grad: ["#F3DDA0", "#E8C07A", "#A9763E"],
    facts: { dia: "12 104", day: "243", year: "225", gravity: "8.87", moons: "0", temp: "+464 °C" },
    blurbKey: "planetarium.blurbs.venus",
  },
  {
    key: "earth", labelKey: "nav.earth", to: "/planetarium/earth",
    disabled: true, accent: "#4FA3D9", img: "/planets/Earth.png",
    grad: ["#7FC3E8", "#4FA3D9", "#2E6FA8"],
    facts: { dia: "12 742", day: "24", year: "365.25", gravity: "9.81", moons: "1", temp: "+15 °C" },
    blurbKey: "planetarium.blurbs.earth",
  },
  {
    key: "mars", labelKey: "nav.mars", to: "/planetarium/mars",
    disabled: false, accent: "#E8A374", img: "/planets/Mars.png",
    grad: ["#E8A374", "#C1592E", "#7A2E14"],
    facts: { dia: "6 779", day: "24.6", year: "687", gravity: "3.71", moons: "2", temp: "−63 °C" },
    blurbKey: "planetarium.blurbs.mars",
  },
  {
    key: "jupiter", labelKey: "nav.jupiter", to: "/planetarium/jupiter",
    disabled: true, accent: "#D9C29B", img: "/planets/Jupiter.png",
    grad: ["#E8D9B8", "#C9A878", "#8A6A48"],
    facts: { dia: "139 820", day: "9.9", year: "11.9", gravity: "24.79", moons: "95", temp: "−145 °C" },
    blurbKey: "planetarium.blurbs.jupiter",
  },
  {
    key: "saturn", labelKey: "nav.saturn", to: "/planetarium/saturn",
    disabled: true, accent: "#E8D9A0", img: "/planets/Saturn.png",
    grad: ["#F3E9B8", "#D9C078", "#A9894A"],
    facts: { dia: "116 460", day: "10.7", year: "29.5", gravity: "10.44", moons: "146", temp: "−178 °C" },
    blurbKey: "planetarium.blurbs.saturn",
    rings: true,
  },
  {
    key: "uranus", labelKey: "nav.uranus", to: "/planetarium/uranus",
    disabled: true, accent: "#9FD9E0", img: "/planets/Uranus.png",
    grad: ["#C6ECF0", "#9FD9E0", "#6FB5C0"],
    facts: { dia: "50 724", day: "17.2", year: "84", gravity: "8.69", moons: "28", temp: "−224 °C" },
    blurbKey: "planetarium.blurbs.uranus",
  },
  {
    key: "neptune", labelKey: "nav.neptune", to: "/planetarium/neptune",
    disabled: true, accent: "#4F7FD9", img: "/planets/Neptune.png",
    grad: ["#7FA6E8", "#4F7FD9", "#2E5FA8"],
    facts: { dia: "49 244", day: "16.1", year: "164.8", gravity: "11.15", moons: "16", temp: "−214 °C" },
    blurbKey: "planetarium.blurbs.neptune",
  },
];

// Unique SVG gradient ids require per-render uniqueness when several discs sit
// on the same page; pass a prefix from the caller.
export function gradId(prefix, key) {
  return "plgrad-" + prefix + "-" + key;
}