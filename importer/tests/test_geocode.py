from worthit_import.geocode import Nominatim, on_street, parse_taiwan_address


def hit(display_name, lat="25.0", lon="121.5", **address):
    return {"lat": lat, "lon": lon, "display_name": display_name, "address": {"country": "Taiwan", **address}}


def lookup_with(responses, name, address):
    """Run a lookup with canned Nominatim replies; returns (entry, queries sent)."""
    geocoder = Nominatim()
    sent = []

    def fake_search(query):
        sent.append(query)
        return responses.get(query)

    geocoder._search = fake_search
    return geocoder.lookup(name, address, "Taipei", "Taiwan"), sent


def test_parse_standard_order():
    parts = parse_taiwan_address("No. 194號, Section 2, Xinyi Road, Da’an District, Taipei City, Taiwan 106")
    assert parts["road"] == "Xinyi Road Section 2"
    assert parts["number"] == "194"
    assert parts["city"] == "Taipei"


def test_parse_reversed_order_with_floor():
    parts = parse_taiwan_address("106, Taiwan, Taipei City, Da’an District, Section 4, Zhongxiao East Road, 97號B1樓")
    assert parts["road"] == "Zhongxiao East Road Section 4"
    assert parts["number"] == "97"


def test_parse_number_without_hao():
    assert parse_taiwan_address("No. 189, Section 3, Tingzhou Road, Taipei City, Taiwan 100")["number"] == "189"


def test_lane_address_gets_no_house_number():
    parts = parse_taiwan_address("No. 57號, Lane 308, Guangfu South Road, Da’an District, Taipei City, Taiwan 106")
    assert parts["number"] is None
    assert parts["road"] == "Guangfu South Road"


def test_township_address_has_locality_only():
    parts = parse_taiwan_address("Sanxing Township, Yilan County, Taiwan 266")
    assert parts["road"] is None
    assert (parts["locality"], parts["city"]) == ("Sanxing", "Yilan")


def test_on_street_handles_curly_apostrophes():
    parts = parse_taiwan_address("No. 533號, Section 3, Hai'an Road, North District, Tainan City, Taiwan 704")
    assert on_street(hit("533, Hai’an Road Section 3, Tainan, Taiwan"), parts)
    assert not on_street(hit("Bade Road Section 4, Tainan, Taiwan"), parts)


def test_other_branch_of_a_chain_is_rejected_in_favour_of_the_street():
    address = "No. 194號, Section 2, Xinyi Road, Da’an District, Taipei City, Taiwan 106"
    entry, _ = lookup_with(
        {
            "Din Tai Fung, Taipei, Taiwan": hit("Din Tai Fung, Zhongxiao East Road Section 3, Taipei, Taiwan", lat="1"),
            "Xinyi Road Section 2, Taipei, Taiwan": hit("171, Xinyi Road Section 2, Taipei, Taiwan", lat="2"),
        },
        "Din Tai Fung",
        address,
    )
    assert entry["lat"] == 2.0
    assert entry["approx"] is True


def test_exact_house_number_is_not_approx():
    address = "No. 194號, Section 2, Xinyi Road, Da’an District, Taipei City, Taiwan 106"
    entry, sent = lookup_with(
        {"194 Xinyi Road Section 2, Taipei, Taiwan": hit("194, Xinyi Road Section 2, Taipei, Taiwan", house_number="194")},
        "Din Tai Fung",
        address,
    )
    assert "approx" not in entry
    assert len(sent) == 1


def test_nothing_found_fails_cleanly():
    entry, _ = lookup_with({}, "Nowhere", "No. 1, Fake Road, Taipei City, Taiwan 100")
    assert entry == {"failed": True}
