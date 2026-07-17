// Slug map + URL helpers for the bilingual path-prefix scheme.
//
// Every public page lives under a language path prefix: `/ua/<slug>` (Ukrainian)
// or `/en/<slug>` (English). Slugs are translated per language — Ukrainian
// slugs are Latin transliterations, English slugs are English. This file
// MIRRORS `web/seo.py` (`SLUGS` + `_LANG_PREFIX`); keep them in parity — the
// parity check in the plan's Verify step catches drift.
//
// Internal lang codes are ISO 639-1 ("uk","en"); the URL prefix for Ukrainian
// is "ua" (not "uk"). hreflang values stay "uk".

export const SITE_URL = "https://orbitlight.space";

// lang code -> URL prefix
export const LANG_PREFIX = { uk: "ua", en: "en" };
export const PREFIX_TO_LANG = { ua: "uk", en: "en" };

export const DEFAULT_LANG = "uk";
export const LANGS = ["uk", "en"];

// i18n_name -> { uk, en } slug. Mirror of web/seo.py SLUGS.
export const SLUGS = {
  home:           { uk: "",                  en: "" },
  iss:            { uk: "mks",               en: "iss" },
  satellites:     { uk: "suputnyky",          en: "satellites" },
  weather:        { uk: "kosmichna-pogoda",    en: "weather" },
  sky:            { uk: "nebo",              en: "sky" },
  constellations: { uk: "suzirya",           en: "constellations" },
  mast:           { uk: "mast",              en: "mast" },
  meteors:        { uk: "meteory",           en: "meteors" },
  asteroids:      { uk: "asteroidy",         en: "asteroids" },
  events:         { uk: "podiyi",            en: "events" },
  launches:       { uk: "zapusky",           en: "launches" },
  news:           { uk: "novyny",            en: "news" },
  deep:           { uk: "dalniy-kosmos",     en: "deep" },
  voyager:        { uk: "voyadzher",         en: "voyager" },
  comets:         { uk: "komety",            en: "comets" },
  exoplanets:     { uk: "ekzoplanety",       en: "exoplanets" },
  gallery:        { uk: "galereya",          en: "gallery" },
  planetarium:    { uk: "planetariy",        en: "planetarium" },
  mars:           { uk: "planetariy/mars",   en: "planetarium/mars" },
  jupiter:        { uk: "planetariy/yupiter", en: "planetarium/jupiter" },
};

// Reverse map: lang -> { slug -> name }.
const SLUG_TO_NAME = {};
for (const lang of LANGS) {
  SLUG_TO_NAME[lang] = {};
  for (const [name, entry] of Object.entries(SLUGS)) {
    SLUG_TO_NAME[lang][entry[lang]] = name;
  }
}

export function prefixFor(lang) {
  return LANG_PREFIX[lang] || "en";
}

export function slugForName(name, lang) {
  const entry = SLUGS[name];
  if (!entry) return "";
  return entry[lang] ?? entry.en ?? "";
}

// Absolute URL for a (name, lang). Home -> /{prefix}/.
export function locFor(name, lang) {
  const slug = slugForName(name, lang);
  const pfx = prefixFor(lang);
  if (!slug) return `${SITE_URL}/${pfx}/`;
  return `${SITE_URL}/${pfx}/${slug}`;
}

// Relative path for SPA navigation. Home -> "/{prefix}/".
export function pathFor(name, lang) {
  const slug = slugForName(name, lang);
  const pfx = prefixFor(lang);
  if (!slug) return `/${pfx}/`;
  return `/${pfx}/${slug}`;
}

// Parse a pathname (e.g. "/ua/mks" or "/en/news/some-slug") into { name, lang }.
// News article pages resolve to name "news" (the article slug is handled by
// the router). Unknown paths resolve to name "404".
export function nameFromPath(pathname) {
  const m = pathname.match(/^\/(ua|en)\/?(.*)$/);
  if (!m) {
    // unprefixed — legacy or root; treat as 404 (server redirects real legacy
    // URLs before the SPA loads).
    return { name: "404", lang: DEFAULT_LANG };
  }
  const lang = PREFIX_TO_LANG[m[1]];
  const rest = (m[2] || "").replace(/\/+$/, ""); // strip trailing slashes
  if (rest === "") return { name: "home", lang };
  // news article: <newsSlug>/<articleSlug>
  const newsSlug = slugForName("news", lang);
  if (rest === newsSlug) return { name: "news", lang };
  if (rest.startsWith(newsSlug + "/")) {
    const tail = rest.slice(newsSlug.length + 1);
    if (tail && !tail.includes("/")) return { name: "news", lang, articleSlug: tail };
    return { name: "404", lang };
  }
  const name = SLUG_TO_NAME[lang][rest];
  return { name: name || "404", lang };
}

// Path for the same content in the other language (for the language switcher).
export function switchLangPath(pathname, targetLang) {
  const { name, articleSlug } = nameFromPath(pathname);
  const base = pathFor(name, targetLang);
  if (name === "news" && articleSlug) return `${base}/${articleSlug}`;
  return base;
}

// Compatibility shim for any caller that still imports nameForPath (returns
// just the name string). Prefer nameFromPath.
export function nameForPath(pathname) {
  return nameFromPath(pathname).name;
}