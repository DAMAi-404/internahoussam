# Design System: "Mahroussa"

An app, not a website: native-feeling screens, few words, functional icons, the owner's product photos, and El Mahroussa's own colours (sage green, dark green ink, warm paper). Behaviour follows iOS conventions: bottom sheets, steppers, tab bar, spring motion.

> **Reference implementation:** `prototype/index.html`, a clickable prototype of all three roles. Published copy: https://claude.ai/artifact/W4cty4yk6mQHQ94L8hDtJ8 (private until shared). If the prototype and this file disagree, ask.

## 1. Principles

1. **If a state can be an icon, it is not a sentence.** A pen appears only when something can be edited. × refuses or removes. A note icon opens a note. Undo restores. No "Vous pouvez encore modifier…" text.
2. **The default is the common case.** Lines are accepted unless the owner touches them. "+" adds the owner's step. Nothing asks for confirmation that can be undone.
3. **Filters, not pages.** The shop catalogue is one screen with filter chips (Tout · Habituels · 10 categories) and search behind an icon.
4. **The product is the picture.** Owner photos on the cards. No decorative icons, no per-category icons, no emoji.
5. **Each step has its own colour.** Waiting, accepted, preparing, ready, received and refused never share a colour.
6. **Few words, big targets.** Product name, quantity, status. Labels are one or two words.
7. **RTL-native.** Arabic mirrors the layout; numbers with units stay LTR in `<bdi>`.

## 2. Colour (brand)

```css
:root {
  /* green: brand accent and its derivatives */
  --sage:       #6BAA75;  /* brand colour: selected chip, done tick, highlights (graphic use) */
  --sage-soft:  #86C08F;  /* eyebrow text on ink */
  --sage-mid:   #478153;  /* graphic use on paper (progress, step dots) */
  --sage-deep:  #2B6540;  /* text-safe on paper; primary buttons (cream text) */

  /* dark surface: the same green pushed down, never black or navy */
  --ink:        #1A3524;  /* headers, cart bar, steppers, body text on paper */
  --ink-deep:   #0F2117;  /* night team background */
  --ink-soft:   #275238;  /* night team header, secondary dark */

  /* warm paper half (deliberately not greened) */
  --cream:      #F5EFE3;  /* cards, sheets, text on dark */
  --paper:      #ECE3D0;  /* app background */
  --paper-deep: #E2D6BE;  /* disabled, tracks */
  --wood:       #B47C4E;  /* waiting, alerts, notes */
  --blush:      #E7C3BC;  /* refused (tints) */

  --muted:      #4E6455;  /* secondary text: 5.5:1 on cream, 4.8:1 on paper */
  --line:       rgb(26 53 36 / .12);
}
```

Usage rules:
- **Primary button:** `--sage-deep` with cream text (6.1:1). Pressed: `--ink`.
- **Headers, cart bar, steppers:** `--ink` with cream text. The selected filter chip is `--sage` with ink text (4.8:1).
- `--sage` and `--sage-soft` are never used for text on paper or cream (too light). Use `--sage-deep` for green text.

### Status: one colour per step

| Status | Pill background / text / dot | FR | AR |
|---|---|---|---|
| submitted, in_review | `#F2DFC9` / `#7A4A22` / wood | En attente | في الانتظار |
| validated | `#DCEBD9` / `#2B6540` / sage | Acceptée | مقبولة |
| in_preparation | `#D6E7EA` / `#1F5E6B` / `#3E8A99` | En préparation | قيد التحضير |
| ready | **solid** `#2B6540` / cream / sage-soft | Prête | جاهزة |
| received, cancelled | `#E2D6BE` / `#5A5243` / `#8F8470` | Reçue / Annulée | مستلمة / ملغاة |
| refused | `#F3D3CC` / `#9B2C1F` / `#D0574A` | Refusée | مرفوضة |

All text/background pairs are ≥ 5.4:1. "Prête" is the only solid pill, so the order to collect stands out in any list.

### Line state icons (shop and owner views)

A 30 px circle in front of each line. Clock = waiting · pen (wood) = reduced by the owner · check (solid green) = prepared · minus (wood) = partial · ban (blush) = not prepared · × (blush) = refused.

### Labo team themes

| Team | Background / cards / text | Header |
|---|---|---|
| **Matin** 04:00–16:00 | paper / cream / ink | `#DCCBA4` sand, text `#3E3013`, sun icon |
| **Nuit** 16:00–04:00 | `--ink-deep` / `--ink` / cream, secondary `#A9BBA9` | `--ink-soft`, moon icon |

