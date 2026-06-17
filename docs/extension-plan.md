# UniKart — Extension & Share Plan

This document describes how products get *into* UniKart from the rest of the web and the phone: a Chrome browser extension, an iOS Share Extension, an Android share-target, and progressive web app (PWA) share readiness.

The principle is the same everywhere. Saving a product should feel like a single, calm gesture. UniKart reads only the page the user chose to share, only when they ask, and never works quietly in the background.

> **Status note.** Everything below is a plan. None of these surfaces ship in the current MVP. The web MVP supports paste-a-URL and manual add. The browser extension and share extensions are **future work**, targeted for **Phase 7**. Nothing here describes a shipped feature or an existing partnership.

---

## Goal

Let people save a product to UniKart from wherever they find it — a store page, a social post, a search result — with one deliberate action and a clean preview.

The save path reuses the existing UniKart product parser (Phase 3) rather than inventing a second one. The extension and share surfaces extract what the current page already offers, hand it to UniKart, and let the same parser, confidence scoring, and save endpoint do the rest. A product saved from the Chrome extension should be indistinguishable from one saved by pasting a URL into the web app.

Across every surface we hold to the project constraints:

- Do not bypass anti-bot systems.
- Do not ask for store credentials.
- Do not store payment cards.
- No aggressive or background scraping; respectful, on-demand fetches only.
- Mock or fall back gracefully where a real page cannot be read.

---

## Chrome extension (Manifest V3)

A small Chrome extension that adds a "Save to UniKart" action. The user clicks the toolbar icon (or a context-menu item) on a product page, sees a quick preview in a popup, and saves.

### Minimal permissions

The extension requests the smallest permission set that makes the feature work. We deliberately avoid broad host access and anything that would let the extension read pages the user did not act on.

| Permission | Requested? | Why |
| --- | --- | --- |
| `activeTab` | Yes | Grants temporary access to the current tab **only when the user invokes the extension**. This is the core of the privacy model. |
| `scripting` | Yes | Lets the extension inject the content script on demand to read the current page's metadata. |
| `host_permissions` | Only as needed | Used **only** if a specific feature requires reading a page without a user gesture (not planned for MVP) or talking to the UniKart API origin. Kept to an explicit allowlist, never `<all_urls>`. |
| `tabs` | No | Not requested. We do not need to enumerate or watch the user's tabs. |
| `webNavigation` | No | Not requested. No background page-load monitoring. |
| `storage` | Optional | Only if we cache the signed-in session token / API base URL locally. Scoped to the extension, never page data. |

The defining choice is `activeTab` over broad `host_permissions`. With `activeTab`, the extension can read a page **only after the user clicks the icon**, and only that page. There is no standing permission to read browsing activity. We explicitly do **not** request `<all_urls>`.

### Architecture

```
extension/
  manifest.json        # MV3 manifest: action, minimal permissions, content script registration
  content.js           # reads the current page on user action, returns structured metadata
  popup.html           # the "Save to UniKart" preview UI
  popup.js             # renders preview, calls the UniKart save endpoint
  popup.css            # thin-line, calm styling matching the brand
  background.js        # MV3 service worker: context-menu item, message routing (no scraping loop)
  icons/               # toolbar + store icons (thin-line wheel mark)
```

**`manifest.json`** — Manifest V3. Declares the action (toolbar button), the optional context-menu entry, the MV3 service worker, and the minimal permissions above. Content scripts are injected programmatically via `scripting` on user action rather than auto-run on every page, so the extension stays dormant until invoked.

**Content script (`content.js`)** — Runs only when the user invokes the extension. It reads, in the same priority order as the Phase 3 parser, whatever the current page already exposes in the DOM:

