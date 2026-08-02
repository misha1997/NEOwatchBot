// Animated morphology signature for a galaxy, keyed by the catalog category.
// Pure SVG + CSS — a small visual identity per type that nudges the page from
// "data table" toward "astronomy dashboard":
//   spiral     → a top-down disc with two slowly rotating arms + a bulge
//   elliptical → a smooth glowing ellipse (no arms, just a brightening core)
//   irregular  → a loose scatter of blobs (no symmetry)
//   peculiar   → two interacting blobs with a bridge (tidal encounter)
import { useTranslation } from "react-i18next";

const STROKE = "var(--gold)";

export default function MorphologyBadge({ category = "spiral", label }) {
  const { t } = useTranslation();
  const cat = label || t(`galaxies.filters.${category}`);

  return (
    <div className="morph-badge" aria-label={cat}>
      <svg viewBox="0 0 120 120" className="morph-svg">
        <defs>
          <radialGradient id="morphBulge" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="var(--gold)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="morphDisc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(232,185,77,.35)" />
            <stop offset="70%" stopColor="rgba(79,209,197,.10)" />
            <stop offset="100%" stopColor="rgba(79,209,197,0)" />
          </radialGradient>
        </defs>

        {category === "spiral" && (
          <>
            <circle cx="60" cy="60" r="46" fill="url(#morphDisc)" />
            <g className="morph-arms">
              {/* two logarithmic-ish spiral arms, mirrored */}
              <path
                d="M60,60 C68,52 78,52 82,60 C86,68 80,80 68,80 C56,80 48,68 52,58 C56,50 66,50 70,56"
                fill="none" stroke={STROKE} strokeWidth="2.4" strokeLinecap="round" opacity="0.9"
              />
              <path
                d="M60,60 C52,68 42,68 38,60 C34,52 40,40 52,40 C64,40 72,52 68,62 C64,70 54,70 50,64"
                fill="none" stroke={STROKE} strokeWidth="2.4" strokeLinecap="round" opacity="0.9"
              />
            </g>
            <circle cx="60" cy="60" r="14" fill="url(#morphBulge)" />
          </>
        )}

        {category === "elliptical" && (
          <>
            <ellipse cx="60" cy="60" rx="48" ry="30" fill="url(#morphDisc)" opacity="0.7" />
            <ellipse cx="60" cy="60" rx="34" ry="20" fill="rgba(232,185,77,.18)" />
            <ellipse cx="60" cy="60" rx="18" ry="11" fill="url(#morphBulge)" />
            <circle cx="60" cy="60" r="6" fill="#fff" />
          </>
        )}

        {category === "irregular" && (
          <>
            <g className="morph-irr">
              <circle cx="50" cy="55" r="22" fill="url(#morphBulge)" opacity="0.8" />
              <circle cx="74" cy="48" r="13" fill="rgba(79,209,197,.18)" />
              <circle cx="70" cy="72" r="9" fill="rgba(232,185,77,.22)" />
              <circle cx="44" cy="78" r="7" fill="rgba(185,143,232,.22)" />
              <circle cx="60" cy="60" r="5" fill="#fff" />
            </g>
          </>
        )}

        {category === "peculiar" && (
          <>
            <g className="morph-pec">
              <circle cx="42" cy="60" r="22" fill="url(#morphBulge)" opacity="0.85" />
              <circle cx="80" cy="58" r="18" fill="url(#morphBulge)" opacity="0.7" />
              {/* tidal bridge */}
              <path d="M60,60 C66,54 70,58 76,56" fill="none" stroke={STROKE}
                strokeWidth="3" strokeLinecap="round" opacity="0.6" />
              {/* tidal tail */}
              <path d="M44,40 C40,30 30,28 24,34" fill="none" stroke="rgba(79,209,197,.5)"
                strokeWidth="2" strokeLinecap="round" />
              <circle cx="42" cy="60" r="6" fill="#fff" />
              <circle cx="80" cy="58" r="4" fill="#fff" />
            </g>
          </>
        )}
      </svg>
      <div className="morph-label">{cat}</div>
    </div>
  );
}