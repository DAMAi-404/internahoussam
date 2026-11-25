# Design System: "Mahroussa, iOS-native"

Mahroussa Pro should feel like a native iPhone app with El Mahroussa's own identity: **deep green on warm beige**, the owner's product photos, and nothing generic. It follows Apple's **Human Interface Guidelines (HIG)** for behaviour (sheets, segmented controls, large titles, spring motion), and uses the brand for everything you look at.

> Visual preview (shop, owner, labo, tokens): https://claude.ai/artifact/F55nzxpUY1sDbQFMYRY5QQ (private until shared). If the preview and this file disagree, this file wins.

## 1. Principles

1. **The product is the picture.** Shops recognise products by their photo and name. No decorative icons, no coloured icon tiles, no emoji. Icons appear only where they do a job: back, share, search, the tab bar.
2. **Brand, not template.** Beige paper background, deep green for the single primary action, cream cards. One colour family, used with restraint.
3. **One screen, one job.** A large title says where you are. One green button sits at the bottom, under the thumb.
4. **Tap, don't type.** Quick chips first. Typing a quantity is a fallback the owner enables per product.
5. **Status is a word.** A coloured dot and a word, the same everywhere.
6. **Direct manipulation.** Sheets you drag, chips you tap, toggles you flip. Every touch reacts within 100 ms.
7. **RTL-native.** Arabic is a first-class layout, mirrored like iOS.

## 2. Colour

Palette is **provisional** until the exact brand hex codes or logo arrive (PRD Q12). Every text/background pair below is checked at ≥ 4.5:1.

```css
:root {
  /* brand */
  --green:        #1F5A3D;  /* primary buttons, selected chip, links. White on it = 8.1:1 */
  --green-press:  #164530;
  --green-tint:   #E2ECE3;  /* tinted buttons, selected rows */

  /* beige surfaces */
  --bg:           #F3EDE2;  /* screen background (beige paper) */
  --surface:      #FFFCF6;  /* cards, cells, sheets (cream) */
  --fill:         #E8E0D1;  /* chip/segmented track, photo placeholder */
  --separator:    rgb(74 60 36 / .18);

  /* text (warm, never pure black/grey) */
  --label:        #1C1A15;
  --label-2:      #6A6256;  /* 4.9:1 on --bg, 5.4:1 on --surface */
  --label-3:      #A39A8B;  /* placeholders, disabled only */

  /* status: dot colour / text colour / pill background */
  --pending:  #F08A24;  --pending-text:  #A8360A;  --pending-bg:  #FBE6D4;  /* En attente */
  --ok:       #3FA34D;  --ok-text:       #256B33;  --ok-bg:       #DDEFD9;  /* Acceptée, Prête */
  --refused:  #E5483B;  --refused-text:  #B42318;  --refused-bg:  #FBE1DE;  /* Refusée */
  --prep:     #5B5BD6;  --prep-text:     #3F3F9E;  --prep-bg:     #E4E4F5;  /* En préparation (owner/labo) */
  --warn:     #E0A800;  --warn-text:     #8A5A00;  --warn-bg:     #F8EBC8;  /* Réduite, Partiel */
  --neutral:  #9A948A;  --neutral-text:  #625D55;  --neutral-bg:  #E9E4DA;  /* Annulée, Reçue */
}
```

**Green brand vs green "Acceptée":** both are green on purpose, since green is the brand and green also means "OK". They never get confused because they take different forms: the brand green is a **solid button with cream text**, while "Acceptée" is a **light pill with a dot and a word**. Status colours never fill buttons.

### Labo team themes (LAB-2)

| Team | Theme | Background / cards / text | Header band |
|---|---|---|---|
| **Matin** 04:00–16:00 | Sand (light) | `--bg` / `--surface` / `--label` | `#E9D9B4`, text `#4A3A12`, label "Équipe matin" |
| **Nuit** 16:00–04:00 | Night (dark) | `#12161F` / `#1C2230` / `#F2EEE6`, secondary `#A8A296` | `#262E45`, text `#E6E9F5`, label "Équipe nuit" |

The whole tablet changes look at handover, so anyone in the kitchen sees which team is active from across the room. The dark night theme is also easier on the eyes at 2 a.m. On dark, status text uses the vibrant dot colours, which pass 4.5:1 on `#1C2230`.

### Status mapping

| Status | Token | FR | AR |
|---|---|---|---|
| submitted / in_review | `pending` | En attente | في الانتظار |
| validated | `ok` | Acceptée | مقبولة |
| in_preparation | `ok` (shop) / `prep` (owner, labo) | En préparation | قيد التحضير |
| ready | `ok` | Prête à récupérer | جاهزة للاستلام |
| received | `neutral` | Reçue | تم الاستلام |
| refused | `refused` | Refusée | مرفوضة |
| cancelled | `neutral` | Annulée | ملغاة |

`StatusPill`: `--*-bg` background, 8 px dot in the vibrant colour, word in `--*-text`, 15 pt semibold, height 28, fully rounded. The word carries the meaning, so colour is never the only signal.

## 3. Typography

```css
--font: -apple-system, BlinkMacSystemFont, "Inter", "IBM Plex Sans Arabic", system-ui, sans-serif;
--font-num: ui-rounded, -apple-system, "Inter", sans-serif;   /* quantities, steppers */
```