1. **JSON-LD** `schema.org/Product` blocks (`<script type="application/ld+json">`) — name, image, brand, sku, offers (price, priceCurrency, availability).
2. **Open Graph** tags — `og:title`, `og:description`, `og:image`, `og:url`, and product-namespaced tags such as `product:price:amount` / `product:price:currency` where present.
3. **Twitter card** tags — `twitter:title`, `twitter:description`, `twitter:image`.
4. **Common ecommerce meta tags** — `<meta itemprop="price">`, `<link rel="canonical">`, and similar.
5. **Document title** and the primary `og:image`.
6. **Price-like text** — a conservative scan for currency-formatted strings near the title/image as a last hint, clearly marked low confidence.

The content script does no network fetching of its own. It reads the DOM that the browser already rendered for the user and returns a structured object. Nothing leaves the page until the user presses Save.

**Popup (`popup.html` / `popup.js`)** — Shows a compact preview: image, title, detected price and currency, store domain, and a confidence indicator (`high` / `medium` / `low`) mirroring `metadataConfidence`. The user can correct any field before saving (this is the manual-entry fallback, surfaced inline). One primary button: **Save to UniKart**. Optionally, a Spoke (collection) picker.

**Service worker (`background.js`)** — Registers the context-menu item, routes messages between popup and content script, and holds the API base URL. It does **not** poll, crawl, or run any background scraping loop.

### Data flow

```
User clicks "Save to UniKart"
        │
        ▼
content.js extracts metadata from the CURRENT page only
  (JSON-LD → OG → Twitter → ecommerce meta → title/og:image → price-like text)
        │
        ▼
popup shows preview + confidence; user reviews / edits / picks a Spoke
        │
        ▼
popup.js POSTs to the UniKart save endpoint
  Authorization: session token (Phase 1 mock session; Auth.js later)
  body: { title, imageUrl, price, currency, availability, brand, sku,
          canonicalUrl, storeDomain, confidence, rawMetadata }
        │
        ▼
UniKart server re-validates with the Phase 3 parser, stores the Product,
seeds the first PriceSnapshot, and returns the saved product
        │
        ▼
popup confirms "Saved" (calm, brief); deep-link to /products/[id]
```

The extension sends extracted *metadata*, not raw page HTML. The server treats extension input as a hint and re-runs the canonical parser so a product saved via the extension is consistent with one saved by pasting a URL. Authentication uses the same session/token model as the web app — the Phase 1 mock single-user session, structured to swap in Auth.js (NextAuth v5) later. The extension never asks for store credentials and never handles payment data.

### Privacy (Chrome extension)

- **Runs on user action.** No content script runs until the user clicks the icon or context-menu item. `activeTab` enforces this at the browser level.
- **Current page only.** The extension reads the one tab the user invoked it on. It cannot see other tabs or browsing history.
- **No background scraping.** The service worker never crawls or polls. There is no hidden fetch loop.
- **No broad permissions.** No `<all_urls>`, no `tabs`, no `webNavigation`. Host permissions stay on an explicit, minimal allowlist.
- **Data minimization.** Only product metadata for the page the user chose is sent, and only on Save. We do not sell data, and shopping data is treated as sensitive.
- **Transparent.** The popup shows exactly what was detected and lets the user edit before anything is saved.

---

## iOS Share Extension

An iOS Share Extension lets the user save to UniKart from the system share sheet — the same gesture they already use to send a link to Messages or save to a reading app.

### Flow

1. User taps **Share** in Safari, Instagram, TikTok, Amazon, or any app that shares a URL.
2. They choose **UniKart** from the share sheet.
3. The extension receives the shared URL (and any title the host app provides).
4. UniKart parses the URL with the Phase 3 parser (server-side), showing the spinning thin-line wheel loader while it works.
5. A **preview** card appears: image, title, price, store domain, confidence.
6. User reviews, optionally edits or picks a Spoke, and taps **Save**.
7. The product lands in their UniKart, identical to a web or extension save.

### Notes

