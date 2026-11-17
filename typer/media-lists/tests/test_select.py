import csv

from media_lists.fetch import FoundEmail, PageEvidence
from media_lists.newsroom import release_links
from media_lists.schema import COLUMNS, Decision, is_aggregator
from media_lists.select import apply_decisions, write_csv


def page(url: str, address: str) -> PageEvidence:
    return PageEvidence(
        url=url,
        final_url=url,
        status=200,
        emails=[FoundEmail(address, "Editor " + address, "mailto")],
    )


def decision(**kwargs) -> Decision:
    base = dict(
        keep=True,
        reason="",
        outlet="Acme News",
        publication_url="https://acme.test/",
        contact_name="Ada Editor",
        title="Editor",
        email="ada@acme.test",
        contact_type="named",
        beat="Local news",
        geography="Florida",
        pitch_angle="A local company is now selling in the US.",
        why_this_contact="The staff page names her as editor.",
        source_url="https://acme.test/staff",
        email_published_on="https://acme.test/staff",
        notes="",
    )
    base.update(kwargs)
    return Decision(**base)


def test_keeps_only_an_address_that_was_extracted():
    staff = page("https://acme.test/staff", "Ada@acme.test")
    kept, dropped = apply_decisions(
        [
            decision(email="ada@acme.test"),
            decision(outlet="Other", email="ghost@acme.test", email_published_on="https://acme.test/staff"),
        ],
        [staff],
        exclude_emails=set(),
        company_domains=set(),
        newsroom_host="newsworthy.ai",
        max_rows=10,
    )
    assert len(kept) == 1
    assert kept[0]["email"] == "Ada@acme.test"
    assert any("not extracted" in item.reason for item in dropped)


def test_drops_sales_duplicates_and_company_domain():
    pages = [
        page("https://acme.test/staff", "ada@acme.test"),
        page("https://shop.test/contact", "sales@shop.test"),
        page("https://brand.test/press", "pr@brand.test"),
    ]
    decisions = [
        decision(),
        decision(outlet="Shop", email="sales@shop.test", email_published_on="https://shop.test/contact", publication_url="https://shop.test/"),
        decision(
            outlet="Brand",
            email="pr@brand.test",
            email_published_on="https://brand.test/press",
            publication_url="https://brand.test/",
            contact_name="Press desk",
            contact_type="general",
        ),
        decision(outlet="Acme News", email="ada@acme.test"),
    ]
    kept, dropped = apply_decisions(
        decisions,
        pages,
        exclude_emails={"pr@brand.test"},
        company_domains={"https://www.brand.test"},
        newsroom_host="newsworthy.ai",
        max_rows=10,
    )
    assert [row["email"] for row in kept] == ["ada@acme.test"]
    reasons = " ".join(item.reason for item in dropped)
    assert "not an editorial inbox" in reasons
    assert "duplicate" in reasons or "client PR" in reasons


def test_blank_title_on_a_named_contact_becomes_editor():
    staff = page("https://acme.test/staff", "ada@acme.test")
    kept, dropped = apply_decisions(
        [decision(title="")],
        [staff],
        exclude_emails=set(),
        company_domains=set(),
        newsroom_host="newsworthy.ai",
        max_rows=5,
    )
    assert dropped == []
    assert kept[0]["title"] == "Editor"
    assert kept[0]["email"] == "ada@acme.test"


def test_blank_title_on_a_desk_uses_the_desk_label():
    staff = page("https://acme.test/contact", "editor@acme.test")
    kept, _dropped = apply_decisions(
        [
            decision(
                email="editor@acme.test",
                email_published_on="https://acme.test/contact",
                contact_name="Editorial desk",
                contact_type="general",
                title="",
            )
        ],
        [staff],
        exclude_emails=set(),
        company_domains=set(),
        newsroom_host="newsworthy.ai",
        max_rows=5,
    )
    assert kept[0]["title"] == "Editorial desk"
    assert kept[0]["contact_type"] == "general"


def test_csv_header_matches_the_pitch_list(tmp_path):
    staff = page("https://acme.test/staff", "ada@acme.test")
    kept, _dropped = apply_decisions(
        [decision()],
        [staff],
        exclude_emails=set(),
        company_domains=set(),
        newsroom_host="newsworthy.ai",
        max_rows=5,
    )
    path = tmp_path / "list.csv"
    write_csv(path, kept)
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle))
    assert rows[0] == COLUMNS
    assert len(rows) == 2
    assert rows[1][4] == "ada@acme.test"


def test_release_links_stay_on_the_newsroom_path():
    html = """
    <a href="/newsroom/acme/one">one</a>
    <a href="/newsroom/acme/two">two</a>
    <a href="/about">about</a>
    <a href="https://other.test/newsroom/acme/nope">nope</a>
    """
    links = release_links(html, "https://www.newsworthy.ai/newsroom/acme")
    assert links == [
        "https://www.newsworthy.ai/newsroom/acme/one",
        "https://www.newsworthy.ai/newsroom/acme/two",
    ]


def test_aggregator_hosts_are_not_sources():
    assert is_aggregator("https://muckrack.com/someone")
    assert not is_aggregator("https://www.acme.test/contact")
