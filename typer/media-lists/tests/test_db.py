from media_lists.db import outlet_rows, store_list


def _row(outlet: str, email: str, beat: str, title: str = "Editor") -> dict[str, str]:
    return {
        "outlet": outlet,
        "publication_url": "https://example.test/",
        "contact_name": "Ada Editor",
        "title": title,
        "email": email,
        "contact_type": "named",
        "beat": beat,
        "geography": "United States",
        "pitch_angle": "A product launch.",
        "why_this_contact": "Editor.",
        "source_url": "https://example.test/staff",
        "email_published_on": "https://example.test/staff",
        "notes": "",
    }


def test_two_lists_share_one_outlet_and_reload_does_not_duplicate(tmp_path):
    database = tmp_path / "media.sqlite"
    store_list(
        database,
        newsroom_url="https://example.test/a",
        client_name="A",
        csv_path="/tmp/a.csv",
        rows=[_row("Supermarket News", "Ada@Shop.test", "Grocery retail")],
    )
    store_list(
        database,
        newsroom_url="https://example.test/b",
        client_name="B",
        csv_path="/tmp/b.csv",
        rows=[_row("Supermarket News", "ada@shop.test", "Grocery and CPG retail", "Executive Editor")],
    )
    store_list(
        database,
        newsroom_url="https://example.test/a",
        client_name="A",
        csv_path="/tmp/a.csv",
        rows=[_row("Supermarket News", "Ada@Shop.test", "Grocery retail")],
    )
    rows = outlet_rows(database)
    assert len(rows) == 1
    assert rows[0]["name"] == "Supermarket News"
    assert rows[0]["industry"] == "Grocery and retail"
    assert rows[0]["vertical"] == "Grocery"
    assert rows[0]["section"] == "Editorial"
    assert rows[0]["contacts"] == 1
    grocery = outlet_rows(database, vertical="Grocery")
    assert len(grocery) == 1
    assert outlet_rows(database, section="Press") == []
