import csv
from pathlib import Path

from media_lists.classify import OUTLETS, classify

LISTS = (
    Path("/home/david/Documents/nwb-finland-aina-media-pitch-list.csv"),
    Path("/home/david/Documents/agereverse-resurge-media-pitch-list.csv"),
)


def test_known_outlets_keep_their_labels():
    industry, vertical, section = classify("Supermarket News", "Grocery retail", "Executive Editor")
    assert (industry, vertical, section) == ("Grocery and retail", "Grocery", "Editorial")
    assert classify("The Globe and Mail", "Health", "Health Editor")[2] == "Health"
    assert classify("Toronto Star", "Business", "Business")[2] == "Business"
    assert classify("Council for Responsible Nutrition")[1] == "Trade association"
    assert classify("CBS12 WPEC")[1] == "Television"


def test_unknown_outlet_uses_the_beat():
    assert classify("River City Packaging News", "Packaging", "Editor")[:2] == ("Packaging", "Packaging")
    assert classify("Plain Desk", "", "Editor") == ("Unclassified", "General", "Editorial")


def test_saved_lists_all_classify():
    seen = []
    for path in LISTS:
        if not path.exists():
            continue
        with path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                seen.append(row["outlet"])
                industry, vertical, section = classify(row["outlet"], row["beat"], row["title"])
                assert industry and vertical and section
                assert industry != "Unclassified"
    assert seen
    missing = [name for name in seen if " ".join(name.casefold().split()) not in OUTLETS]
    assert missing == []
