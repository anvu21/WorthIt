"""Excel → restaurants.json.

    python -m worthit_import                 # parse, geocode new addresses, show diff, ask to write
    python -m worthit_import --yes           # same, no prompt
    python -m worthit_import --check         # CI: no network, no writes; fail if JSON is stale
    python -m worthit_import --no-geocode    # write without looking up new addresses
    python -m worthit_import --retry-failed  # re-try addresses that found no pin last time
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .diff import compute_diff, format_diff, is_empty
from .geocode import GeocodeCache, Nominatim
from .ids import assign_ids
from .parse import Restaurant, parse_workbook

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_XLSX = PROJECT_ROOT / "Data" / "Worth It Places Visited.xlsx"
DEFAULT_OUT = PROJECT_ROOT / "frontend" / "public" / "data" / "restaurants.json"
DEFAULT_CACHE = PROJECT_ROOT / "importer" / "geocode_cache.json"
SCHEMA_VERSION = 1


def to_record(r: Restaurant, rid: str) -> dict:
    return {
        "id": rid,
        "name": r.name,
        "closed": r.closed,
        "chain": r.chain,
        "address": r.address,
        "city": r.city,
        "country": r.country,
        "lat": r.lat,
        "lng": r.lng,
        "website": r.website,
        "tiers": r.tiers,
        "appearances": [a.to_json() for a in r.appearances],
        "items": [i.to_json() for i in r.items],
        "notes": r.notes,
    }


def load_previous(path: Path) -> dict:
    if not path.exists():
        return {"restaurants": []}
    return json.loads(path.read_text("utf-8"))


def serialize(payload: dict) -> str:
    return json.dumps(payload, indent=1, ensure_ascii=False, sort_keys=True) + "\n"


def apply_coordinates(restaurants: list[Restaurant], cache: GeocodeCache, geocoder: Nominatim | None,
                      retry_failed: bool = False) -> list[str]:
    """Fill lat/lng/city/country from the sheet, cache, or network. Returns names still missing coords."""
    def needs_lookup(r: Restaurant) -> bool:
        entry = cache.get(r.address)
        return not r.coords_from_sheet and (entry is None or (retry_failed and entry.get("failed")))

    pending = [r for r in restaurants if needs_lookup(r)]
    if pending and geocoder:
        print(f"Geocoding {len(pending)} address(es) via Nominatim (up to ~{len(pending) * 5.5:.0f}s)…")
        for n, r in enumerate(pending, 1):
            try:
                entry = geocoder.lookup(r.name, r.address, r.city, r.country)
            except OSError as exc:
                print(f"  ! network error for {r.name}: {exc} — will retry next run")
                continue
            cache.put(r.address, entry)
            status = "not found" if entry.get("failed") else f"{entry['lat']:.4f},{entry['lng']:.4f}"
            print(f"  [{n}/{len(pending)}] {r.name}: {status}")

    missing = []
    for r in restaurants:
        entry = cache.get(r.address) or {}
        if not r.coords_from_sheet and not entry.get("failed") and "lat" in entry:
            r.lat, r.lng = entry["lat"], entry["lng"]
        r.city = r.city or entry.get("city")
        r.country = r.country or entry.get("country")
        if r.lat is None:
            missing.append(r.name)
    return missing


def build(args) -> tuple[dict, dict, list[str], GeocodeCache]:
    result = parse_workbook(args.xlsx)
    for warning in result.warnings:
        print(f"warning: {warning}")

    previous = load_previous(args.out)
    ids = assign_ids(result.restaurants, previous.get("restaurants", []))

    cache = GeocodeCache(args.cache)
    geocoder = None if (args.check or args.no_geocode) else Nominatim()
    missing = apply_coordinates(result.restaurants, cache, geocoder, retry_failed=args.retry_failed)

    records = sorted((to_record(r, ids[id(r)]) for r in result.restaurants), key=lambda rec: rec["id"])
    unchanged = records == previous.get("restaurants")
    payload = {
        "schema": SCHEMA_VERSION,
        "generated_at": previous.get("generated_at") if unchanged else
        datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "restaurants": records,
    }
    return payload, previous, missing, cache


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="worthit_import", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--check", action="store_true", help="verify the JSON is up to date (no network/writes)")
    parser.add_argument("--yes", "-y", action="store_true", help="write without asking")
    parser.add_argument("--no-geocode", action="store_true", help="skip network lookups for new addresses")
    parser.add_argument("--retry-failed", action="store_true", help="look up addresses that previously failed again")
    args = parser.parse_args(argv)
    # Restaurant names include CJK and accented text; Windows consoles default to cp1252.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    payload, previous, missing, cache = build(args)
    diff = compute_diff(previous.get("restaurants", []), payload["restaurants"])

    print()
    print(format_diff(diff))
    mapped = len(payload["restaurants"]) - len(missing)
    print(f"\n{len(payload['restaurants'])} restaurants, {mapped} on the map")
    if missing:
        print(f"{len(missing)} without coordinates (add Lat/Lng columns on the Map sheet to fix): "
              + ", ".join(missing[:15]) + (" …" if len(missing) > 15 else ""))

    if args.check:
        if args.out.exists() and serialize(payload) == args.out.read_text("utf-8"):
            print("\n✓ restaurants.json is up to date with the workbook")
            return 0
        print("\n✗ restaurants.json is out of date — run `python -m worthit_import` locally and commit the result")
        return 1

    if is_empty(diff) and not cache.dirty and args.out.exists():
        print("\nNothing to do.")
        return 0

    if not args.yes:
        if not sys.stdin.isatty():
            print("\nNot a terminal — re-run with --yes to write.")
            return 1
        if input("\nWrite restaurants.json? [y/N] ").strip().lower() not in {"y", "yes"}:
            print("Aborted; nothing written.")
            if cache.dirty:
                cache.save()  # keep geocoding work so the next run is instant
            return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(serialize(payload), encoding="utf-8")
    if cache.dirty:
        cache.save()
    print(f"Wrote {args.out.relative_to(PROJECT_ROOT) if args.out.is_relative_to(PROJECT_ROOT) else args.out}")
    print("Next: review with `git diff`, then commit + push — CI deploys it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
