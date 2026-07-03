"""GRB (Gamma-Ray Burst) alerts via NASA GCN Circulars"""
import requests
import re
import logging
from datetime import datetime
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

GCN_ARCHIVE_URL = "https://gcn.gsfc.nasa.gov/gcn3_archive.html"


class GRBAlertAPI:
    """NASA GCN Circulars parser for GRB alerts"""

    @staticmethod
    def get_recent_grbs(limit: int = 10):
        """Fetch recent GRB entries from GCN Circulars archive.

        Returns list of dicts with keys:
            circular_id (str), grb_name (str), title (str), url (str)
        """
        try:
            response = requests.get(GCN_ARCHIVE_URL, timeout=15)
            response.raise_for_status()
            html = response.text

            grbs = []
            # Pattern: HREF=gcn3/12345.gcn3>12345</A> GRB 230414B: some title
            pattern = re.compile(
                r'HREF=gcn3/(\d+)\.gcn3\>(\d+)\</A\>\s*(GRB\s+\d+[A-Z]):\s*([^<\n]+)',
                re.IGNORECASE
            )

            for match in pattern.findall(html):
                circular_id = match[0]
                grb_name = match[2].strip()
                title = match[3].strip()

                grbs.append({
                    'circular_id': circular_id,
                    'grb_name': grb_name,
                    'title': title,
                    'url': f"https://gcn.gsfc.nasa.gov/gcn3/{circular_id}.gcn3",
                })

            # Keep only unique GRB names (first circular per GRB)
            seen = set()
            unique = []
            for g in grbs:
                if g['grb_name'] not in seen:
                    seen.add(g['grb_name'])
                    unique.append(g)

            return unique[:limit]

        except Exception as e:
            logger.error(f"GRB fetch error: {e}")
            return []

    @staticmethod
    def get_grb_details(circular_id: str):
        """Fetch full text of a GCN Circular for more details."""
        try:
            url = f"https://gcn.gsfc.nasa.gov/gcn3/{circular_id}.gcn3"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            text = response.text

            # Try to extract coordinates
            ra_match = re.search(r'RA\s*[,\s=J]*\s*(\d{1,2}:\d{2}(:\d{2})?(\.\d+)?)', text, re.IGNORECASE)
            dec_match = re.search(r'Dec\s*[,\s=]*\s*([+-]?\d{1,2}:\d{2}(:\d{2})?(\.\d+)?)', text, re.IGNORECASE)

            ra = ra_match.group(1) if ra_match else None
            dec = dec_match.group(1) if dec_match else None

            # Extract redshift if mentioned
            z_match = re.search(r'redshift\s*[\s=~]+\s*(\d+\.\d+)', text, re.IGNORECASE)
            redshift = z_match.group(1) if z_match else None

            return {
                'ra': ra,
                'dec': dec,
                'redshift': redshift,
                'snippet': text[:500].replace('\n', ' '),
            }
        except Exception as e:
            logger.error(f"GRB details fetch error: {e}")
            return {}

    @staticmethod
    def format_grb_alert(grb: dict, details: dict = None, lang: str = DEFAULT_LANG) -> str:
        """Format GRB alert message in the user's language."""
        msg = t('grb.title', lang) + t('grb.name', lang, name=grb['grb_name'])

        if details:
            if details.get('ra') and details.get('dec'):
                msg += t('grb.coords', lang, ra=details['ra'], dec=details['dec'])
            if details.get('redshift'):
                msg += t('grb.redshift', lang, z=details['redshift'])

        msg += t('grb.title_line', lang, title=grb['title'])
        msg += t('grb.link', lang, url=grb['url'], id=grb['circular_id'])
        msg += t('grb.source', lang)
        return msg
