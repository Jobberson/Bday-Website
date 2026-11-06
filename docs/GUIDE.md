# Guide: editing, deploying and debugging the garden

Everything you need to change the words, the activities, the music and the look, put
the site online, and test it. For what the project is, see the [README](../README.md).

**All words, pacing, colours and content live in [`config.js`](../config.js).** You never
need to touch anything in `js/` to change what she sees.

- [Run it locally](#run-it-locally)
- [Before her birthday: checklist](#before-her-birthday-checklist)
- [Editing config.js](#editing-configjs)
- [The art](#the-art)
- [Deploy to GitHub Pages](#deploy-to-github-pages)
- [Debug panel](#debug-panel)
- [Project structure](#project-structure)

---

## Run it locally

```bash
python -m http.server 8765
```

Then open <http://localhost:8765>. Opening `index.html` directly from the folder also
works (music uses a simpler fallback there). Every reload starts over from the blank page
unless `rememberProgress` is `true`.

Useful additions to the address:

| Address | What it does |
|---|---|
| `?debug` | Opens the developer panel (see [Debug panel](#debug-panel)) |
| `?reset` | Clears saved progress (only matters if `rememberProgress` is `true`) |

---

## Before her birthday: checklist

- [ ] Write the content in `config.js`: `phoneMessage`, `letter`, `closingLine`, `activities`.
- [ ] Optional: add a photo (`photo`) for the polaroid under the letter.
- [ ] Send yourself one real test email from the deployed site (from a normal browser).
- [ ] Run `python tools/garden_tools.py check` (asset paths must match exactly, see below).
- [ ] Commit and push, wait a minute for GitHub Pages, then **test on an iPhone**:
      sound, buzz, music after **continue**, the reveals, the letter, sending.
- [ ] Send her the link.

---

## Editing `config.js`

### Words

| Setting | What it is |
|---|---|
| `herName` | Used in the summary heading and the email |
| `phoneMessage` | The chat bubbles on the phone, one per line. `{picks}` becomes the number of picks, `{name}` her name |
| `letter` | The letter, one paragraph per line. Each line fades in on its own |
| `closingLine` | The last line, shown after sending |
| `ui` | Every button and label (`continue`, `see my day`, `confirm`, the send messages…) |

### Activities

```js
{ id: 'picnic', title: 'A picnic in the park',
  shortDescription: 'Blanket, sun, snacks.',              // on the card
  longDescription: 'A basket with your favourite…' }      // in the detail sheet
```

- `id` must be unique and should stay simple (lowercase, no spaces). It links the
  activity to its detail in the garden.
- `picksAllowed` (default 3) is how many she can choose.
- `requireAllPicks: false` shows **see my day** after her first pick. Picks she doesn't
  use still bloom at the end, so the garden always finishes fully colored.

**Garden details.** Each activity can paint a small detail into the garden when chosen.
That's a layer whose `colorOn` is `'act:<activity id>'`:

```js
{ id: 'blanket', image: 'placeholder:blanket', sketchOn: null, colorOn: 'act:picnic', … }
```

The current details are `stars`, `sun`, `sunset`, `lights`, `blanket`, `pot`, `books`
and `veggies`. If you rename an activity's `id`, update its layer's `colorOn` too (the
browser console warns you if one doesn't match).

### Photo, music and the phone buzz

```js
photo: { src: 'assets/images/us.webp', alt: 'The two of us', caption: 'us, last summer' },
```

- **Photo**: square-ish works best (it's cropped square). Keep it under ~300 KB (WebP or JPG).
- **`music`**: `src`, `volume`, `fadeIn`, `fadeOut`, `loopStart` / `loopEnd` (seconds),
  `loopCrossfade` (0 = seamless cut), `swell` (extra loudness during the bloom and the letter).
  Use `.m4a` (AAC) or `.mp3`, never WAV (far too big). Songs up to 2 minutes are loaded
  into memory for perfectly gapless loops; longer ones are streamed.
- **`phoneBuzz`**: the buzz on the blank page, `gap` seconds of silence between buzzes.
  `vibrate: true` also vibrates her real phone (Android only).
- Set `music` or `phoneBuzz` to `null` to turn them off.

> Browsers block all sound until the visitor taps once. That's why the page starts with
> "tap anywhere".

### Email (Web3Forms)

```js
email: { web3formsAccessKey: '…', subject: "Cele's birthday picks", fromName: 'Birthday garden' }
```

Get a free key at [web3forms.com](https://web3forms.com); the email goes to the address
you signed up with. The key is meant to be public in website code. You can restrict it
to your site's address in the Web3Forms dashboard.

Web3Forms rejects automated/headless browsers, so always test sending from a normal browser.

### Behaviour and pacing

| Setting | Default | What it does |
|---|---|---|
| `rememberProgress` | `false` | `true`: a reload returns to where she was (and blocks a second send) |
| `speed` | `1` | Global speed of every animation: `2` = twice as fast |
| `pacing` | | Seconds between chat bubbles, letter lines, the pause before the letter |
| `pickHues` | | Colour washed into a card when chosen, by pick order |
| `fx.petals` | `22` | Petals falling during the final bloom |
| `fx.ambientPetals` | `6` | Petals drifting forever after the bloom |
| `fx.motes` | `10` | Floating specks of light |
| `fx.sway` | `0.015` | Wind in the tree (`0` = still, `0.03` = windy) |
| `stagePaperTint` | | Paper colour at each step (it slowly warms) |
| `palette` | | Colours of the generated watercolor art |

### Quality and performance

The site measures the device during the blank page (invisibly) and picks a quality:

- **medium** (default best): watercolor reveal at screen resolution
- **crossfade**: soft fades, for slow devices and for **reduce motion** settings

`perf.bestTier: 'high'` allows a sharper tier on fast devices. `reveal` holds the brush
reveal tuning (`maskScale`, `stamps`, `sketchOpacity`…).

> **Reduce motion**: if the device asks for less motion (Windows: *Settings →
> Accessibility → Visual effects → Animation effects* off; iPhone: *Reduce Motion*), the
> site respects it: no sway, petals or floating light, and fades instead of painting.

---

## The art

The garden is a stack of full-screen layers, bottom to top, in `config.layers`. Right
now every layer is painted by code (`image: 'placeholder:<name>'`, see
`js/placeholder.js`). To use your own art, export each layer and change its `image` path.

| Layer setting | Meaning |
|---|---|
| `image` | `'assets/layers/sky.webp'` or `'placeholder:<name>'` |
| `sketchImage` | Optional hand-made grey version (otherwise generated from the color) |
| `sketchOn` | Trigger that fades in the grey sketch (`null` = no sketch) |
| `colorOn` | Trigger that paints in the color |
| `delay` / `duration` | Seconds after the trigger / seconds the paint takes to spread |
| `origin` | Where the paint starts: `[x, y]` in art pixels, `'center'`, or `'fromCard'` |
| `blend` | `'multiply'` (paint), `'normal'`, `'screen'`… |
| `sway` | `1` = moves with the wind in the tree |

**Triggers:** `start`, `messageOpened`, `choicesShown`, `pick1`…`pickN`, `act:<activity id>`,
`confirmed`, `letterShown`, `sent`.

### Export specs

- **2048 × 2048 px**, transparent background, color only (no paper texture: it's added on top).
- **Safe area**: the screen crops the square differently on phones and desktops. Keep
  important things inside the centered **900 × 1100** box around the focal point
  (`scene.focal`, default `[0.5, 0.42]`), roughly x 574–1474, y 310–1410.
- **WebP, quality ~80, 200–500 KB per layer.** Convert PNG exports with:

  ```bash
  python -m pip install pillow
  python tools/garden_tools.py layers path/to/png_exports
  ```

### Brushes

The paint spreads through brush stamps. By default they're generated, but you can use
scans of real paint: photograph blots/strokes on white paper, then

```bash
python tools/garden_tools.py brushes path/to/scans
```

and list the results in `config.brushes` (e.g. `'assets/brushes/blot1.png'`).

---

## Deploy to GitHub Pages

1. Push to `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch →
   `main` / `(root)`**.
3. After a minute the site is at `https://<user>.github.io/<repo>/`.

Before each deploy:

```bash
python tools/garden_tools.py check
```

GitHub Pages is **case-sensitive** and Windows isn't: `Sky.webp` vs `sky.webp` works on
your PC and breaks online. The check compares every path in `config.js` with the real
files, letter by letter. (The `?debug` panel also lists any file that failed to load.)

After pushing, do a hard reload (Ctrl+Shift+R, or close and reopen the tab on a phone):
browsers and GitHub Pages cache files for a few minutes.

---

## Debug panel

Open the site with `?debug`. The panel (bottom right, collapsible) has:

- **Stats**: frame rate, dropped frames, canvas size, memory estimate, chosen quality.
- **Speed** slider for every animation.
- **Triggers**: fire or undo any trigger, add or remove picks, replay the whole bloom.
- **Origin**: tap the scene to choose where the next paint starts.
- **Stage**: jump to any step of the story (the screens follow), or reset everything.
- **Quality tier**: switch between high, medium and crossfade.
- **Assets**: any file that failed to load and what replaced it.

Address shortcuts for tuning: `?debug&collapsed&speed=0.5&tier=medium&instant=choicesShown,pick1&fire=pick2,pick3&gap=3`.

---

## Project structure

```
index.html            the page
config.js             ALL content and tuning
css/main.css          styles
js/
  util.js             helpers (easing, random, noise, storage)
  config-resolve.js   fills defaults, validates config.js
  state.js            saved progress
  loader.js           preloads assets (never hangs: per-file timeout, 15 s max wait)
  brushes.js          brush stamps (generated or from files)
  placeholder.js      the generated watercolor art
  paper.js            paper grain and tint
  scene.js            the single canvas: layers, watercolor reveals, wind
  bench.js            the invisible speed test on the blank page
  triggers.js         story moments → layer reveals
  audio.js            music, phone buzz, fades
  fx.js               petals and floating light
  send.js             Web3Forms email
  cards.js            activity cards and detail sheet
  flow.js             the story, screen by screen
  debug.js            ?debug panel
  main.js             start-up
tools/garden_tools.py offline helpers: check, brushes, layers
assets/               layers/, brushes/, images/, audio/
docs/                 this guide, and the README images
```
