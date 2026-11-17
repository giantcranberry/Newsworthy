"""Find published addresses and drop the ones that are not a pitch."""

from __future__ import annotations

import re

from media_lists.schema import BLOCKED_LOCAL

# TLD is bounded so "editor@example.comExecutive" does not become one token.
EMAIL_RE = re.compile(
    r"(?<![A-Za-z0-9._%+\-])"
    r"([A-Za-z0-9](?:[A-Za-z0-9._%+\-]{0,62}[A-Za-z0-9])?@"
    r"[A-Za-z0-9](?:[A-Za-z0-9\-]{0,62}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,62}[A-Za-z0-9])?)*"
    r"\.[A-Za-z]{2,10})"
    r"(?![A-Za-z0-9])"
)
CF_RE = re.compile(
    r"(?:data-cfemail=[\"']|email-protection#)([0-9a-fA-F]{6,})"
)
MAILTO_RE = re.compile(r"mailto:([^?\"'>\s]+)", re.I)
SKIP_IN = (
    "sentry",
    "wixpress",
    "example.com",
    "schema.org",
    "cloudflare",
    "googleapis",
    "gstatic",
    "wordpress.",
    "jquery",
    "bootstrap",
    "godaddy",
    "w3.org",
    "ingest.",
    "mysite.com",
    "emailaddress",
    "yoursite",
    "domain.com",
    "squarespace",
)


def decode_cf(encoded: str) -> str:
    """Decode a Cloudflare email-protection hex string. The first byte is the key."""
    raw = encoded.strip()
    if raw.startswith("#"):
        raw = raw[1:]
    if len(raw) < 4 or len(raw) % 2:
        raise ValueError("not a Cloudflare email hash")
    try:
        key = int(raw[:2], 16)
        chars = [chr(int(raw[i : i + 2], 16) ^ key) for i in range(2, len(raw), 2)]
    except ValueError as exc:
        raise ValueError("not a Cloudflare email hash") from exc
    return "".join(chars)


def local_block_reason(address: str) -> str | None:
    local = address.split("@", 1)[0].lower()
    base = re.split(r"[._+\-]", local)[0]
    if local in BLOCKED_LOCAL or base in BLOCKED_LOCAL:
        return f"not an editorial inbox ({local})"
    return None


def clean_address(address: str) -> str | None:
    text = address.strip().removeprefix("u003e").removeprefix("mailto:")
    text = text.split("?", 1)[0].strip(".,;:<>\"'()[]")
    match = EMAIL_RE.search(text)
    if not match:
        return None
    found = match.group(1).strip(".,;:")
    lower = found.lower()
    if any(token in lower for token in SKIP_IN):
        return None
    if lower.endswith((".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js")):
        return None
    if len(found) > 80 or found.count("@") != 1:
        return None
    return found


def addresses_in(text: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for match in EMAIL_RE.finditer(text or ""):
        cleaned = clean_address(match.group(1))
        if not cleaned:
            continue
        key = cleaned.casefold()
        if key in seen:
            continue
        seen.add(key)
        found.append(cleaned)
    return found
