"""Nominatim (OpenStreetMap) geocoding with a permanent on-disk cache.

Usage policy: https://operations.osmfoundation.org/policies/nominatim/
  - at most 1 request per second
  - identify the application in the User-Agent
  - cache results (we never re-query an address we have seen)
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from .parse import normalize_country, norm_key

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
DEFAULT_USER_AGENT = "WorthItFoodMap/1.0 (hobby project; static map of Worth It restaurants)"
MIN_INTERVAL_S = 1.1
POSTCODE_RE = re.compile(r"〒?\s*\b\d{3}-\d{4}\b|\b\d{5}(-\d{4})?\b(?=[^,]*$)")
FLOOR_RE = re.compile(r"(,\s*|\s+)(ground|\d+(st|nd|rd|th))\s+floor\b", re.IGNORECASE)
LEADING_BUILDING_RE = re.compile(r"^[^\d,][^,]*,\s*(?=\d)")
UNIT_RE = re.compile(r"\s*(,\s*)?(unit|suite|ste\.?|#|fl\.?|floor|level)\s*[\w-]+", re.IGNORECASE)


class GeocodeCache:
    def __init__(self, path: Path):
        self.path = path
        self.entries: dict[str, dict] = json.loads(path.read_text("utf-8")) if path.exists() else {}
        self.dirty = False

    def get(self, address: str) -> dict | None:
        return self.entries.get(norm_key(address))

    def put(self, address: str, entry: dict) -> None:
        self.entries[norm_key(address)] = entry
        self.dirty = True

    def save(self) -> None:
        text = json.dumps(dict(sorted(self.entries.items())), indent=1, ensure_ascii=False, sort_keys=True)
        self.path.write_text(text + "\n", encoding="utf-8")
        self.dirty = False


class Nominatim:
    def __init__(self):
        self.user_agent = os.environ.get("NOMINATIM_USER_AGENT", DEFAULT_USER_AGENT)
        self._last_call = 0.0

    def _search(self, query: str) -> dict | None:
        wait = MIN_INTERVAL_S - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        params = urllib.parse.urlencode(
            {"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1, "accept-language": "en"}
        )
        request = urllib.request.Request(f"{NOMINATIM_URL}?{params}", headers={"User-Agent": self.user_agent})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                results = json.loads(response.read().decode("utf-8"))
        finally:
            self._last_call = time.monotonic()
        return results[0] if results else None

    def lookup(self, name: str, address: str, city: str | None = None, country: str | None = None) -> dict:
        """Try progressively looser queries; return a cache entry (possibly {"failed": True}).

        Address queries are trusted. Name queries routinely match a namesake (a school, a
        park, a café in another prefecture), so they are only accepted when the hit's
        postcode area matches the sheet's postcode. Hits in the wrong country are rejected.
        """
        if "taiwan" in address.lower():
            return self._lookup_taiwan(name, address)

        tail = ", ".join(address.split(",")[-2:]).strip()
        no_unit = UNIT_RE.sub("", FLOOR_RE.sub("", address))
        no_postcode = POSTCODE_RE.sub("", no_unit).strip(" ,")
        # "The Chelsea Tower, 3708 S Las Vegas Blvd" → start at the street number.
        no_building = LEADING_BUILDING_RE.sub("", no_postcode)
        address_queries = [address, no_unit, no_postcode, no_building]
        name_queries = [f"{name}, {tail}"]
        if city:
            name_queries.append(", ".join(filter(None, [name, city, country])))
        expected_area = postcode_area(address)

        seen = set()
        for query in address_queries + name_queries:
            if query in seen:
                continue
            seen.add(query)
            hit = self._search(query)
            if not hit:
                continue
            details = hit.get("address", {})
            hit_country = normalize_country(details.get("country"))
            if country and hit_country and hit_country != country:
                continue
            if query in name_queries and (not expected_area or postcode_area(details.get("postcode")) != expected_area):
                continue
            return make_entry(hit, query)
        return {"failed": True}

    def _lookup_taiwan(self, name: str, address: str) -> dict:
        """Taiwan needs OSM's street format, and its coverage has few house numbers.

        Tried in order: house number on the street → the restaurant by name, only if the
        hit is on the sheet's street (chains have many branches) → the street itself →
        the township. The last two are flagged approx: right area, not the exact door.
        """
        parts = parse_taiwan_address(address)
        city, road = parts["city"], parts["road"]
        if not city:
            return {"failed": True}

        if road:
            if parts["number"]:
                query = f"{parts['number']} {road}, {city}, Taiwan"
                hit = self._search(query)
                if hit and on_street(hit, parts):
                    return make_entry(hit, query, approx="house_number" not in hit.get("address", {}))
            query = f"{name}, {city}, Taiwan"
            hit = self._search(query)
            if hit and on_street(hit, parts):
                return make_entry(hit, query)
            query = f"{road}, {city}, Taiwan"
            hit = self._search(query)
            if hit and on_street(hit, parts):
                return make_entry(hit, query, approx=True)
        elif parts["locality"]:
            query = f"{parts['locality']}, {city}, Taiwan"
            hit = self._search(query)
            if hit and is_taiwan(hit):
                return make_entry(hit, query, approx=True)
        return {"failed": True}


def make_entry(hit: dict, query: str, approx: bool = False) -> dict:
    details = hit.get("address", {})
    entry = {
        "lat": round(float(hit["lat"]), 6),
        "lng": round(float(hit["lon"]), 6),
        "city": details.get("city") or details.get("town") or details.get("village") or details.get("suburb"),
        "country": normalize_country(details.get("country")),
        "query": query,
    }
    if approx:
        entry["approx"] = True
    return entry


def parse_taiwan_address(address: str) -> dict:
    """Pull the useful pieces from the sheet's mixed English/Chinese Taiwan addresses.

    'No. 194號, Section 2, Xinyi Road, Da’an District, Taipei City, Taiwan 106' →
    road 'Xinyi Road Section 2', number '194', city 'Taipei'. Houses on a lane or alley
    get no number: it would be the lane's numbering, not the road's.
    """
    comma_parts = [p.strip() for p in address.replace("’", "'").split(",")]
    city = next((m.group(1) for p in comma_parts if (m := re.fullmatch(r"(.+?) (?:City|County)", p))), None)
    road = next((p for p in comma_parts if re.search(r"\b(Road|Street)$", p)), None)
    section = next((m.group(1) for p in comma_parts if (m := re.fullmatch(r"Section (\d+)", p))), None)
    on_lane = any(re.match(r"(Lane|Alley) ", p) for p in comma_parts)
    number = None
    if not on_lane:
        number = next((m.group(1) for p in comma_parts if (m := re.match(r"(?:No\. )?(\d+)(?:號|$)", p)) and "號" in p or
                       (m := re.fullmatch(r"No\. (\d+)", p))), None)
    locality = next((re.sub(r" Township$", "", p) for p in comma_parts if p.endswith("Township")), None)
    return {
        "city": city,
        "road": f"{road} Section {section}" if road and section else road,
        "road_core": re.sub(r" (Road|Street)$", "", road) if road else None,
        "number": number,
        "locality": locality,
    }


def on_street(hit: dict, parts: dict) -> bool:
    """Reject hits that aren't on the sheet's road in the sheet's city."""
    shown = hit.get("display_name", "").replace("’", "'").lower()
    return is_taiwan(hit) and parts["road_core"].lower() in shown and parts["city"].lower() in shown


def is_taiwan(hit: dict) -> bool:
    return normalize_country(hit.get("address", {}).get("country")) == "Taiwan"


def postcode_area(text: str | None) -> str | None:
    """First 3 characters of the last postcode-looking token: '90210' → '902', '151-0063' → '151'."""
    matches = re.findall(r"\b\d{3}-\d{4}\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|\b\d{3,6}\b", text or "")
    return re.sub(r"[\s-]", "", matches[-1])[:3].upper() if matches else None
