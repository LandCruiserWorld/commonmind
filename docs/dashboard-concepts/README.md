# Dashboard concepts

Four standalone HTML mockups (fixture data, no backend) exploring how
CommonMind's UI could look. Open any of them directly in a browser —
no build step. For the team meeting: these are **3 distinct interaction
models**, plus one demo-tuned build of the third.

## 01 — Search console
`01-search-console.html`

Workspace rail on the left, a search-first center pane ("What does the
company know?"), and a right sidebar for pending approvals, cluster
health, and a live "landing now" ticker. Closest to a traditional
internal-tools dashboard.

## 02 — Chat-embedded
`02-chat-embedded.html`

CommonMind living inside a Slack/Discord-style channel. Memory surfaces
ambiently in a side panel as you type ("the brain on this") before you
even send the message, and approvals happen inline in the conversation.

## 03 — Network map
`03-network-map.html`

An animated hub-and-spoke visualization: CommonMind Core in the center,
projects orbiting it, people/agents pulsing capture and recall events
along the spokes. Hover for detail, click to drill into a project or a
cross-project connection. Built for "watch the system think," not
day-to-day task work.

## 04 — Network map (hackathon demo variant)
`04-network-map-hackathon-demo.html`

**Not a fourth concept** — this reuses 03's exact canvas/animation
engine, re-purposed as judge-facing submission collateral: adds a live
uptime counter, a "block an AZ" CockroachDB failure drill, tech/host
chips per project, and a canned Q&A answer overlay. Useful reference
for the resilience-demo interaction, but treat it as a variant of 03
when comparing concepts, not a peer of 01/02/03.

---

Sourced from local mockup iteration on 2026-08-05; added here as
reference material for team review — not wired to the app.
