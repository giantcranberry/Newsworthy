from datetime import date

from media_lists.db import store_list
from media_lists.hunter import HunterContact, title_rank
from media_lists.hunter_fill import HUNTER_MARK, Target, build_rows, build_targets, is_hunter_row
from media_lists.publish import load_contacts
from media_lists.schema import Decision, PagePlan
from media_lists.select import rank_and_trim


def _contact(email="jeff@bevnet.com", position="Editor-in-Chief", kind="personal", verification="valid",
             verified_on="2026-11-01", sources=("https://bevnet.com/about-us/team",)):
    return HunterContact(email=email, name="Jeff Klineman", position=position, kind=kind, confidence=97,
                         verification=verification, verified_on=verified_on, sources=list(sources))


def test_title_rank_prefers_editorial_and_rejects_business_roles():
    assert title_rank("Editor-in-Chief") > title_rank("Reporter") > title_rank("Podcast Host") > 0
    assert title_rank("Advertising Sales Manager") == 0
    assert title_rank("Publisher") == 0
    assert title_rank("") == 0


def test_freshly_valid_window():
    c = _contact(verified_on="2026-10-01")
    assert c.freshly_valid(date(2026, 11, 17))
    assert not c.freshly_valid(date(2027, 3, 1))
    assert not _contact(verification="accept_all").freshly_valid(date(2026, 11, 17))


def _plan(outlet, domain):
    return PagePlan(outlet=outlet, publication_url=f"https://www.{domain}/", url=f"https://www.{domain}/contact")


def _row(outlet, domain, email, contact_type="named", title="Reporter"):
    return {"outlet": outlet, "publication_url": f"https://www.{domain}/", "email": email,
            "contact_type": contact_type, "title": title, "why_this_contact": "fits"}


def test_build_targets_orders_gap_desk_deepen_and_skips_blocked():
    plans = [
        _plan("BevNET", "bevnet.com"),
        _plan("BevNET", "bevnet.com"),          # duplicate domain
        _plan("Star-Telegram", "star-telegram.com"),  # covered by a desk row
        _plan("Food Dive", "fooddive.com"),     # covered by one named row
        _plan("Brand", "greenchoice.com"),      # client's own domain
        _plan("Muck", "muckrack.com"),          # aggregator
    ]
    rows = [
        _row("Star-Telegram", "star-telegram.com", "news@star-telegram.com", "general", "News desk"),
        _row("Food Dive", "fooddive.com", "ann@fooddive.com", title="Senior Reporter"),
    ]
    targets = build_targets(plans, rows, company_domains={"greenchoice.com"}, newsroom_host="newsworthy.ai",
                            max_per_outlet=2)
    assert [(t.kind, t.domain, t.slots) for t in targets] == [
        ("gap", "bevnet.com", 2), ("desk", "star-telegram.com", 2), ("deepen", "fooddive.com", 1),
    ]
    assert targets[1].desk_email == "news@star-telegram.com"
    assert targets[2].already == ["Senior Reporter"]
    assert targets[0].wants_generic and not targets[1].wants_generic


def _decision(email, keep=True, fit=4, **kw):
    return Decision(keep=keep, fit=fit, outlet="BevNET", email=email, pitch_angle=kw.get("pitch_angle", "A launch."),
                    why_this_contact=kw.get("why", "Runs the beverage desk."), source_url=kw.get("source_url", ""),
                    title=kw.get("title", ""), contact_name=kw.get("contact_name", ""))


def _target(kind="gap", slots=2, desk=""):
    return Target("BevNET", "bevnet.com", "https://www.bevnet.com/", "fits", kind, slots, desk_email=desk)


def test_build_rows_validates_against_candidates_and_marks_hunter():
    jeff = _contact()
    checked = []
    result = build_rows(
        [_decision("made-up@bevnet.com"), _decision("JEFF@bevnet.com"), _decision("jeff@bevnet.com")],
        [_target()], {"bevnet.com": [jeff]},
        existing_emails=set(), exclude_emails=set(),
        confirm_valid=lambda c: checked.append(c.email) or True,
    )
    assert len(result.rows) == 1
    row = result.rows[0]
    assert row["email"] == "jeff@bevnet.com" and row["_fit"] == 4
    assert row["contact_type"] == "named" and row["title"] == "Editor-in-Chief"
    assert row["source_url"] == "https://bevnet.com/about-us/team"
    assert is_hunter_row(row) and row["email_published_on"] == f"{HUNTER_MARK}bevnet.com"
    assert "seen published" in row["notes"] and "confidence 97" in row["notes"]
    reasons = [d.reason for d in result.dropped]
    assert any("not one of Hunter's candidates" in r for r in reasons)
    assert any("duplicate" in r for r in reasons)
    assert checked == ["jeff@bevnet.com"]


