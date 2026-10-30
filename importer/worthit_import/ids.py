"""Stable restaurant IDs.

Visitors' checklists live in their browsers and reference these IDs, so an ID must
never change once published. New rows get a hash-based ID; existing rows inherit the
ID from the previous restaurants.json, surviving renames and address changes.
"""
from __future__ import annotations

import hashlib

from .parse import Restaurant, norm_key

ID_LENGTH = 6
ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"


def base36(number: int) -> str:
    digits = []
    while number:
        number, rem = divmod(number, 36)
        digits.append(ALPHABET[rem])
    return "".join(reversed(digits)) or "0"


def hash_id(name: str, address: str, salt: int = 0) -> str:
    seed = f"{norm_key(name)}|{norm_key(address)}" + (f"#{salt}" if salt else "")
    digest = int(hashlib.sha1(seed.encode("utf-8")).hexdigest(), 16)
    return base36(digest)[:ID_LENGTH]


def assign_ids(restaurants: list[Restaurant], previous: list[dict]) -> dict[int, str]:
    """Return {id(restaurant): stable_id}.

    Match order for each new row against the still-unclaimed previous entries:
      1. same name + address
      2. the only unclaimed entry at the same address (restaurant renamed / re-flagged)
      3. the only unclaimed entry with the same name (restaurant moved)
    """
    unclaimed = {p["id"]: p for p in previous}
    assigned: dict[int, str] = {}

    def claim(r: Restaurant, prev_id: str) -> None:
        assigned[id(r)] = prev_id
        del unclaimed[prev_id]

    passes = [
        lambda r, p: norm_key(r.name) == norm_key(p["name"]) and norm_key(r.address) == norm_key(p["address"]),
        lambda r, p: norm_key(r.address) == norm_key(p["address"]),
        lambda r, p: norm_key(r.name) == norm_key(p["name"]),
    ]
    for pass_index, matches in enumerate(passes):
        for r in restaurants:
            if id(r) in assigned:
                continue
            hits = [pid for pid, p in unclaimed.items() if matches(r, p)]
            # Pass 1 may hit exact duplicates; take the first. Later passes must be unambiguous.
            if hits and (pass_index == 0 or len(hits) == 1):
                claim(r, hits[0])

    used = set(assigned.values()) | set(unclaimed)
    for r in restaurants:
        if id(r) in assigned:
            continue
        salt = 0
        new_id = hash_id(r.name, r.address)
        while new_id in used:
            salt += 1
            new_id = hash_id(r.name, r.address, salt)
        assigned[id(r)] = new_id
        used.add(new_id)
    return assigned
