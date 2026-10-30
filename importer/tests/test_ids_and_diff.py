from worthit_import.diff import compute_diff, is_empty
from worthit_import.ids import ID_LENGTH, assign_ids, hash_id
from worthit_import.parse import Restaurant


def r(name, address):
    return Restaurant(row=0, name=name, closed=False, chain=None, address=address, website=None, notes=None,
                      appearances=[])


def prev(pid, name, address):
    return {"id": pid, "name": name, "address": address}


def test_new_ids_are_deterministic_and_short():
    a = hash_id("Sushi Stop", "2218 Sawtelle Blvd")
    assert a == hash_id("SUSHI STOP", "2218 Sawtelle Blvd, United States")
    assert len(a) == ID_LENGTH


def test_ids_carry_over_unchanged_rows():
    rows = [r("Sushi Stop", "2218 Sawtelle Blvd")]
    assert list(assign_ids(rows, [prev("abc123", "Sushi Stop", "2218 Sawtelle Blvd")]).values()) == ["abc123"]


def test_ids_survive_rename_and_closed_flag():
    rows = [r("Sushi Stop Sawtelle", "2218 Sawtelle Blvd")]
    assert list(assign_ids(rows, [prev("abc123", "Sushi Stop", "2218 Sawtelle Blvd")]).values()) == ["abc123"]


def test_ids_survive_move():
    rows = [r("Sushi Stop", "99 New Address")]
    assert list(assign_ids(rows, [prev("abc123", "Sushi Stop", "2218 Sawtelle Blvd")]).values()) == ["abc123"]


def test_same_name_two_locations_keep_their_own_ids():
    rows = [r("Pasta Sisters", "3343 W Pico Blvd"), r("Pasta Sisters", "3280 Helms Ave")]
    old = [prev("pico01", "Pasta Sisters", "3343 W Pico Blvd"), prev("helms1", "Pasta Sisters", "3280 Helms Ave")]
    ids = assign_ids(rows, old)
    assert [ids[id(x)] for x in rows] == ["pico01", "helms1"]


def test_ambiguous_name_match_gets_new_id_instead_of_guessing():
    rows = [r("Pasta Sisters", "1 Brand New St")]
    old = [prev("pico01", "Pasta Sisters", "3343 W Pico Blvd"), prev("helms1", "Pasta Sisters", "3280 Helms Ave")]
    assert list(assign_ids(rows, old).values())[0] not in {"pico01", "helms1"}


def test_new_id_never_collides_with_retired_ids():
    clash = hash_id("New Place", "1 St")
    rows = [r("New Place", "1 St")]
    old = [prev(clash, "Something Else", "Elsewhere")]
    # "Something Else" is unrelated, so it is retired; the new row must not reuse its id.
    assert list(assign_ids(rows, old).values())[0] != clash


def test_diff_reports_added_removed_changed():
    old = [{"id": "a", "name": "A", "address": "1"}, {"id": "b", "name": "B", "address": "2"}]
    new = [{"id": "a", "name": "A2", "address": "1"}, {"id": "c", "name": "C", "address": "3"}]
    diff = compute_diff(old, new)
    assert [x["id"] for x in diff["added"]] == ["c"]
    assert [x["id"] for x in diff["removed"]] == ["b"]
    assert diff["changed"][0][1] == ["name: 'A' → 'A2'"]
    assert is_empty(compute_diff(new, new))
