from datetime import datetime

from worthit_import.parse import (
    Restaurant,
    fix_title,
    norm_key,
    parse_cost,
    parse_date,
    parse_item_line,
    parse_season,
    parse_tier,
    pick,
    split_lines,
    split_name,
    strip_closed,
)


def test_split_name_hyperlink_formula():
    assert split_name('=HYPERLINK("https://sushistop.com/","Sushi Stop")') == ("Sushi Stop", "https://sushistop.com/")
    assert split_name("Sasabune") == ("Sasabune", None)


def test_strip_closed_prefix():
    assert strip_closed("CLOSED Tokyo Dog") == ("Tokyo Dog", True)
    assert strip_closed("Closed: Kogi Taqueria") == ("Kogi Taqueria", True)
    assert strip_closed("Closedown Cafe") == ("Closedown Cafe", False)
    assert strip_closed("Bar Bolonat (CLOSED)") == ("Bar Bolonat", True)
    assert strip_closed("The Church Key [CLOSED]") == ("The Church Key", True)


def test_tiers():
    assert parse_tier("$$") == "$$"
    assert parse_tier("$$\n".strip()) == "$$"
    assert parse_tier("Side Trip") == "side"
    assert parse_tier("Holiday Special") == "special"
    assert parse_tier("n/a") is None


def test_multi_line_cells_drop_separators():
    assert split_lines("http://a\n-\nhttp://b") == ["http://a", "http://b"]
    assert split_lines(3.0) == [3.0]
    assert split_lines(None) == []


def test_pick_reuses_single_value():
    assert pick(["$$"], 1) == "$$"
    assert pick(["$", "$$"], 1) == "$$"
    assert pick(["$", "$$"], 2) is None


def test_season_and_dates():
    assert parse_season(1.0) == "1"
    assert parse_season("10") == "10"
    assert parse_season("One Stop") == "One Stop"
    assert parse_date(datetime(2016, 9, 18)) == "2016-09-18"
    assert parse_date("12/11/2021") == "2021-12-11"


def test_costs_and_items():
    assert parse_cost(18.0) == 18.0
    assert parse_cost("$1,977") == 1977.0
    assert parse_cost("n/a") is None
    item = parse_item_line("$18.00 - Kinmedai White Ponzu")
    assert (item.name, item.cost) == ("Kinmedai White Ponzu", 18.0)
    assert parse_item_line("Nigiri Platter").cost is None


def test_fix_title_repairs_replacement_characters():
    assert fix_title("$710 Potluck Dinner � Holiday Special") == "$710 Potluck Dinner – Holiday Special"
    assert fix_title("Our Friend�s Face") == "Our Friend’s Face"


def test_norm_key_ignores_case_closed_and_country_suffix():
    assert norm_key("OTOTO") == norm_key("Ototo")
    assert norm_key("CLOSED Kogi Taqueria") == norm_key("Kogi Taqueria")
    assert norm_key("1 Main St, Covina, CA 91723, United States") == norm_key("1 Main St, Covina, CA 91723")


def make_restaurant(name, address):
    return Restaurant(row=0, name=name, closed=False, chain=None, address=address, website=None, notes=None,
                      appearances=[])


def test_tiers_property_orders_and_dedupes():
    from worthit_import.parse import Appearance

    r = make_restaurant("X", "1 St")
    r.appearances = [Appearance(None, None, None, t, None, None) for t in ("side", "$$$", "$", "$$$")]
    assert r.tiers == ["$", "$$$", "side"]
