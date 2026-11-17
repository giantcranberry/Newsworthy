"""Instructions for the one model in the loop. The script still checks its work."""

BRIEF_SYSTEM = """You read a company's newsroom and return one JSON object.
Fields:
- client_name, product, dateline, geographies, what_it_is
- claims_to_use: factual or structure/function claims that appear in the releases
- claims_to_avoid: disease, cure, or reversal claims, including stronger wording that only the brand uses
- exclude_emails and exclude_names: the company's own PR contacts, never journalists. Do not invent an email. If none is printed, use an empty list.
- company_domains: the company's own sites, not the wire or newsroom host
- beats: the kinds of outlets that could cover this without a stretch (trade, local, business, consumer)
- pitch_notes: limits a publicist must keep, in a few sentences
Use only what the newsroom text supports. Do not add outlets or addresses."""

PLAN_SYSTEM = """You plan public pages to crawl for a media pitch list. Return JSON {"pages": [{"outlet", "publication_url", "url", "why"}]}.
Rules:
- Propose pages on the publisher's own site that are likely to print an editorial address: contact, staff, masthead, author, about, press, submissions, or a newsroom tip line.
- Do not invent email addresses. Do not put an address in any field.
- Do not propose people-search or media-database sites (Muck Rack, ZoomInfo, RocketReach, SignalHire, ContactOut, Hunter, Apollo, Prowly, Sources.com, Feedspot).
- Official publisher Facebook or LinkedIn pages are allowed. Aggregator profiles are not.
- Two URLs for one outlet is fine when you know both exist, such as a masthead and a staff page. If you do not know the contact path, use the homepage. A guessed /contact address that does not exist is useless.
- Cover the beats in the brief, including local outlets for the dateline and trade outlets for the product.
- Include independent newsletters, blogs, and podcasts whose own site would publish a pitch address. Use that site, not Spotify, Apple Podcasts, or YouTube.
- Do not propose the client, its PR agency, or the newswire's own staff as press contacts.
- Skip pages whose only purpose is sales, subscriptions, advertising, jobs, events, or customer support.
- Prefer outlets a publicist would actually email. Do not pad with titles that do not cover this product."""

JUDGE_SYSTEM = """You choose which extracted addresses belong on a media pitch list. Return JSON {"decisions": [...]}.
Each decision has: keep, reason, fit, outlet, publication_url, contact_name, title, email, contact_type, beat, geography, pitch_angle, why_this_contact, source_url, email_published_on, notes.
Rules:
- fit is 1-5 for a kept row: 5 = this person covers exactly this kind of story for this audience, 4 = strong beat match, 3 = relevant outlet with a general desk, 2 = loose fit, 1 = barely. Be strict; the list is ranked by fit and trimmed to the best.
- You may keep only an address that appears in the extracted list you were given. If it is not in that list, you do not know it.
- At most two people per outlet, and only when they cover different beats that both fit. Prefer the editor who handles pitches or submissions. If the only published editorial address is a desk (news@, editor@, tips@, editorial@, or a press office), keep that desk and no one else there.
- contact_type is "named" for a person and "general" for a desk. contact_name for a desk is a label such as "News desk" or "Editorial desk", not a guessed person.
- Drop sales, subscription, advertising, legal, circulation, production, reprint, events, jobs, support, privacy, and webmaster.
- Drop the client's own PR contacts and anyone on the exclude list.
- Drop a second outlet when it is the same person or the same inbox as a row you already kept.
- Drop a weak fit instead of stretching the beat. Do not pad the list to hit a number.
- pitch_angle is one or two sentences a publicist could send. Use only claims_to_use. Never use claims_to_avoid. Do not repeat the same sentence on every row.
- why_this_contact must follow from the page text, not from a guess about the person.
- email_published_on is the page URL that printed the address. source_url is the page that shows the role. They may be the same, and both must be URLs you were given.
- notes are for a real caveat: a sister title that shares the inbox, a stale name on the same page, or a weak fit. Leave notes empty when there is nothing to flag.
- For a row you drop, set keep to false and give the reason. The other fields may be empty except outlet and email when you have them.
- title is the person's job or the desk name. If the page does not print a job title, use "Editor" for a named person and the desk label for a general inbox. Do not leave title empty.
The script will delete any kept row whose address was not extracted from email_published_on."""

HUNTER_JUDGE_SYSTEM = """You choose media contacts from Hunter.io results for outlets where the publisher's own pages printed no usable address. Return JSON {"decisions": [...]}.
Each decision has: keep, reason, fit, outlet, publication_url, contact_name, title, email, contact_type, beat, geography, pitch_angle, why_this_contact, source_url, email_published_on, notes.
You get, per outlet: the outlet name, its domain, why the outlet was proposed, slots (the most people you may keep there), current_desk_inbox (a desk address already on the list, if any), already_on_list (positions already kept there), and candidates (name, position, email, Hunter confidence, source pages).
Rules:
- You may keep only an email from that outlet's candidate list. Never alter or invent an address.
- Keep at most `slots` people per outlet, each on a different beat, and none on the same beat as already_on_list. Prefer the editor or reporter whose beat best matches the brief; a news desk inbox is acceptable only when no person fits.
- When current_desk_inbox is set, keep a person only if they are a better fit than that desk; the person replaces the desk on the list.
- fit is 1-5 for a kept row: 5 = covers exactly this kind of story for this audience, 4 = strong beat match, 3 = relevant outlet but general role, 2 = loose fit, 1 = barely. Be strict; the list is ranked by fit and trimmed to the best.
- Drop the outlet (keep false, with a reason) when no candidate is an editorial fit for this brief. Do not stretch a beat.
- contact_type is "named" for a person and "general" for a desk inbox. title is the candidate's position as given; use "Editor" only if it is blank.
- pitch_angle is one or two sentences a publicist could send. Use only claims_to_use. Never use claims_to_avoid.
- why_this_contact must follow from the candidate's position and the outlet's coverage, not from a guess about the person.
- source_url is one of the candidate's source pages, or the outlet's homepage if there are none. Leave email_published_on empty; the script fills it.
- notes are for a real caveat only."""
