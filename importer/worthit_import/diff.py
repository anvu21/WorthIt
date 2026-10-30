"""Human-readable diff between the published restaurants.json and a fresh import."""
from __future__ import annotations

import math

COMPARED_FIELDS = ["name", "address", "closed", "chain", "city", "country", "website", "tiers", "notes"]
MOVE_THRESHOLD_M = 75


def distance_m(a: dict, b: dict) -> float:
    if None in (a.get("lat"), a.get("lng"), b.get("lat"), b.get("lng")):
        return 0.0 if a.get("lat") == b.get("lat") else math.inf
    lat1, lng1, lat2, lng2 = map(math.radians, (a["lat"], a["lng"], b["lat"], b["lng"]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def compute_diff(old: list[dict], new: list[dict]) -> dict:
    old_by_id = {r["id"]: r for r in old}
    new_by_id = {r["id"]: r for r in new}
    added = [new_by_id[i] for i in new_by_id.keys() - old_by_id.keys()]
    removed = [old_by_id[i] for i in old_by_id.keys() - new_by_id.keys()]
    changed = []
    for rid in sorted(old_by_id.keys() & new_by_id.keys()):
        a, b = old_by_id[rid], new_by_id[rid]
        changes = [f"{f}: {a.get(f)!r} → {b.get(f)!r}" for f in COMPARED_FIELDS if a.get(f) != b.get(f)]
        moved = distance_m(a, b)
        if moved > MOVE_THRESHOLD_M:
            changes.append("pin moved" if math.isfinite(moved) else "coordinates added/removed")
        if a.get("appearances") != b.get("appearances"):
            changes.append(f"episodes: {len(a.get('appearances', []))} → {len(b.get('appearances', []))}")
        if a.get("items") != b.get("items"):
            changes.append(f"items: {len(a.get('items', []))} → {len(b.get('items', []))} (or edited)")
        if changes:
            changed.append((b, changes))
    return {
        "added": sorted(added, key=lambda r: r["name"].lower()),
        "removed": sorted(removed, key=lambda r: r["name"].lower()),
        "changed": sorted(changed, key=lambda c: c[0]["name"].lower()),
    }


def format_diff(diff: dict) -> str:
    lines = [
        f"+{len(diff['added'])} added   ~{len(diff['changed'])} changed   -{len(diff['removed'])} removed",
    ]
    for r in diff["added"]:
        lines.append(f"  + {r['name']}  ({r['address']})")
    for r, changes in diff["changed"]:
        lines.append(f"  ~ {r['name']}")
        lines.extend(f"      {c}" for c in changes)
    for r in diff["removed"]:
        lines.append(f"  - {r['name']}  ({r['address']})  [visitors who checked it keep it in their export]")
    return "\n".join(lines)


def is_empty(diff: dict) -> bool:
    return not (diff["added"] or diff["removed"] or diff["changed"])
