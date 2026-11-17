import hashlib

import pytest

from media_lists.db import store_list
from media_lists.publish import load_contacts, newsroom_slug


def _row(email: str, name: str = "Ada Editor", outlet: str = "BevNET") -> dict[str, str]:
    return {
        "outlet": outlet,
        "publication_url": "https://www.bevnet.com/",
        "contact_name": name,
        "title": "Editor",
        "email": email,
        "contact_type": "named",
        "beat": "Beverage",
        "geography": "United States",
        "pitch_angle": "A launch.",
        "why_this_contact": "Covers launches.",
        "source_url": "https://www.bevnet.com/contact",
        "email_published_on": "https://www.bevnet.com/contact",
        "notes": "",
    }


def test_newsroom_slug():
    assert newsroom_slug("https://www.newsworthy.ai/newsroom/Green-Choice-Proteins/") == "green-choice-proteins"
    assert newsroom_slug("https://newsworthy.ai/newsroom/santos?x=1") == "santos"
    with pytest.raises(ValueError):
        newsroom_slug("https://example.com/about")


def test_load_contacts_merges_lists_and_dedupes_by_email(tmp_path):
    database = tmp_path / "media.sqlite"
    store_list(database, newsroom_url="https://newsworthy.ai/newsroom/brand", client_name="Brand",
               csv_path="/tmp/a.csv", rows=[_row("Ada@BevNET.com"), _row("tips@bevnet.com", name="")])
    # Same newsroom with www and trailing slash, overlapping address
    store_list(database, newsroom_url="https://www.newsworthy.ai/newsroom/brand/", client_name="",
               csv_path="/tmp/b.csv", rows=[_row("ada@bevnet.com"), _row("bo@other.test", outlet="Other")])
    store_list(database, newsroom_url="https://newsworthy.ai/newsroom/someone-else", client_name="X",
               csv_path="/tmp/c.csv", rows=[_row("zed@else.test")])

    client, contacts = load_contacts(database, "https://www.newsworthy.ai/newsroom/brand")

    assert client == "Brand"
    assert sorted(c.email for c in contacts) == ["ada@bevnet.com", "bo@other.test", "tips@bevnet.com"]
    desk = next(c for c in contacts if c.email == "tips@bevnet.com")
    assert desk.name == "BevNET newsroom"
    assert desk.outlet_domain == "bevnet.com"
    ada = next(c for c in contacts if c.email == "ada@bevnet.com")
    assert ada.email_md5 == hashlib.md5(b"ada@bevnet.com").hexdigest()
    assert ada.theme_fit == "A launch. Covers launches."


def test_load_contacts_unknown_newsroom(tmp_path):
    database = tmp_path / "media.sqlite"
    store_list(database, newsroom_url="https://newsworthy.ai/newsroom/brand", client_name="Brand",
               csv_path="/tmp/a.csv", rows=[_row("ada@bevnet.com")])
    with pytest.raises(LookupError):
        load_contacts(database, "https://newsworthy.ai/newsroom/nope")