The handover screen (team picker + 4-digit PIN) blocks the tablet at 04:00 and 16:00.

## 3. Typography

**Readex Pro** (Google Fonts, self-hosted in the app) covers Latin and Arabic in one family with matching metrics, and has more character than a system font. Weights: 300, 400, 500, 600, 700. Fallback: `"IBM Plex Sans Arabic", system-ui, sans-serif`. Digits are Western with `tabular-nums`.

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| `title` | 27 / 32 | 600 | Screen title in the ink header |
| `title-sm` | 22–23 / 28 | 600 | Detail screen title (order code, shop name) |
| `sheet` | 21 / 26 | 600 | Sheet title |
| `code` | 18–21 / 24 | 600 | Order code, shop name on cards |
| `body` | 16 / 22 | 500 | Product names in lists, quantities |
| `card` | 15 / 20 | 500 | Product name on cards (2 lines max) |
| `meta` | 13 / 18 | 400–500 | Time, counts, eyebrow |
| `tab` | 11 | 500 | Tab bar labels (the only text below 13) |

Labo: names 19, quantities 20, shop 25.

## 4. Shape & depth

- Radius: product card 22, art 16, order cards and groups 20, sheets 26 (top), buttons 16, chips and pills full.
- Depth: flat. Shadows only on floating elements (cart bar, "+" button, toast, sheet).
- 4 pt grid; screen padding 16.

## 5. Layout

| | Phone (shop, owner) | Labo tablet |
|---|---|---|
| Structure | Ink header (title + filters) → scrolling content → cream tab bar | Team header → order columns (auto-fill ≥ 310 px) |
| Touch targets | ≥ 42 px icons, 54 px primary | ≥ 44 px ticks in 66 px rows, 62 px close |

Tab bars:
- **Shop:** Commander · Commandes (badge = ready orders)
- **Owner/deputy:** À valider (badge) · En cours (green badge = ready) · Catalogue

## 6. Components

| Component | Spec |
|---|---|
| `FilterChips` | Horizontal scroll in the ink header. Unselected: cream at 10% opacity. Selected: `--sage` with ink text. |
| `ProductCard` | Cream, radius 22, photo square on top, name (2 lines). **"+"** = 42 px ink circle over the photo corner. In cart: green ring + inline **stepper** (ink pill: − qty +, − turns into trash at the minimum). Pack products: the pill shows `10 L × 2 · 5 L × 1` and opens the pack sheet. Unavailable: 42% opacity + "Indisponible" tag. |
| `PackSheet` | Photo + name, segmented control of **active** packs, big stepper, button labelled with the result (`10 L × 2`). |
| `CartBar` | Floating ink pill above the tab bar: count bubble (sage) · "Panier" · chevron. |
| `Cart` | Full-screen: lines with photo, name, compact stepper; note icon in the header toggles the note field; "Envoyer · n". |
| `OrderCard` | Pill + time · code + item count (box icon) · progress bar while preparing · **pen icon only if editable** · "Reçu" button when ready. |
| `Steps` | 4-dot progress (Envoyée → Acceptée → Préparation → Prête) with times under each. Replaces the text timeline. |
| `ReviewLine` | Name + quantity + icons **pen / note / ×**. Pen → inline stepper (≤ requested) + check. Refused → blush row, reason, undo icon. Changed by the shop → light green row. |
| `ReviewFooter` | Team segmented (sun Matin / moon Nuit) + note icon (order note for labo) + "Envoyer au labo". |
| `StatusPill` | §2 |
| `NoteBubble` | Wood-tint bubble with note icon. On the tablet a new note gets a wood ring until acknowledged. |
| `LaboLine` | Tap the row = done/undo. "…" opens the partial / not-done sheet (preset reasons + free text, required). |
| `Handover` | Two team cards (sand / dark green) + PIN dots + keypad. Wrong PIN shakes. |
| `Toast` | Ink pill at the top with a check, 1.8 s. |

## 7. Motion

Sheets slide up (280 ms, ease-out spring curve). Toasts drop in. Steppers and icon buttons scale to .92 on press. Labo alarm pulses until acknowledged. All of this is disabled under `prefers-reduced-motion`.

## 8. Checklist (per screen)

- [ ] Could any sentence be an icon or removed?
- [ ] One primary action, at the bottom
- [ ] Status colours from §2 only
- [ ] RTL (ar) and LTR (fr) at 360 px; labo in both team themes
- [ ] Icon-only buttons have `aria-label` in both languages