def test_build_rows_slots_go_to_best_fit_and_desk_is_replaced():
    a = _contact(email="a@bevnet.com", position="Reporter")
    b = _contact(email="b@bevnet.com", position="Editor")
    desk = _contact(email="news@bevnet.com", position="", kind="generic")
    result = build_rows(
        [_decision("a@bevnet.com", fit=3), _decision("b@bevnet.com", fit=5), _decision("news@bevnet.com", fit=4)],
        [_target(kind="desk", slots=1, desk="tips@bevnet.com")], {"bevnet.com": [a, b, desk]},
        existing_emails={"tips@bevnet.com"}, exclude_emails=set(), confirm_valid=lambda c: True,
    )
    assert [r["email"] for r in result.rows] == ["b@bevnet.com"]
    assert result.replaced_desks == {"tips@bevnet.com"}
    assert "Replaces desk inbox tips@bevnet.com" in result.rows[0]["notes"]
    reasons = " ".join(d.reason for d in result.dropped)
    assert "no free slot" in reasons and "already has a desk inbox" in reasons


def test_build_rows_drops_failed_verification():
    result = build_rows([_decision("jeff@bevnet.com")], [_target()], {"bevnet.com": [_contact(verification="")]},
                        existing_emails=set(), exclude_emails=set(), confirm_valid=lambda c: False)
    assert result.rows == [] and "verification" in result.dropped[0].reason


def test_rank_and_trim_prefers_fit_then_named_then_crawled():
    rows = [
        {"email": "desk@x", "_fit": 5, "contact_type": "general", "email_published_on": "https://x/c"},
        {"email": "hunter@y", "_fit": 5, "contact_type": "named", "email_published_on": f"{HUNTER_MARK}y"},
        {"email": "low@z", "_fit": 2, "contact_type": "named", "email_published_on": "https://z/c"},
        {"email": "crawl@w", "_fit": 5, "contact_type": "named", "email_published_on": "https://w/c"},
    ]
    assert [r["email"] for r in rank_and_trim(rows, 3)] == ["crawl@w", "hunter@y", "desk@x"]


def test_publish_marks_hunter_rows(tmp_path):
    database = tmp_path / "media.sqlite"
    hunter_row = {
        "outlet": "BevNET", "publication_url": "https://www.bevnet.com/", "contact_name": "Jeff Klineman",
        "title": "Editor-in-Chief", "email": "jeff@bevnet.com", "contact_type": "named", "beat": "Beverage",
        "geography": "", "pitch_angle": "A launch.", "why_this_contact": "Runs the desk.",
        "source_url": "https://bevnet.com/about-us/team", "email_published_on": f"{HUNTER_MARK}bevnet.com",
        "notes": "Hunter.io: seen published, verified valid 2026-11-01, confidence 97",
    }
    page_row = {**hunter_row, "outlet": "Food Dive", "email": "news@fooddive.com", "notes": "",
                "publication_url": "https://www.fooddive.com/",
                "email_published_on": "https://www.fooddive.com/about", "source_url": "https://www.fooddive.com/about"}
    store_list(database, newsroom_url="https://newsworthy.ai/newsroom/brand", client_name="Brand",
               csv_path="/tmp/a.csv", rows=[hunter_row, page_row])
    _, contacts = load_contacts(database, "https://newsworthy.ai/newsroom/brand")
    by_email = {c.email: c for c in contacts}
    jeff = by_email["jeff@bevnet.com"]
    assert (jeff.email_source, jeff.hunter_score, jeff.hunter_verification) == ("hunter", 97, "valid")
    assert jeff.example_coverage_url == "https://bevnet.com/about-us/team"
    desk = by_email["news@fooddive.com"]
    assert (desk.email_source, desk.hunter_score) == ("published", None)
