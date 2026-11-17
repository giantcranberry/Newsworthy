"""Label an outlet once, the same way on every list.

Industry is the market the outlet covers. Vertical is the narrower slice.
Section is the desk inside the outlet, not another name for the beat.
"""

from __future__ import annotations

# outlet name, lowercased and collapsed, -> industry, vertical, section
OUTLETS: dict[str, tuple[str, str, str]] = {
    "bevnet": ("Beverages", "Beverage trade", "Editorial"),
    "beverage industry": ("Beverages", "Beverage manufacturing", "Editorial"),
    "beverage digest": ("Beverages", "Non-alcoholic beverages", "Editorial"),
    "beveragedaily": ("Beverages", "Non-alcoholic beverages", "Editorial"),
    "just drinks": ("Beverages", "Global drinks", "Editorial"),
    "foodbev media": ("Food", "Food and beverage", "Editorial"),
    "imbibe": ("Beverages", "Bars and on-premise", "Editorial"),
    "international bottled water association": ("Beverages", "Trade association", "Press"),
    "supermarket news": ("Grocery and retail", "Grocery", "Editorial"),
    "progressive grocer": ("Grocery and retail", "Grocery", "Editorial"),
    "mass market retailers": ("Grocery and retail", "Mass retail", "Editorial"),
    "the shelby report": ("Grocery and retail", "Grocery", "Editorial"),
    "grocery dive": ("Grocery and retail", "Grocery", "News"),
    "the grocer": ("Grocery and retail", "Grocery", "Editorial"),
    "canadian grocer": ("Grocery and retail", "Grocery", "Editorial"),
    "food business news": ("Food", "Packaged food", "Editorial"),
    "specialty food association": ("Food", "Trade association", "Press"),
    "new hope network / expo west": ("Natural products", "Natural products trade", "Press"),
    "new hope network": ("Natural products", "Natural products trade", "Press"),
    "wholefoods magazine": ("Natural products", "Natural retail", "Editorial"),
    "fmi - the food industry association": ("Grocery and retail", "Trade association", "Press"),
    "nutritional outlook": ("Supplements and nutrition", "Dietary supplements", "Editorial"),
    "nutraingredients": ("Supplements and nutrition", "Nutrition ingredients", "Editorial"),
    "foodnavigator": ("Food", "Food and beverage", "Editorial"),
    "nutrition insight and foodingredientsfirst": ("Supplements and nutrition", "Nutrition and ingredients", "Editorial"),
    "nutrition insight": ("Supplements and nutrition", "Nutrition industry", "Editorial"),
    "bakery & snacks": ("Food", "Packaged snacks and bakery", "Editorial"),
    "snack food & wholesale bakery": ("Food", "Packaged snacks and bakery", "Editorial"),
    "restaurant business": ("Restaurants and foodservice", "Restaurants", "Editorial"),
    "nation's restaurant news": ("Restaurants and foodservice", "Restaurants", "Editorial"),
    "foodservice director": ("Restaurants and foodservice", "Noncommercial foodservice", "Editorial"),
    "restaurant dive": ("Restaurants and foodservice", "Restaurants", "News"),
    "modern restaurant management": ("Restaurants and foodservice", "Restaurant operations", "Editorial"),
    "catersource": ("Restaurants and foodservice", "Catering", "Editorial"),
    "fsr and qsr": ("Restaurants and foodservice", "Restaurants", "Editorial"),
    "vending market watch": ("Convenience retail", "Vending", "Editorial"),
    "nacs": ("Convenience retail", "Trade association", "Press"),
    "csp daily news": ("Convenience retail", "Convenience stores", "Editorial"),
    "packaging europe": ("Packaging", "Packaging", "Editorial"),
    "packaging strategies": ("Packaging", "Packaging", "Editorial"),
    "packaging world": ("Packaging", "Packaging", "Editorial"),
    "food engineering": ("Food", "Food manufacturing", "Editorial"),
    "edie": ("Sustainability", "Energy and sustainability", "Editorial"),
    "resource recycling": ("Sustainability", "Recycling", "Editorial"),
    "food processing": ("Food", "Food manufacturing", "Editorial"),
    "prepared foods": ("Food", "Product development", "Editorial"),
    "dairy foods": ("Food", "Dairy and beverages", "Editorial"),
    "food & drink technology": ("Food", "Processing technology", "Editorial"),
    "food manufacture": ("Food", "Food manufacturing", "Editorial"),
    "food dive": ("Food", "Packaged food", "News"),
    "modern retail": ("Grocery and retail", "Retail", "Editorial"),
    "florida trend": ("Business", "Regional business", "Editorial"),
    "sun sentinel": ("Local news", "Newspapers", "News"),
    "the palm beach post": ("Local news", "Newspapers", "News"),
    "boca raton tribune": ("Local news", "Newspapers", "News"),
    "cbs12 wpec": ("Local news", "Television", "News"),
    "wpbf": ("Local news", "Television", "News"),
    "wptv": ("Local news", "Television", "News"),
    "local 10 wplg": ("Local news", "Television", "News"),
    "orlando sentinel": ("Local news", "Newspapers", "News"),
    "talk business & politics": ("Business", "Regional business", "Editorial"),
    "northwest arkansas democrat-gazette": ("Local news", "Newspapers", "News"),
    "40/29 news khbs/khog": ("Local news", "Television", "News"),
    "little rock public radio": ("Local news", "Public radio", "News"),
    "nutraceuticals world": ("Supplements and nutrition", "Nutraceutical formulation", "Editorial"),
    "supplyside supplement journal": ("Supplements and nutrition", "Supplement ingredients", "Editorial"),
    "vitamin retailer": ("Supplements and nutrition", "Vitamin retail", "Editorial"),
    "alive": ("Natural products", "Consumer wellness", "Editorial"),
    "holistic primary care": ("Consumer health", "Practitioner", "Editorial"),
    "naturopathic doctor news & review": ("Consumer health", "Practitioner", "Editorial"),
    "council for responsible nutrition": ("Supplements and nutrition", "Trade association", "Press"),
    "today's dietitian": ("Consumer health", "Dietetics", "Editorial"),
    "experience life": ("Fitness and lifestyle", "Healthy aging", "Editorial"),
    "zoomer": ("Fitness and lifestyle", "Healthy aging", "Editorial"),
    "everyday health": ("Consumer health", "Consumer health", "Editorial"),
    "shape": ("Consumer health", "Women's health", "Editorial"),
    "newbeauty": ("Beauty", "Beauty", "Editorial"),
    "fight aging!": ("Science", "Aging research", "Editorial"),
    "digital commerce 360": ("E-commerce", "Online retail", "Editorial"),
    "entrepreneur": ("Business", "Founders and small business", "Editorial"),
    "medcity news": ("Business", "Healthcare business", "News"),
    "strategy": ("Marketing", "Brand marketing", "News"),
    "impact magazine": ("Fitness and lifestyle", "Fitness", "Editorial"),
    "the globe and mail": ("News", "Health", "Health"),
    "toronto star": ("News", "Business news", "Business"),
    "bnn bloomberg": ("Business", "Business television", "News"),
    "global news toronto": ("Local news", "Television", "News"),
    "canadian health food association": ("Natural products", "Trade association", "Press"),
    "wlrn": ("Local news", "Public radio", "News"),
}

