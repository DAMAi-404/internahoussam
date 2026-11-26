# Design System: Mahroussa

An **app**, not a website. Native-feeling phone screens, few words, functional icons, the owner's product photos, and El Mahroussa's colours. Behaviour follows iOS conventions: bottom sheets, steppers, tab bar, spring motion.

> Visual reference: `prototype/index.html` (published: https://claude.ai/artifact/W4cty4yk6mQHQ94L8hDtJ8). It shows the look. Where it differs from this file (it predates v1.0), **this file wins**.

## 1. Principles

1. **If a state can be an icon, it is not a sentence.** Pen = editable. Trash = delete. × = refuse/remove. Note = there is a note. Warning triangle = problem. Undo = restore. **An icon appears only when its action or state exists.**
2. **The default is the common case.** Lines are accepted unless touched. The newest thing that needs attention comes first.
3. **Same size, same place.** Repeated elements (product cards, order cards, line rows) have identical dimensions. State changes what's *inside* them (badge, ring, icon), never their size.
4. **Filters, not pages.** Chips at the top filter one list (catalogue, Suivi, stats).
5. **Each step has its own colour** (§2.2).
6. **Nothing overflows.** Every user text has a length limit and wraps on any character (`overflow-wrap: anywhere`). Long text goes in a bubble card, never inline in a row.
7. **Sheets are always readable.** Sheets, bubbles and dialogs use the light surface in every theme, including the labo night theme.
8. **RTL-native.** Arabic mirrors the layout. Numbers with units stay LTR in `<bdi>`.

## 2. Colour

### 2.1 Brand tokens

```css
:root {
  --sage:       #6BAA75;  /* brand accent, graphic use only (selected chip, done tick) */
  --sage-soft:  #86C08F;  /* small text on ink */
  --sage-mid:   #478153;  /* graphics on paper (progress, step dots) */
  --sage-deep:  #2B6540;  /* green text on paper; primary button (cream text, 6.1:1) */

  --ink:        #1A3524;  /* headers, cart bar, body text on paper */
  --ink-deep:   #0F2117;  /* night team background */
  --ink-soft:   #275238;  /* night team header */

  --cream:      #F5EFE3;  /* cards, sheets; text on dark */
  --paper:      #ECE3D0;  /* app background */
  --paper-deep: #E2D6BE;  /* tracks, disabled */
  --wood:       #B47C4E;  /* attention: new, waiting > 10 min, problems, notes */
  --blush:      #E7C3BC;  /* refused (tints) */

  --muted:      #4E6455;  /* secondary text (5.5:1 on cream, 4.8:1 on paper) */
  --line:       rgb(26 53 36 / .12);
}
```

Rules: `--sage` and `--sage-soft` are never text on paper/cream. The selected chip is `--sage` background with `--ink` text (4.8:1). Primary button: `--sage-deep` with cream text, pressed `--ink`.

### 2.2 Status: one colour per step

| Status | Background / text / dot | Shop label | Owner label |
|---|---|---|---|
| submitted, in_review | `#F2DFC9` / `#7A4A22` / wood | En attente | — |
| validated | `#DCEBD9` / `#2B6540` / sage | Acceptée | Acceptée |
| in_preparation | `#D6E7EA` / `#1F5E6B` / `#3E8A99` | En préparation | En préparation |
| ready | **solid** `#2B6540` / cream / sage-soft | Prête à récupérer | Prête |
| received | `#E2D6BE` / `#5A5243` / `#8F8470` | Livrée | Livrée |
| refused | `#F3D3CC` / `#9B2C1F` / `#D0574A` | Refusée | Refusée |
| cancelled | `#E2D6BE` / `#5A5243` / `#8F8470` | Supprimée | Supprimée |

All pairs ≥ 5.4:1. "Prête" is the only solid pill.

### 2.3 Line state icons (30 px circle before each line)

clock (paper) = waiting · pen (wood tint) = reduced · check (solid sage-deep) = prepared · minus (wood) = partial · ban (blush) = not prepared · × (blush) = refused.

### 2.4 Labo team themes

| Team | Background / cards / text | Header |
|---|---|---|
| Matin | paper / cream / ink | `#DCCBA4`, text `#3E3013`, sun |
| Nuit | `--ink-deep` / `--ink` / cream, secondary `#A9BBA9` | `--ink-soft`, moon |

Sheets, bubbles and dialogs **ignore the team theme**: always cream surface + ink text. This fixes the night-theme bug where sheet text was cream on cream.

## 3. Typography

**Readex Pro** (self-hosted via `@fontsource`), Latin + Arabic in one family. Fallback `"IBM Plex Sans Arabic", system-ui, sans-serif`. Western digits, `tabular-nums`.

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| `title` | 27 / 32 | 600 | Screen title in ink header |
| `title-sm` | 22 / 28 | 600 | Detail title (order code, shop) |
| `sheet` | 21 / 26 | 600 | Sheet title |
| `code` | 18 / 24 | 600 | Order code, shop on cards |
| `body` | 16 / 22 | 500 | Product names in lists, quantities |
| `card` | 15 / 20 | 500 | Product name on cards (2 lines, ellipsis) |
| `meta` | 13 / 18 | 400–500 | Time, counts, section headers |
| `tab` | 11 | 500 | Tab labels (only text below 13) |

## 4. Shape, spacing, depth

Radius: product card 22, photo 16, cards/groups 20, sheets 26 (top), buttons 16, chips/pills/badges full. 4 pt grid, screen padding 16. Flat; shadows only on floating elements (cart bar, "+", badge, toast, sheet, bubble card).

## 5. Layout

| | Phone (all roles) |
|---|---|
| Structure | Ink header (title + bell + filters) → scrolling content → cream tab bar |
| Lists | **Grouped sections**: header in `meta` uppercase with a count, the most urgent section first |
| Targets | Icons ≥ 42 px, rows ≥ 60 px (labo 68), primary button 54 px (labo 58) |

Tab bars:
- **Shop:** Commander · Commandes (badge = ready) · Activité (P1)
- **Owner/deputy:** À valider (badge) · Suivi (badge = ready) · Activité · Catalogue (owner only)
- **Labo:** no tab bar (list → order)

## 6. Components (`src/components/ui`)

| Component | Spec |
|---|---|
| `Header` | Ink. Eyebrow (shop name or role) + title + trailing icons (bell with count, search/back/share as needed). Optional `FilterChips` row. |
| `FilterChips` | Horizontal scroll. Unselected: cream 10% on ink (or paper on light). Selected: sage + ink text. Optional count inside the chip (`Prêtes 2`). |
| `ProductCard` | **Fixed size**: square photo (radius 16) + name (2 lines, fixed height 40). Bottom-end corner of the photo: **"+"** (42 px ink circle). In cart: the "+" is replaced by a **quantity badge** (ink pill, cream text, min 42 px, e.g. `150`, `10 L × 3`, `2 packs`) + 2 px sage-deep ring. Unavailable: 42% opacity + "Indisponible" tag; no "+". |
| `ProductSheet` | Opens from "+", the badge or the card. Photo (72) + name + **description** (muted, max 80 chars, hidden if empty) + quantity control by type: stepper (count/weight/volume, starts at one step) or segmented packs + stepper. Footer: trash (if in cart) + primary "Ajouter · 150" / "Mettre à jour · 150". |
| `Stepper` | 60 px round − / + on paper, value 34 pt between. Long-press repeats (every 120 ms after 400 ms). At the minimum, − becomes trash only where removal makes sense (cart). |
| `CartBar` | Floating ink pill above the tab bar: sage count bubble · "Panier" · chevron. |
| `OrderCard` | Fixed layout: pill + time · code (or shop) + item count · progress bar (if preparing) · trailing **action icons only when allowed** (pen, trash while waiting; note icon if a note exists; warning if a labo problem). Ready: solid green ring + "Reçu" button (shop). |
| `Section` | Group header (`meta`, count) + cards. Collapsible for history ("Terminées", "Prêtes aujourd'hui"). |
| `Steps` | 4 dots Envoyée → Acceptée → Préparation → Prête with times. |
| `LineRow` | State icon · name (1 line, ellipsis) · quantity (original struck through if changed) · trailing icons (note if exists, role actions). |
| `NoteIcon` + `NoteBubble` | Icon shown **only when a note exists** (wood when unread). Tap → **floating bubble card** anchored to the icon (max width 280, cream, shadow, tail): author + time (`meta`), text wrapping on any character. Closes on outside tap or Escape. Several notes stack in one bubble. |
| `NoteSheet` | Write a note: textarea, **live counter** (`42/80`), counter turns wood near the limit, input stops at the limit. |
| `ReviewLine` | Pen / note / × icons. Pen → inline stepper (≤ requested) + check. Refused → blush row + reason + undo. |
| `ProblemSheet` (labo) | Title "Problème · ‹produit› · ‹qty›". Two large option cards with icon + label: **Préparé en partie** / **Pas préparé**. Partial shows the stepper "Préparé : 20 / 40". Reason chips + text (80). "Enregistrer". Light theme always. |
| `ConfirmSheet` | For irreversible actions only (delete order, cancel validated order): title question, destructive button + "Annuler". |
| `Bell` + `NotificationCenter` | Bell with red count. Sheet list grouped Aujourd'hui / Avant: type icon (colour of the related status), one sentence, time, unread dot. Tap → order. "Tout lire" at the top. |
| `InAppBanner` | Top floating ink card for events while the app is open (3 s, tap → order). |
| `StatusPill` | §2.2 |
| `StatTile` | Number (27/600) + label (`meta`) + optional change vs previous period. |
| `BarChart` | Per-day bars in sage-mid, today in sage-deep, values on tap. Axis labels in `meta`. |
| `RankList` | Product/shop rows: name · total in its unit · thin proportional bar. |
| `Handover` | Team cards (sand / dark green) + PIN dots + keypad. Wrong PIN shakes. |
| `Toast` | Ink pill, check icon, 1.8 s. |

## 7. Motion

Sheets slide up (280 ms spring curve). Bubble cards scale from the icon (150 ms). Toasts and banners drop in. Press scale .92 on icons and steppers. Labo alarm pulses until opened. All disabled under `prefers-reduced-motion`.

## 8. Checklist (per screen)

- [ ] Could a sentence be an icon or removed?
- [ ] Do icons appear only when their action or state exists?
- [ ] Do repeated elements keep the same size in every state?
- [ ] Do all user texts have a limit and wrap on any character?
- [ ] Are sheets and bubbles readable in the labo night theme?
- [ ] Is the most urgent item first?
- [ ] RTL (ar) and LTR (fr) at 360 px
