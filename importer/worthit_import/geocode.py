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
        tail = ", ".join(address.split(",")[-2:]).strip()
        no_postcode = POSTCODE_RE.sub("", UNIT_RE.sub("", address)).strip(" ,")
        address_queries = [address, UNIT_RE.sub("", address), no_postcode]
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
            return {
                "lat": round(float(hit["lat"]), 6),
                "lng": round(float(hit["lon"]), 6),
                "city": details.get("city") or details.get("town") or details.get("village") or details.get("suburb"),
                "country": hit_country,
                "query": query,
            }
        return {"failed": True}


def postcode_area(text: str | None) -> str | None:
    """First 3 characters of the last postcode-looking token: '90210' → '902', '151-0063' → '151'."""
    matches = re.findall(r"\b\d{3}-\d{4}\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|\b\d{3,6}\b", text or "")
    return re.sub(r"[\s-]", "", matches[-1])[:3].upper() if matches else None
