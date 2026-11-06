/*
  Cele's birthday garden: ALL content and tuning lives here.
  You never need to edit anything in js/ to change words, pacing or art.

  Times are in seconds at speed 1. `speed` divides every timing:
  2 = everything twice as fast, 0.5 = twice as slow.
*/
window.GARDEN_CONFIG = {
  herName: 'Cele',
  picksAllowed: 3,
  // false: "see my day" appears after her first pick (unused picks bloom at the end).
  // true: she has to choose all of them first.
  requireAllPicks: false,
  speed: 1,

  // Pacing of the words (seconds, also divided by `speed`).
  pacing: {
    messageLineGap: 1.4,  // between chat bubbles on the phone
    typing: 0.9,          // the "…" before each bubble
    letterDelay: 1.5,     // pause after the final bloom settles, before the letter
    letterLineGap: 1.2,   // base time between letter lines (longer lines wait a little more)
    letterPerChar: 0.03   // extra seconds per character of the previous line
  },

  // Colour washed into a card when it is chosen, by pick order (matches the garden hues).
  pickHues: ['#b7cddb', '#a9c79a', '#e8aab6'],

  // Life in the garden. Set any number to 0 to turn that part off.
  fx: {
    petals: 22,        // falling during the final bloom
    ambientPetals: 6,  // drifting forever after the bloom
    motes: 10,         // specks of warm light floating, from the moment the garden appears
    breathe: 0.04,     // the whole garden slowly drifts and zooms in by up to this much (4%), always
    colors: ['#e8aab6', '#f1c4cb', '#e4a58e', '#f5d9c4']
  },

  // ---------------------------------------------------------------- words
  phoneMessage: [
    'Happy birthday, love.',
    'This year, you choose how we spend your day.',
    'Pick {picks} things you would love to do, and watch what happens.'
  ],

  letter: [
    'My love,',
    'This is a placeholder letter. Every line here fades in on its own.',
    'Write as many lines as you like; each one is its own paragraph.',
    'A short line hits softly.',
    'Happy birthday.',
    '- Pedro'
  ],

  closingLine: 'See you on the 9th. I love you.',

  // Optional. Set to null to hide.
  photo: null, // { src: 'assets/images/us.webp', alt: 'The two of us', caption: 'us, last summer' }
  // Optional. Set to null for no music (the sound toggle is hidden too).
  music: {
    src: 'assets/audio/el-descanso.m4a',
    volume: 0.6,       // 0–1
    fadeIn: 4,         // seconds, after her first tap
    fadeOut: 1.5,      // seconds, when she leaves the tab
    loopStart: 0,      // seconds: where each repeat starts…
    loopEnd: 35,       // …and where it jumps back (the song is exactly 35 s)
    loopCrossfade: 0,  // seconds of overlap at the loop point (0 = seamless cut)
    swell: 0.25        // 25% louder during the final bloom and the letter (0 = off)
  },

  activities: [
    { id: 'breakfast', title: 'Breakfast in bed',
      shortDescription: 'Slow morning, warm coffee.',
      longDescription: 'Pancakes, fruit and coffee brought to you, no alarms, and nowhere we need to be until we want to.' },
    { id: 'picnic', title: 'A picnic in the park',
      shortDescription: 'Blanket, sun, snacks.',
      longDescription: 'A basket with your favourite things, a blanket under a tree, and an afternoon that goes as slow as we want.' },
    { id: 'pottery', title: 'A pottery class',
      shortDescription: 'Make something with our hands.',
      longDescription: 'Clay, wheels and probably a mess. We each make something small to keep and remember the day by.' },
    { id: 'sunset', title: 'Sunset by the water',
      shortDescription: 'Golden hour, together.',
      longDescription: 'We find a quiet spot by the water and watch the sky change colours until the first stars come out.' },
    { id: 'cook', title: 'Cook something new',
      shortDescription: 'A recipe we have never tried.',
      longDescription: 'We pick a recipe neither of us has made, shop for it together, and cook it with music on.' },
    { id: 'books', title: 'Bookstore and café',
      shortDescription: 'Get lost in the shelves.',
      longDescription: 'A slow wander through a bookstore. You pick a book for me and I pick one for you, then cake and coffee.' },
    { id: 'movies', title: 'Blanket-fort movie night',
      shortDescription: 'Pillows, lights, films.',
      longDescription: 'We build a fort out of every blanket in the house, string up little lights and watch your favourite films.' },
    { id: 'stars', title: 'Stargazing',
      shortDescription: 'Somewhere dark and quiet.',
      longDescription: 'We drive out somewhere away from the city lights, bring hot chocolate, and count the stars.' }
  ],

  // Every UI label in one place (translate here).
  ui: {
    pageTitle: "Cele's birthday garden",
    newMessage: '1 new message',
    openMessage: 'Open message',
    messageFrom: 'Pedro',
    continue: 'continue',
    chosen: 'chosen',
    picksLeft: '{n} left to choose',
    pickLeftOne: '1 left to choose',
    picksDone: 'all chosen',
    choose: 'choose this',
    unchoose: 'let this go',
    close: 'close',
    seeMyDay: 'see my day',
    reviewHeading: 'Your day',
    changeSomething: 'change something',
    confirm: 'confirm',
    summaryHeading: "Cele's birthday",
    summaryIntro: 'what you chose:',
    send: 'send',
    sending: 'sending…',
    sent: 'sent',
    sendFailed: "The message didn't go through. Could you take a screenshot of this and send it to me?",
    tryAgain: 'try again',
    replay: 'watch it bloom again', // shown under the closing line; '' hides it
    muteOn: 'Sound on',
    muteOff: 'Sound off',
    loadingHint: ''
  },

  // ---------------------------------------------------------------- email
  email: {
    web3formsAccessKey: 'f30ac8de-1fb5-4f5b-b8d7-2282b1aea5fa', // get one free at https://web3forms.com
    subject: "Cele's birthday picks",
    fromName: 'Birthday garden'
  },

  // ---------------------------------------------------------------- scene
  scene: {
    size: 2048,           // art canvas is size x size px
    focal: [0.5, 0.42],   // point kept centred when the screen crops the art
    safeArea: [900, 1100] // centred box that is visible on phones AND desktops (for reference)
  },

  // Paper colour when each trigger fires (stage warmth).
  stagePaperTint: {
    start: '#fbfaf8',
    messageOpened: '#fbf9f6',
    choicesShown: '#f9f5ee',
    confirmed: '#f7f1e6',
    letterShown: '#f7f0e4',
    sent: '#f6efe2'
  },
  paper: {
    grainOpacity: 0.55, // strength of the paper texture overlay (0–1)
    grainSize: 220      // CSS px of one grain tile
  },

  // Brush textures for the reveal masks: white-on-transparent PNGs (see README).
  // Leave empty to use procedurally generated brushes.
  brushes: [
    // 'assets/brushes/blot1.png'
  ],

  reveal: {
    maskScale: 0.5,        // mask resolution relative to the screen (lower = softer + faster)
    stamps: 70,            // brush stamps per reveal (more = finer spread)
    wetEdge: false,        // darker rim on fresh paint (subtle shimmer; costs extra GPU work)
    wetStrength: 0.35,
    sketchOpacity: 0.45,   // how visible the grey sketch is
    sketchLighten: 0.5,    // how much the auto sketch is lightened (0–1)
    sketchDuration: 2.6,   // default sketch fade-in time
    drainSlowdown: 1.35,   // draining takes this much longer than painting
    crossfadeDuration: 3   // used on low-power devices / reduced motion
  },

  perf: {
    bestTier: 'medium',       // best quality allowed: 'medium' (smoothest) or 'high' (sharper)
    maxDpr: 1.5,             // cap on device pixel ratio for the scene canvas
    maxCanvasPixels: 2000000, // cap on total scene canvas pixels (big desktops)
    maxLoadWait: 15,          // seconds; the phone becomes tappable after this regardless
    assetTimeout: 12          // seconds per asset before it counts as failed
  },

  // Placeholder palette (soft, limited, GRIS-like).
  palette: {
    paper: '#f8f5ef',
    ink: '#4f4a47',
    skyTop: '#8fb1c9',
    sky: '#b7cddb',
    skyWarm: '#f1dccb',
    water: '#7ea3bd',
    waterDeep: '#5f86a6',
    hillFar: '#9fb5b5',
    hillFar2: '#8aa7a6',
    hillNear: '#a5c098',
    hillNear2: '#7fa287',
    leaf: '#7fa58a',
    leaf2: '#93b58f',
    leaf3: '#6a917d',
    leafDark: '#557a68',
    grass: '#a9c79a',
    blade: '#7a9e82',
    trunk: '#8a7466',
    trunkDark: '#6b574b',
    rose: '#d99aa0',
    coral: '#e4a58e',
    ochre: '#e2bd73',
    blossom: '#e8aab6',
    light: '#ffd9a8'
  },

  /*
    The garden: a stack of full-scene layers, bottom to top.
      image        'assets/layers/sky.webp' or 'placeholder:<name>'
      sketchImage  optional hand-made grey version
      sketchOn     trigger that fades in the grey sketch
      colorOn      trigger that paints in the colour
      delay        seconds after colorOn before painting starts
      duration     seconds the paint takes to spread
      sketchDelay / sketchDuration   same, for the sketch fade
      origin       [x, y] in art pixels, 'center', or 'fromCard'
      brush        'auto', or an index into `brushes`
      blend        'multiply' (paint), 'normal', 'screen', 'soft-light'…
      opacity      0–1
    Triggers: start, messageOpened, choicesShown, pick1…pickN, confirmed, letterShown, sent,
    and act:<activity id> (fires while that activity is chosen; drains if she lets it go).
    Pick triggers above picksAllowed automatically move to 'confirmed'.
    The act: layers are small details tied to each activity; they have no sketch, so they
    only appear in the garden if she chooses that activity.
  */
  layers: [
    { id: 'sky',       image: 'placeholder:sky',       sketchOn: 'choicesShown', colorOn: 'pick1',
      delay: 0,   duration: 6,   origin: [1180, 300],  brush: 'auto', blend: 'multiply' },
    { id: 'stars',     image: 'placeholder:stars',     sketchOn: null, colorOn: 'act:stars',
      delay: 1.2, duration: 3.5, origin: [1000, 400],  brush: 'auto', blend: 'normal' },
    { id: 'sun',       image: 'placeholder:sun',       sketchOn: null, colorOn: 'act:breakfast',
      delay: 1.2, duration: 3,   origin: [700, 330],   brush: 'auto', blend: 'normal' },
    { id: 'horizon',   image: 'placeholder:horizon',   sketchOn: 'messageOpened', colorOn: 'confirmed',
      delay: 0,   duration: 4,   origin: [1024, 1085], brush: 'auto', blend: 'multiply', sketchDuration: 3.5 },
    { id: 'farHills',  image: 'placeholder:farHills',  sketchOn: 'choicesShown', colorOn: 'pick2',
      delay: 0,   duration: 5,   origin: [700, 1000],  brush: 'auto', blend: 'multiply', sketchDelay: 0.3 },
    { id: 'water',     image: 'placeholder:water',     sketchOn: 'choicesShown', colorOn: 'pick1',
      delay: 1.4, duration: 5,   origin: [900, 1160],  brush: 'auto', blend: 'multiply', sketchDelay: 0.5 },
    { id: 'sunset',    image: 'placeholder:sunset',    sketchOn: null, colorOn: 'act:sunset',
      delay: 1.2, duration: 4,   origin: [1500, 1080], brush: 'auto', blend: 'normal' },
    { id: 'nearHills', image: 'placeholder:nearHills', sketchOn: 'choicesShown', colorOn: 'pick2',
      delay: 1.0, duration: 5.5, origin: [520, 1500],  brush: 'auto', blend: 'multiply', sketchDelay: 0.7 },
    { id: 'trunk',     image: 'placeholder:trunk',     sketchOn: 'choicesShown', colorOn: 'pick2',
      delay: 0,   duration: 4,   origin: [1100, 1400], brush: 'auto', blend: 'multiply', sketchDelay: 0.5 },
    { id: 'canopy',    image: 'placeholder:canopy',    sketchOn: 'choicesShown', colorOn: 'pick2',
      delay: 3.0, duration: 5,   origin: [1110, 640],  brush: 'auto', blend: 'multiply', sketchDelay: 1.1 },
    { id: 'lights',    image: 'placeholder:lights',    sketchOn: null, colorOn: 'act:movies',
      delay: 1.2, duration: 3,   origin: [1120, 700],  brush: 'auto', blend: 'normal' },
    { id: 'grass',     image: 'placeholder:grass',     sketchOn: 'choicesShown', colorOn: 'pick2',
      delay: 3.0, duration: 5,   origin: [1024, 1700], brush: 'auto', blend: 'multiply', sketchDelay: 1.3 },
    { id: 'flowers',   image: 'placeholder:flowers',   sketchOn: 'choicesShown', colorOn: 'pick3',
      delay: 0,   duration: 5,   origin: 'fromCard',   brush: 'auto', blend: 'normal', sketchDelay: 1.5 },
    { id: 'blanket',   image: 'placeholder:blanket',   sketchOn: null, colorOn: 'act:picnic',
      delay: 1.2, duration: 2.5, origin: [830, 1410],  brush: 'auto', blend: 'normal' },
    { id: 'pot',       image: 'placeholder:pot',       sketchOn: null, colorOn: 'act:pottery',
      delay: 1.2, duration: 2.5, origin: [1000, 1400], brush: 'auto', blend: 'normal' },
    { id: 'books',     image: 'placeholder:books',     sketchOn: null, colorOn: 'act:books',
      delay: 1.2, duration: 2.5, origin: [1240, 1420], brush: 'auto', blend: 'normal' },
    { id: 'veggies',   image: 'placeholder:veggies',   sketchOn: null, colorOn: 'act:cook',
      delay: 1.2, duration: 2.5, origin: [1360, 1330], brush: 'auto', blend: 'normal' },
    { id: 'petals',    image: 'placeholder:petals',    sketchOn: 'choicesShown', colorOn: 'pick3',
      delay: 1.5, duration: 5,   origin: [1110, 600],  brush: 'auto', blend: 'normal', sketchDelay: 1.7 },
    { id: 'light',     image: 'placeholder:light',     sketchOn: null,           colorOn: 'pick3',
      delay: 3.0, duration: 6,   origin: [1500, 380],  brush: 'auto', blend: 'normal' }
  ]
};