iPhone renders SF Pro + SF Arabic (the real iOS fonts). Android renders Inter + IBM Plex Sans Arabic, self-hosted and cached. SF files are never shipped, because Apple's licence only allows them on Apple platforms. Digits are Western 0-9 with `tabular-nums`.

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| `largeTitle` | 34 / 41 | 700 | Main screen titles |
| `title1` | 28 / 34 | 700 | Order header, labo shop name |
| `title2` | 22 / 28 | 700 | Sheet product name |
| `title3` | 20 / 25 | 600 | Section headings |
| `headline` | 17 / 22 | 600 | Product names, buttons |
| `body` | 17 / 22 | 400 | Default |
| `subheadline` | 15 / 20 | 400 | Meta |
| `footnote` | 13 / 18 | 400–600 | Section labels, timestamps. **Minimum size.** |

Labo tablet: × 1.25.

## 4. Shape, spacing, depth

- 4 pt grid: `4, 8, 12, 16, 20, 24, 32`. Side margin 16.
- Radius: product card `16`, cells and buttons `12`, sheets `16` (top corners), chips and pills `full`, photos `12`. `corner-shape: squircle` where the browser supports it.
- Hairlines `0.5px` in `--separator`, inset to the text.
- Depth: flat. Translucent bars (`rgb(243 237 226 / .85)` + `backdrop-filter: saturate(180%) blur(20px)`) and sheets (`0 10px 40px rgb(40 30 10 / .18)`). Cards have **no shadow**: cream on beige is enough contrast.

## 5. Layout & touch

| Rule | Phone | Labo tablet |
|---|---|---|
| Min touch target | 44 pt (48 for shop rows) | 64 |
| Primary button | 50 pt, full width, `--green` | 64 pt |
| Navigation | Large title + tab bar | Team header band + order columns |

Tab bars:
- **Shop:** Commander · Mes commandes
- **Owner/deputy:** À valider · En cours · Historique · Catalogue (owner only)

Logical CSS only. Numbers with units go in `<bdi>`.

## 6. Components (`src/components/ui`)

| Component | Spec |
|---|---|
| `CategoryBar` | Horizontal scrolling row of **text chips** under the title. The first chip is "Habituels" (frequently ordered, SHP-10), then the 10 categories in the fixed order. Selected chip = `--green` filled, cream text. Others = `--fill`. 40 pt tall. Sticky under the nav bar while scrolling. **No icons.** |
| `ProductCard` | 2-column grid, `--surface`, radius 16. **Photo on top** (square, radius 12, inset 6). No photo: a `--fill` block with the product's initials in `title2` `--label-2`. Below: name (`headline`, 2 lines max) and the unit hint (`footnote`: "à la pièce", "au poids", "pack 5 L · 10 L"). **In cart:** 2 px `--green` ring + a green badge in the top corner with the quantity (`200`, `10 L × 2`). **Unavailable:** opacity .45, "Indisponible" pill over the photo, not tappable. |
| `Sheet` | Vaul, grabber, detents medium/large, spring `400/40`, `--surface` |
| `QuantitySheet` | Photo + name + hint. **count:** stepper + chips · **weight/volume:** chips (`250 g` `500 g` `1 kg`) + "Autre quantité" → numeric keypad · **pack:** segmented control of active packs + stepper. Green "Ajouter · 500 g". |
| `Stepper` | 56 pt circles in `--fill`, green glyph, value in `--font-num` 44 pt |
| `Chip` | 36–44 pt, `--fill` / selected `--green` with cream text |
| `SegmentedControl` | `--fill` track, cream thumb with a soft shadow. Used for packs, **Accepter / Réduire / Refuser** (selected word takes the status text colour), and team choice. |
| `Toggle` | 51 × 31, on = `--green` |
| `Button` | **filled** `--green` / cream text · **tinted** `--green-tint` / `--green` text · **plain** green text · **destructive** `--refused-text` text or fill. Pressed: opacity .75, scale .98. No ripples. |
| `StatusPill` | §2 |
| `OrderCard` | `--surface`, status pill + time, order code, line count, progress bar (green for shop, prep indigo for owner/labo) |
| `NoteBubble` | Owner/deputy note: `--warn-bg` block, `--warn-text`, author + time in `footnote`. On the tablet a new note pulses once. |
| `HandoverScreen` | Full-screen, team theme preview. Two big team buttons → 4-digit keypad. Blocks the tablet until a team confirms. |
| `Banner` | Top, rounded, translucent: "Commande envoyée", "La boutique a modifié la commande" |
| `ShareButton` | `navigator.share({ text })`, fallback copy + banner |
| `EmptyState` | Title + one sentence + one tinted button. No illustration. |

## 7. Motion & feedback

- Springs (`stiffness 400, damping 40`) for sheets and pushes. 200 ms for small changes.
- Add to cart: the card ring appears and the cart bar count bumps (scale 1 → 1.15 → 1).
- Edge-swipe back implemented for the iOS PWA.
- Haptics on Android only (`vibrate(10)`). iOS relies on visual feedback.
- `prefers-reduced-motion`: fades only.
- Sounds: new-order chime (owner/deputy), repeating labo alarm until acknowledged, short tone for a new owner note.

## 8. PWA polish

`display: standalone`, `theme-color: #F3EDE2` (labo night: `#12161F`), iOS splash screens, a proper icon in brand green. No tap highlight, no text selection on controls, `overscroll-behavior: contain`. Inputs ≥ 16 px. Skeleton cards in `--fill` while loading.

## 9. Content & tone

Short and concrete. No ambiguous verbs ("Recommander" was rejected). Errors say what happened and what to do. No technical terms.

## 10. Accessibility checklist

- [ ] Targets meet §5
- [ ] Text pairs from §2 only (all ≥ 4.5:1)
- [ ] Status shown with a word, never colour alone
- [ ] RTL (ar) and LTR (fr) at 360 px; labo at 1024 × 768 in **both** team themes
- [ ] 200% text size usable
- [ ] Icon-only buttons have `aria-label` in both languages