- The share sheet hands over a **URL** (sometimes a title/image), not full page access. UniKart resolves the rest server-side with respectful, on-demand fetches — the same constraints apply: no anti-bot bypass, no credentials, no aggressive scraping.
- Social sources (Instagram, TikTok) often share a post or short-link rather than a clean product page. When the parser cannot confidently resolve a product, the extension falls back to manual entry with whatever was detected pre-filled, marked low confidence.
- Authentication reuses the app session/token, consistent with the web and Chrome surfaces.
- No payment data, ever, in the share flow.

### Android share-target equivalent

Android achieves the same result through a **share target** (an `intent-filter` for `ACTION_SEND` with `text/plain` / URLs, or the PWA `share_target` manifest member — see below). The user shares a link from Chrome, Instagram, TikTok, or a shopping app, picks UniKart, and gets the same parse → preview → save flow. The web `share_target` route below means the PWA can serve as the Android (and broader) share target without a separate native build.

---

## PWA & Web Share readiness

UniKart ships as a PWA-ready web app so that, before any native build exists, the installed web app can still receive shares on supporting platforms.

### What's in place / planned

| Item | Purpose |
| --- | --- |
| Web app manifest (`manifest.webmanifest`) | Makes UniKart installable; declares name, icons, start URL, display mode. |
| `theme-color` | Sets the browser/OS chrome tint to match the calm UniKart surface. |
| `apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style` / `apple-mobile-web-app-title` | iOS "Add to Home Screen" behavior and standalone presentation. |
| `share_target` (manifest) | Lets the installed PWA appear in the OS share sheet and receive a shared URL/text via a dedicated route. |
| Web Share API readiness | Outbound: lets users share a saved product *out* of UniKart using the native share sheet where available. |

**`share_target` route.** The manifest's `share_target` points at a UniKart route (for example `/share-target`) that accepts the shared `url` / `text` / `title`, runs it through the Phase 3 parser, and shows the same preview → save flow as the web app. This is what makes the PWA usable as the Android share target without a separate native package.

### Web MVP

For the current MVP, none of the share surfaces are required to save a product. The web app supports:

- **Paste a URL** — paste any product link; the parser does the rest, with the wheel loader during parse.
- **Manual add** — enter title, price, image, and store by hand when parsing isn't possible or desired (the parser's manual-entry fallback).

This keeps the MVP self-contained while the manifest, `theme-color`, Apple meta tags, and `share_target` plumbing are put in place to make later extension and share work a small step rather than a rewrite.

---

## Security & trust notes

- **User-initiated only.** Every save path begins with a deliberate user action — a click, a tap, a paste. Nothing reads pages or fetches in the background.
- **Least privilege.** The Chrome extension uses `activeTab` + `scripting` and avoids broad host permissions. The share extensions receive only a URL from the OS, not standing access to apps or pages.
- **No credentials, no payment data.** UniKart never asks for store logins and never stores payment cards. This holds across the extension, share extensions, and PWA.
- **Respectful fetching.** Server-side resolution uses on-demand, polite fetches. We do not bypass anti-bot systems or scrape aggressively. Where a page can't be read, we fall back to manual entry rather than forcing access.
- **Data minimization.** Only the metadata needed to represent a saved product is transmitted, and only at save time. Shopping data is sensitive; UniKart is built around trust.
- **No data sale.** Saved-product and browsing-derived data is never sold. This is stated plainly in Settings and the footer alongside the affiliate disclosure language.
- **Consistent auth.** All surfaces use the same session/token model (Phase 1 mock session, structured for Auth.js / NextAuth v5 later) over HTTPS.
- **Server is the source of truth.** Client-extracted metadata is treated as a hint and re-validated by the canonical parser, so no surface can inject unverified product data.
- **User control.** Privacy-first features carry over: export data, delete account, delete product history. The user can always correct or discard a detected product before it is saved.

---

*Scope reminder: the Chrome extension and the iOS/Android share extensions are planned for Phase 7. A minimal `extension/` folder may be scaffolded then. The current MVP saves products via paste-a-URL and manual add. This document describes intended design, not shipped functionality, and references no real partnerships.*
