// Homepage "Досліджуй усе небо" section grid — one tile per site section.
// `to` is an i18n route name resolved to a language-prefixed path by
// LocalizedLink (see lib/seo.js SLUGS). titleKey/descKey point at
// home.sections.items.<id>.{title,desc} in the i18n bundles.
export const HOME_SECTIONS = [
  { to: "iss",            icon: "🛰️", titleKey: "home.sections.items.iss",            descKey: "home.sections.items.issDesc" },
  { to: "satellites",     icon: "📡", titleKey: "home.sections.items.satellites",     descKey: "home.sections.items.satellitesDesc" },
  { to: "weather",        icon: "🌌", titleKey: "home.sections.items.weather",        descKey: "home.sections.items.weatherDesc" },
  { to: "launches",       icon: "🚀", titleKey: "home.sections.items.launches",       descKey: "home.sections.items.launchesDesc" },
  { to: "meteors",        icon: "☄️", titleKey: "home.sections.items.meteors",        descKey: "home.sections.items.meteorsDesc" },
  { to: "events",         icon: "🌑", titleKey: "home.sections.items.events",         descKey: "home.sections.items.eventsDesc" },
  { to: "constellations", icon: "✨", titleKey: "home.sections.items.constellations", descKey: "home.sections.items.constellationsDesc" },
  { to: "asteroids",      icon: "🪨", titleKey: "home.sections.items.asteroids",      descKey: "home.sections.items.asteroidsDesc" },
  { to: "comets",         icon: "🌠", titleKey: "home.sections.items.comets",         descKey: "home.sections.items.cometsDesc" },
  { to: "exoplanets",     icon: "🌍", titleKey: "home.sections.items.exoplanets",     descKey: "home.sections.items.exoplanetsDesc" },
  { to: "galaxies",       icon: "🌀", titleKey: "home.sections.items.galaxies",       descKey: "home.sections.items.galaxiesDesc" },
  { to: "deep",           icon: "🌒", titleKey: "home.sections.items.deep",           descKey: "home.sections.items.deepDesc" },
  { to: "voyager",        icon: "📡", titleKey: "home.sections.items.voyager",        descKey: "home.sections.items.voyagerDesc" },
  { to: "mast",           icon: "🖼️", titleKey: "home.sections.items.mast",           descKey: "home.sections.items.mastDesc" },
  { to: "news",           icon: "📰", titleKey: "home.sections.items.news",           descKey: "home.sections.items.newsDesc" },
  { to: "gallery",        icon: "📷", titleKey: "home.sections.items.gallery",        descKey: "home.sections.items.galleryDesc" },
  { to: "planetarium",    icon: "🪐", titleKey: "home.sections.items.planetarium",    descKey: "home.sections.items.planetariumDesc" },
];