_KEYWORDS: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("supplement", "nutra", "vitamin", "nutraceutical"), "Supplements and nutrition", "Dietary supplements"),
    (("dietitian", "dietetics"), "Consumer health", "Dietetics"),
    (("naturopath", "practitioner", "integrative"), "Consumer health", "Practitioner"),
    (("beauty",), "Beauty", "Beauty"),
    (("e-commerce", "ecommerce"), "E-commerce", "Online retail"),
    (("grocery", "grocer", "supermarket"), "Grocery and retail", "Grocery"),
    (("mass retail", "mass market"), "Grocery and retail", "Mass retail"),
    (("packaging",), "Packaging", "Packaging"),
    (("recycl",), "Sustainability", "Recycling"),
    (("sustainab",), "Sustainability", "Energy and sustainability"),
    (("restaurant", "foodservice", "cater"), "Restaurants and foodservice", "Restaurants"),
    (("vending",), "Convenience retail", "Vending"),
    (("convenience",), "Convenience retail", "Convenience stores"),
    (("bottled water",), "Beverages", "Bottled water"),
    (("beverage", "drinks"), "Beverages", "Beverages"),
    (("natural product", "natural and organic"), "Natural products", "Natural retail"),
    (("fitness", "healthy aging", "healthy-aging"), "Fitness and lifestyle", "Fitness"),
    (("marketing",), "Marketing", "Brand marketing"),
    (("television",), "Local news", "Television"),
    (("public radio", "radio"), "Local news", "Public radio"),
    (("business",), "Business", "Business"),
    (("health",), "Consumer health", "Health"),
    (("food",), "Food", "Food"),
    (("news",), "Local news", "Newspapers"),
)


def _key(name: str) -> str:
    return " ".join((name or "").casefold().split())


def _section(title: str, beat: str) -> str:
    title_l = _key(title)
    beat_l = _key(beat)
    blob = f"{title_l} {beat_l}"
    press_marks = (
        "media contact",
        "media / pr",
        "media/pr",
        "journalist inquir",
        "communications",
        "show press",
        "press registration",
        "public relations",
    )
    if any(mark in blob for mark in press_marks):
        return "Press"
    if "health editor" in title_l or title_l in {"health", "health editor"}:
        return "Health"
    if title_l in {"business", "business desk"} or "business desk" in title_l:
        return "Business"
    news_marks = (
        "news tip",
        "news desk",
        "assignment",
        "newsroom",
        "story tip",
        "story idea",
        "television",
        "press release",
    )
    if any(mark in blob for mark in news_marks) or beat_l.endswith(" news") or "television" in beat_l:
        return "News"
    return "Editorial"


def classify(outlet: str, beat: str = "", title: str = "") -> tuple[str, str, str]:
    """Return industry, vertical, and section for one outlet."""
    known = OUTLETS.get(_key(outlet))
    if known:
        return known
    hay = f"{_key(outlet)} {_key(beat)}"
    for needles, industry, vertical in _KEYWORDS:
        if any(needle in hay for needle in needles):
            return industry, vertical, _section(title, beat)
    return "Unclassified", "General", _section(title, beat)
