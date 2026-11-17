from media_lists.emails import addresses_in, clean_address, decode_cf, local_block_reason
from media_lists.fetch import extract_from_html


def encode(address: str, key: int = 0x5A) -> str:
    return bytes([key, *[byte ^ key for byte in address.encode()]]).hex()


def test_cloudflare_roundtrip():
    assert decode_cf(encode("editor@acme.test")) == "editor@acme.test"


def test_glued_plaintext_is_not_an_address():
    assert clean_address("jfeifer@entrepreneur.comExecutive") is None
    assert addresses_in("Write jfeifer@entrepreneur.comExecutive today") == []
    assert addresses_in("Write jfeifer@entrepreneur.com today") == ["jfeifer@entrepreneur.com"]


def test_html_keeps_mailto_and_cloudflare_with_role():
    address = "editor@acme.test"
    html = (
        "<html><title>Staff</title><body>"
        "<p>Sales <a href='mailto:sales@acme.test'>sales</a></p>"
        f"<p>Editor <a href='/cdn-cgi/l/email-protection#{encode(address)}'>[email protected]</a></p>"
        "</body></html>"
    )
    _title, _text, found = extract_from_html(html, "https://acme.test/staff")
    by_address = {item.address: item for item in found}
    assert set(by_address) == {"sales@acme.test", address}
    assert by_address[address].method == "cloudflare"
    assert "Editor" in by_address[address].context
    assert local_block_reason("sales@acme.test")
    assert local_block_reason(address) is None
