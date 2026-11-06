/*
  Cele's birthday garden: ALL content and tuning lives here.
  You never need to edit anything in js/ to change words, pacing or art.

  Times are in seconds at speed 1. `speed` divides every timing:
  2 = everything twice as fast, 0.5 = twice as slow.
*/
window.GARDEN_CONFIG = {
  herName: "Cele",
  picksAllowed: 3,
  // false: "see my day" appears after her first pick (unused picks bloom at the end).
  // true: she has to choose all of them first.
  requireAllPicks: false,
  // false: every reload starts from the blank page. true: a reload returns to where she was.
  rememberProgress: false,
  speed: 1.4,

  // Pacing of the words (seconds, also divided by `speed`).
  pacing: {
    messageLineGap: 1.4, // between chat bubbles on the phone
    typing: 0.9, // the "…" before each bubble
    letterDelay: 1.5, // pause after the final bloom settles, before the letter
    letterLineGap: 1.2, // base time between letter lines (longer lines wait a little more)
    letterPerChar: 0.03, // extra seconds per character of the previous line
  },

  // Colour washed into a card when it is chosen, by pick order (matches the garden hues).
  pickHues: ["#b7cddb", "#a9c79a", "#e8aab6"],

  // Life in the garden. Set any number to 0 to turn that part off.
  fx: {
    petals: 22, // falling during the final bloom
    ambientPetals: 12, // drifting forever after the bloom
    motes: 10, // specks of warm light floating, from the moment the garden appears
    sway: 0.015, // wind in the tree: how far the canopy leans (0 = still, 0.03 = windy)
    swayPivot: [1105, 920], // art point the canopy bends around (top of the trunk)
    colors: ["#e8aab6", "#f1c4cb", "#e4a58e", "#f5d9c4"],
  },

  // ---------------------------------------------------------------- words
  phoneMessage: [
    "Happy birthday, gorgeous.",
    "I made a list for you to choose how we spend your day.",
    "Pick {picks} things you would love to do please.",
  ],

  letter: [
    "My pretty girl,",
    "I hope today you get to enjoy your birthday exactly the way you want to.",
    "Don't forget, this day is about you, it's all yours gorgeous.",
    "I wish I was there with you to share these special moments of your life with you.",
    "This garden means so much to us, and I feel like I'm gonna bring it with me for the rest of my life.",
    "Happy birthday beautiful.",
    "- Pedro",
  ],

  closingLine: "I love you.",

  // Optional. Set to null to hide.
  photo: { src: "assets/images/us.webp", alt: "Pedro and Cele, cheek to cheek", caption: "" }, // caption: a short line under the picture
  // The phone buzzing on the blank page, after her first tap. Set to null for silence
  // (the phone still shakes).
  phoneBuzz: {
    src: "assets/audio/phone-buzz.mp3",
    gap: 3, // seconds of silence between buzzes
    vibrate: true, // also vibrate her real phone along with it (Android only)
  },

  // Optional. Set to null for no music (the sound toggle is hidden too).
  music: {
    src: "assets/audio/el-descanso.m4a",
    volume: 0.6, // 0–1
    fadeIn: 4, // seconds, after her first tap
    fadeOut: 1.5, // seconds, when she leaves the tab
    loopStart: 0, // seconds: where each repeat starts…
    loopEnd: 35, // …and where it jumps back (the song is exactly 35 s)
    loopCrossfade: 0, // seconds of overlap at the loop point (0 = seamless cut)
    swell: 0.25, // 25% louder during the final bloom and the letter (0 = off)
  },

  activities: [
    {
      id: "movie",
      title: "Movie night",
      shortDescription: "Same movie with the same snacks.",
      longDescription: "You choose the movie or show for us to watch together and eat the same snacks. Blankets strongly recommended.",
    },
    {
      id: "cook",
      title: "Dinner together",
      shortDescription: "We cook the same dish and eat together.",
      longDescription: "We choose a recipe that we can cook together in a call at night. Then we eat together, and I get to see your beautiful face while you enjoy the food we made.",
    },
    {
      id: "game",
      title: "Game night",
      shortDescription: "Cool games for us to play",
      longDescription: "You pick a game for us to play together. From Stardew Valley, Puzzle Together, Pixel Paint Together to 20 Small Mazes, or other things",
    },
    {
      id: "paint",
      title: "Paint together",
      shortDescription: "We paint or draw the same thing",
      longDescription: "We can paint in a canvas or papaer, or draw on a paper or digitally, as long as we do it together and the same theme or drawing.",
    },
    {
      id: "cake",
      title: "Something sweet",
      shortDescription: "A birthday treat, delivered to your door.",
      longDescription: "A little sweet surprise from me arrives at your door.",
    },
    {
      id: "flowers",
      title: "Real flowers",
      shortDescription: "A garden you can actually hold.",
      longDescription: "You painted a garden today, so a piece of it could come to you. Flowers delivered to your door, from me.",
    },
    {
      id: "questions",
      title: "Questions night",
      shortDescription: "Deep, silly, and everything else",
      longDescription: "We find or make our own questions and answer them together.",
    },
    {
      id: "songrace",
      title: "Song race",
      shortDescription: "From one song to another, only through recommendations.",
      longDescription: "We start on the same song and race to a target song clicking only on YouTube's recommended videos.",
    },
  ],

  // Every UI label in one place (translate here).
  ui: {
    pageTitle: "Cele's birthday garden",
    tapToBegin: "turn your sound on, then tap anywhere",
    newMessage: "1 new message",
    openMessage: "Open message",
    messageFrom: "Pedro",
    continue: "continue",
    chosen: "chosen",
    picksLeft: "{n} left to choose",
    pickLeftOne: "1 left to choose",
    picksDone: "all chosen",
    choose: "choose this",
    unchoose: "let this go",
    close: "close",
    seeMyDay: "see my day",
    reviewHeading: "Your day",
    changeSomething: "change something",
    confirm: "confirm",
    summaryHeading: "Cele's birthday",
    summaryIntro: "what you chose:",
    send: "send",
    sending: "sending…",
    sent: "sent",
    sendFailed:
      "The message didn't send. Could you take a screenshot of this and send it to me?",
    tryAgain: "try again",
    replay: "watch it bloom again", // shown under the closing line; '' hides it
    muteOn: "Sound on",
    muteOff: "Sound off",
    loadingHint: "",
  },

  // ---------------------------------------------------------------- email
  email: {
    web3formsAccessKey: "f30ac8de-1fb5-4f5b-b8d7-2282b1aea5fa", // get one free at https://web3forms.com
    subject: "Cele's birthday picks",
    fromName: "Birthday garden",
  },

  // ---------------------------------------------------------------- scene
  scene: {
    size: 2048, // art canvas is size x size px
    focal: [0.5, 0.42], // point kept centred when the screen crops the art
    safeArea: [900, 1100], // centred box that is visible on phones AND desktops (for reference)
  },

  // Paper colour when each trigger fires (stage warmth).
  stagePaperTint: {
    start: "#fbfaf8",
    messageOpened: "#fbf9f6",
    choicesShown: "#f9f5ee",
    confirmed: "#f7f1e6",
    letterShown: "#f7f0e4",
    sent: "#f6efe2",
  },
  paper: {
    grainOpacity: 0.55, // strength of the paper texture overlay (0–1)
    grainSize: 220, // CSS px of one grain tile
  },

  // Brush textures for the reveal masks: white-on-transparent PNGs (see README).
  // Leave empty to use procedurally generated brushes.
  brushes: [
    // 'assets/brushes/blot1.png'
  ],

  reveal: {
    maskScale: 0.5, // mask resolution relative to the screen (lower = softer + faster)
    stamps: 70, // brush stamps per reveal (more = finer spread)
    wetEdge: false, // darker rim on fresh paint (subtle shimmer; costs extra GPU work)
    wetStrength: 0.35,
    sketchOpacity: 0.45, // how visible the grey sketch is
    sketchLighten: 0.5, // how much the auto sketch is lightened (0–1)
    sketchDuration: 2.6, // default sketch fade-in time
    drainSlowdown: 1.35, // draining takes this much longer than painting
    crossfadeDuration: 3, // used on low-power devices / reduced motion
  },

  perf: {
    bestTier: "medium", // best quality allowed: 'medium' (smoothest) or 'high' (sharper)
    maxDpr: 1.5, // cap on device pixel ratio for the scene canvas
    maxCanvasPixels: 2000000, // cap on total scene canvas pixels (big desktops)
    maxLoadWait: 15, // seconds; the phone becomes tappable after this regardless
    assetTimeout: 12, // seconds per asset before it counts as failed
  },

  // Placeholder palette (soft, limited, GRIS-like).
  palette: {
    paper: "#f8f5ef",
    ink: "#4f4a47",
    skyTop: "#8fb1c9",
    sky: "#b7cddb",
    skyWarm: "#f1dccb",
    water: "#7ea3bd",
    waterDeep: "#5f86a6",
    hillFar: "#9fb5b5",
    hillFar2: "#8aa7a6",
    hillNear: "#a5c098",
    hillNear2: "#7fa287",
    leaf: "#7fa58a",
    leaf2: "#93b58f",
    leaf3: "#6a917d",
    leafDark: "#557a68",
    grass: "#a9c79a",
    blade: "#7a9e82",
    trunk: "#8a7466",
    trunkDark: "#6b574b",
    rose: "#d99aa0",
    coral: "#e4a58e",
    ochre: "#e2bd73",
    blossom: "#e8aab6",
    light: "#ffd9a8",
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
      sway         1 = moves with the wind in the tree (fx.sway), 0/absent = still
    Triggers: start, messageOpened, choicesShown, pick1…pickN, confirmed, letterShown, sent,
    and act:<activity id> (fires while that activity is chosen; drains if she lets it go).
    Pick triggers above picksAllowed automatically move to 'confirmed'.
    The act: layers are small details tied to each activity; they have no sketch, so they
    only appear in the garden if she chooses that activity.
  */
  layers: [
    {
      id: "sky",
      image: "placeholder:sky",
      sketchOn: "choicesShown",
      colorOn: "pick1",
      delay: 0,
      duration: 6,
      origin: [1180, 300],
      brush: "auto",
      blend: "multiply",
    },
    {
      id: "rainbow",
      image: "placeholder:rainbow",
      sketchOn: null,
      colorOn: "act:paint",
      delay: 1.2,
      duration: 4,
      origin: [1024, 700],
      brush: "auto",
      blend: "normal",
    },
    {
      id: "stars",
      image: "placeholder:stars",
      sketchOn: null,
      colorOn: "act:questions",
      delay: 1.2,
      duration: 3.5,
      origin: [1000, 400],
      brush: "auto",
      blend: "normal",
    },
    {
      id: "moon",
      image: "placeholder:moon",
      sketchOn: null,
      colorOn: "act:questions",
      delay: 1.6,
      duration: 3,
      origin: [700, 330],
      brush: "auto",
      blend: "normal",
    },
    {
      id: "horizon",
      image: "placeholder:horizon",
      sketchOn: "messageOpened",
      colorOn: "confirmed",
      delay: 0,
      duration: 4,
      origin: [1024, 1085],
      brush: "auto",
      blend: "multiply",
      sketchDuration: 3.5,
    },
    {
      id: "farHills",
      image: "placeholder:farHills",
      sketchOn: "choicesShown",
      colorOn: "pick2",
      delay: 0,
      duration: 5,
      origin: [700, 1000],
      brush: "auto",
      blend: "multiply",
      sketchDelay: 0.3,
    },
    {
      id: "water",
      image: "placeholder:water",
      sketchOn: "choicesShown",
      colorOn: "pick1",
      delay: 1.4,
      duration: 5,
      origin: [900, 1160],
      brush: "auto",
      blend: "multiply",
      sketchDelay: 0.5,
    },
    {
      id: "nearHills",
      image: "placeholder:nearHills",
      sketchOn: "choicesShown",
      colorOn: "pick2",
      delay: 1.0,
      duration: 5.5,
      origin: [520, 1500],
      brush: "auto",
      blend: "multiply",
      sketchDelay: 0.7,
    },
    {
      id: "trunk",
      image: "placeholder:trunk",
      sketchOn: "choicesShown",
      colorOn: "pick2",
      delay: 0,
      duration: 4,
      origin: [1100, 1400],
      brush: "auto",
      blend: "multiply",
      sketchDelay: 0.5,
    },
    {
      id: "canopy",
      image: "placeholder:canopy",
      sketchOn: "choicesShown",
      colorOn: "pick2",
      delay: 3.0,
      duration: 5,
      origin: [1110, 640],
      brush: "auto",
      blend: "multiply",
      sketchDelay: 1.1,
      sway: 1,
    },
    {
      id: "lights",
      image: "placeholder:lights",
      sketchOn: null,
      colorOn: "act:movie",
      delay: 1.2,
      duration: 3,
      origin: [1120, 700],
      brush: "auto",
      blend: "normal",
      sway: 1,
    },
    {
      id: "birds",
      image: "placeholder:birds",
      sketchOn: null,
      colorOn: "act:songrace",
      delay: 1.2,
      duration: 2.5,
      origin: [1360, 880],
      brush: "auto",
      blend: "normal",
    },
    {
      id: "grass",
      image: "placeholder:grass",
      sketchOn: "choicesShown",
      colorOn: "pick2",
      delay: 3.0,
      duration: 5,
      origin: [1024, 1700],
      brush: "auto",
      blend: "multiply",
      sketchDelay: 1.3,
    },
    {
      id: "flowers",
      image: "placeholder:flowers",
      sketchOn: "choicesShown",
      colorOn: "pick3",
      delay: 0,
      duration: 5,
      origin: "fromCard",
      brush: "auto",
      blend: "normal",
      sketchDelay: 1.5,
    },
    {
      id: "table",
      image: "placeholder:table",
      sketchOn: null,
      colorOn: "act:cook",
      delay: 1.2,
      duration: 2.5,
      origin: [830, 1400],
      brush: "auto",
      blend: "normal",
    },
    {
      id: "controllers",
      image: "placeholder:controllers",
      sketchOn: null,
      colorOn: "act:game",
      delay: 1.2,
      duration: 2.5,
      origin: [965, 1440],
      brush: "auto",
      blend: "normal",
    },
    {
      id: "cake",
      image: "placeholder:cake",
      sketchOn: null,
      colorOn: "act:cake",
      delay: 1.2,
      duration: 2.5,
      origin: [1250, 1420],
      brush: "auto",
      blend: "normal",
    },
    {
      id: "tulips",
      image: "placeholder:tulips",
      sketchOn: null,
      colorOn: "act:flowers",
      delay: 1.2,
      duration: 2.5,
      origin: [1385, 1340],
      brush: "auto",
      blend: "normal",
    },
    {
      id: "petals",
      image: "placeholder:petals",
      sketchOn: "choicesShown",
      colorOn: "pick3",
      delay: 1.5,
      duration: 5,
      origin: [1110, 600],
      brush: "auto",
      blend: "normal",
      sketchDelay: 1.7,
      sway: 1,
    },
    {
      id: "light",
      image: "placeholder:light",
      sketchOn: null,
      colorOn: "pick3",
      delay: 3.0,
      duration: 6,
      origin: [1500, 380],
      brush: "auto",
      blend: "normal",
    },
  ],
};
