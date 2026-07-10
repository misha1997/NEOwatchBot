import os
import logging
import warnings
import numpy as np
from datetime import datetime
import lightkurve as lk
from astroquery.mast import Observations
from astropy.coordinates import SkyCoord
import astropy.units as u
from astropy.time import Time

logger = logging.getLogger(__name__)

# Suppress lightkurve submodules warnings
warnings.filterwarnings("ignore", category=UserWarning, module="lightkurve")

# Predefined list of 6 famous targets for Hubble/JWST recent observations cone search
FAMOUS_TARGETS = [
    {"name": "TRAPPIST-1 e", "coords": "23h06m29.28s -05d02m28.5s"},
    {"name": "Ring Nebula (M57)", "coords": "18h53m35.079s +33d01m45.03s"},
    {"name": "Sombrero Galaxy", "coords": "12h39m59.4s -11d37m23s"},
    {"name": "Abell 2218", "coords": "16h35m54s +66d13m00s"},
    {"name": "Orion Nebula (M42)", "coords": "05h35m17.3s -05d23m28s"},
    {"name": "Pillars of Creation", "coords": "18h18m48s -13d49m00s"}
]

def mjd_to_date(mjd) -> str:
    """Convert Modified Julian Date (MJD) to DD.MM.YYYY string."""
    try:
        t = Time(mjd, format='mjd')
        return t.datetime.strftime("%d.%m.%Y")
    except Exception:
        return ""

class MastService:
    @staticmethod
    def query_star_lightcurve(target_id: str) -> dict | None:
        """Search, download and process TESS/Kepler lightcurve for a target."""
        target_clean = target_id.strip()
        logger.info("MAST: Searching light curve for target: %s", target_clean)
        
        try:
            # Try SPOC (high quality pipeline) author first, fallback to any
            search_result = lk.search_lightcurve(target_clean, author="SPOC")
            if len(search_result) == 0:
                search_result = lk.search_lightcurve(target_clean)
                
            if len(search_result) == 0:
                logger.warning("MAST: No light curves found for %s", target_clean)
                return None
                
            # Download the first product
            logger.info("MAST: Downloading light curve for %s", target_clean)
            lc = search_result[0].download()
            if lc is None:
                return None
                
            # Extract time & flux values
            time = lc.time.value
            flux = getattr(lc, 'pdcsap_flux', None)
            if flux is None:
                flux = getattr(lc, 'flux', None)
                
            if flux is None:
                logger.warning("MAST: No flux column found in light curve for %s", target_clean)
                return None
                
            flux_val = flux.value
            
            # Remove NaNs
            mask = ~np.isnan(time) & ~np.isnan(flux_val)
            time = time[mask]
            flux_val = flux_val[mask]
            
            # Downsample if too many points (limit to ~800 points for web chart performance)
            max_pts = 800
            if len(time) > max_pts:
                step = int(np.ceil(len(time) / max_pts))
                time = time[::step]
                flux_val = flux_val[step-1::step] # use step offset to match lengths if sliced
                # Ensure equal length
                min_len = min(len(time), len(flux_val))
                time = time[:min_len]
                flux_val = flux_val[:min_len]
                
            # Normalize flux around 1.0
            if len(flux_val) > 0:
                median_flux = float(np.median(flux_val))
                if median_flux > 0:
                    normalized_flux = (flux_val / median_flux).tolist()
                else:
                    normalized_flux = flux_val.tolist()
            else:
                normalized_flux = []
                
            time_list = time.tolist()
            
            return {
                "target": target_clean,
                "label": getattr(lc, 'label', target_clean),
                "mission": getattr(lc, 'mission', 'TESS'),
                "sector": int(getattr(lc, 'sector', 0)) if getattr(lc, 'sector', None) is not None else None,
                "time": time_list,
                "flux": normalized_flux
            }
            
        except Exception as e:
            logger.error("MAST: Failed to query lightcurve for %s: %s", target_clean, e)
            return None

    @staticmethod
    def get_hubble_jwst_recent_obs() -> list[dict]:
        """Query recent HST & JWST science image observations in famous regions."""
        obs_list = []
        
        for target in FAMOUS_TARGETS:
            try:
                # Do a fast cone search for each target
                coord = SkyCoord(target["coords"], frame="icrs")
                # Query within 0.05 deg (3 arcmin)
                res = Observations.query_region(coord, radius=0.05 * u.deg)
                if len(res) == 0:
                    continue
                    
                # Filter for HST & JWST science image observations with valid JPEGs
                mask = (res['obs_collection'] == 'HST') | (res['obs_collection'] == 'JWST')
                res = res[mask]
                res = res[res['intentType'] == 'science']
                res = res[res['dataproduct_type'] == 'image']
                res = res[~res['jpegURL'].mask]
                
                if len(res) == 0:
                    continue
                    
                # Sort by time descending (latest first)
                res.sort('t_min')
                res.reverse()
                
                # Take top 2 observations for this target
                for row in res[:2]:
                    jpeg_uri = row['jpegURL']
                    # Convert to public HTTP URL if it is a mast: URI
                    if jpeg_uri.startswith("mast:"):
                        jpeg_url = f"https://mast.stsci.edu/api/v0.1/Download/file/?uri={jpeg_uri}"
                    else:
                        jpeg_url = jpeg_uri
                        
                    obs_list.append({
                        "instrument": f"{row['obs_collection']} · {row['instrument_name']}",
                        "target": target["name"],
                        "coords": f"RA {row['s_ra']:.2f}° / Dec {row['s_dec']:.2f}°",
                        "date": mjd_to_date(row['t_min']),
                        "jpeg_url": jpeg_url,
                        "collection": row['obs_collection']
                    })
            except Exception as e:
                logger.error("MAST: Failed to query region for %s: %s", target["name"], e)
                
        return obs_list
