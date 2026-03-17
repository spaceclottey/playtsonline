// main.js — Bootstraps everything and owns game state.
// Wires Player, Spider, Choice, Save, Arcade, and Branches together.
//
// Flow:
//   startGame / resumeGame
//     → _playScene(sceneId)       — push to watched, start video
//     → _beginScene(sceneId)      — arm choices, set up listeners
//     → _armChoice(seconds)       — show UI, start spider timer
//     → _handleChoice(color)      — resolve choice, chain speedrun if needed
//     → _playScene(next)          — recurse for next scene

// ---------------------------------------------------------------------------
// Game state (all in one place — never mutated outside this file)
// ---------------------------------------------------------------------------

let watched = [];          // All scenes played (last = current)
let currentScene = null;
let nextGreen = null;
let nextRed = null;
let choiceArmed = false;

// Speedrun queue: scenes waiting to play before the user's chosen scene
let _queue = [];

// Active timeupdate listeners (kept so they can be removed cleanly)
let _countdownListener = null;
let _fakeChoiceListener = null;

// ---------------------------------------------------------------------------
// Display labels for scenes (PLACEHOLDER: replace with real copy)
// ---------------------------------------------------------------------------

const SCENE_LABELS = {
  cup:                        'Take the cup',
  paperTowel:                 'Take the paper towel',
  NikoActsAsLucia:            'Niko acts as Lucia',
  AngieActsAsLucia:           'Angie acts as Lucia',
  giveCigarrette:             'Give the cigarette',
  dontGiveCigarrette:         "Don't give the cigarette",
  speakWithAngie:             'Speak with Angie',
  playWithLucia:              'Play with Lucia',
  accept:                     'Accept',
  reject:                     'Reject',
  failBlackmail:              'Try to blackmail',
  winBlackmail_destruction:   'Blackmail — destruction',
  failManipulate_racism:      'Try to manipulate',
  winManipulate_platonic:     'Manipulate — platonic',
  dontSpeakWithAngie_dropout: "Don't speak — drop out",
  accept_speedrun:            'Accept',
  reject_speedrun:            'Reject',
  god:                        'God route',
  heist:                      'Heist route',
};

function _label(sceneId) {
  return SCENE_LABELS[sceneId] || sceneId;
}

// ---------------------------------------------------------------------------
// Listener cleanup
// ---------------------------------------------------------------------------

function _removeListener(fn) {
  if (!fn) return;
  const v = Player.getVideoElement();
  if (v) v.removeEventListener('timeupdate', fn);
}

function _clearListeners() {
  _removeListener(_countdownListener);
  _removeListener(_fakeChoiceListener);
  _countdownListener = null;
  _fakeChoiceListener = null;
}

// ---------------------------------------------------------------------------
// Scene lifecycle
// ---------------------------------------------------------------------------

/**
 * Adds sceneId to watched, starts the video, then sets up choices.
 * Does NOT add to watched if it's already the last element (idempotent).
 */
function _playScene(sceneId) {
  if (watched[watched.length - 1] !== sceneId) {
    watched.push(sceneId);
  }
  Player.transitionTo(sceneId);
  _beginScene(sceneId);
}

/**
 * Sets up choice logic for the given (now-playing) scene.
 * Called once per scene after watched is updated.
 */
function _beginScene(sceneId) {
  currentScene = sceneId;
  choiceArmed = false;
  Player.setChoiceActive(false);
  _clearListeners();

  Save.saveState(watched);
  Arcade.updatePlayCode(Save.encodePlayCode(watched));

  if (Branches.isTerminal(sceneId)) {
    // Terminal scene: may have fake choices but no real branching
    if (Branches.hasFakeChoices(sceneId)) {
      _setupFakeChoiceListener(sceneId);
    }
    return;
  }

  const [g, r] = Branches.getNextChoices(watched);
  nextGreen = g;
  nextRed = r;
  Player.preloadNextScenes(g, r);

  const sceneData = Branches.SCENES[sceneId];
  const duration = sceneData ? sceneData.duration : 1;
  const mode = Branches.getChoiceMode(watched, g, r);

  if (duration === 0 || mode === 'unfilmed') {
    // No video or unfilmed: show choice UI immediately
    _armChoice(duration === 0 ? 25 : 25);
  } else {
    // Filmed/fixed: trigger countdown 10 s before video ends
    _setupCountdownListener();
  }

  if (Branches.hasFakeChoices(sceneId)) {
    _setupFakeChoiceListener(sceneId);
  }
}

function _setupCountdownListener() {
  const video = Player.getVideoElement();
  if (!video) return;

  _countdownListener = function () {
    if (choiceArmed) return;
    const remaining = video.duration - video.currentTime;
    if (isFinite(remaining) && remaining > 0 && remaining <= 10) {
      _armChoice(10);
    }
  };
  video.addEventListener('timeupdate', _countdownListener);
}

function _setupFakeChoiceListener(sceneId) {
  const video = Player.getVideoElement();
  if (!video) return;

  const fakeChoices = Branches.getFakeChoices(sceneId);
  const used = new Set();

  _fakeChoiceListener = function () {
    const t = video.currentTime;
    for (const fc of fakeChoices) {
      if (!used.has(fc.timestamp) && Math.abs(t - fc.timestamp) < 0.5) {
        used.add(fc.timestamp);
        Choice.showFake(fc.greenLabel, fc.redLabel);
        Player.setChoiceActive(true);
        Spider.startCountdown(() => {
          // Fake choice resolves with no scene change
          Choice.hideChoice();
          Player.setChoiceActive(false);
        }, 10);
      }
    }
  };
  video.addEventListener('timeupdate', _fakeChoiceListener);
}

function _armChoice(countdownSeconds) {
  if (choiceArmed) return;
  choiceArmed = true;
  Player.setChoiceActive(true);

  // Remove the timeupdate countdown listener — no longer needed
  _removeListener(_countdownListener);
  _countdownListener = null;

  Arcade.onChoiceActive(); // mobile: scroll buttons into view

  const mode = Branches.getChoiceMode(watched, nextGreen, nextRed);
  const gl = _label(nextGreen);
  const rl = _label(nextRed);

  if (mode === 'unfilmed') {
    Arcade.showScreen('screen-unfilmed');
    Choice.showUnfilmed(nextGreen, nextRed, gl, rl, _handleChoice);
  } else {
    // Fixed or filmed — video stays visible, buttons activate
    Choice.showFixed(gl, rl, _handleChoice);
  }

  Spider.startCountdown((autoColor) => _handleChoice(autoColor), countdownSeconds);
}

function _handleChoice(color) {
  if (!choiceArmed) return; // guard double-fire
  choiceArmed = false;

  Choice.hideChoice();
  Spider.stopCountdown();
  Player.setChoiceActive(false);

  // Return to video screen if we showed unfilmed panels
  Arcade.showScreen('screen-video');

  const chosenId = color === 'green' ? nextGreen : nextRed;
  if (!chosenId) return;

  // Insert any speedrun bridge scenes before the chosen scene
  const prefix = Branches.getSpeedrunPrefix(currentScene, chosenId);
  if (prefix.length > 0) {
    _queue = [...prefix, chosenId];
    _drainQueue();
  } else {
    _playScene(chosenId);
  }
}

// ---------------------------------------------------------------------------
// Speedrun queue
// ---------------------------------------------------------------------------

/**
 * Plays the next scene in _queue.
 * Non-final scenes in the queue skip choice setup and just chain via 'ended'.
 */
function _drainQueue() {
  if (_queue.length === 0) return;
  const next = _queue.shift();

  if (watched[watched.length - 1] !== next) watched.push(next);
  currentScene = next;
  Save.saveState(watched);
  Arcade.updatePlayCode(Save.encodePlayCode(watched));
  Player.transitionTo(next);

  if (_queue.length > 0) {
    // More items — wire a one-shot ended listener to advance queue
    const video = Player.getVideoElement();
    const onEnded = () => {
      video.removeEventListener('ended', onEnded);
      _drainQueue();
    };
    video && video.addEventListener('ended', onEnded);
  } else {
    // This is the final (user-chosen) scene — full setup
    _beginScene(next);
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function startGame() {
  watched = ['start'];
  _queue = [];
  Player.setChoiceActive(false);
  Spider.stopCountdown();
  Choice.hideChoice();

  Save.saveState(watched);
  Arcade.updatePlayCode(Save.encodePlayCode(watched));
  Arcade.showScreen('screen-video');

  // Theme song
  const theme = document.getElementById('audio-theme');
  if (theme) theme.play().catch(() => {});

  // 'start' has duration 0 — no video file needed; arm choice immediately
  currentScene = 'start';
  const [g, r] = Branches.getNextChoices(watched);
  nextGreen = g;
  nextRed = r;
  Player.preloadNextScenes(g, r);

  // Try to load start.mp4 in case it exists (opening animation)
  Player.loadScene('start');
  _armChoice(25);
}

function resumeGame(watchedArray) {
  watched = [...watchedArray];
  _queue = [];
  currentScene = watched[watched.length - 1];
  Player.setChoiceActive(false);
  Spider.stopCountdown();
  Choice.hideChoice();

  Save.saveState(watched);
  Arcade.updatePlayCode(Save.encodePlayCode(watched));
  Arcade.showScreen('screen-video');

  Player.loadScene(currentScene);
  _beginScene(currentScene);
}

function handleLoadCode(code) {
  const decoded = Save.decodePlayCode(code);
  if (!decoded) {
    // Show error inside the screen prompt
    const input = document.getElementById('resume-code-input');
    if (input) {
      input.style.borderColor = '#ff2222';
      setTimeout(() => { input.style.borderColor = ''; }, 1500);
    }
    return;
  }
  resumeGame(decoded);
}

// ---------------------------------------------------------------------------
// scene-ended fallback (if video ends before choice is made)
// ---------------------------------------------------------------------------

window.addEventListener('tethersnipe:scene-ended', (e) => {
  // Ignore if queue is running (it has its own ended listeners)
  if (_queue.length > 0) return;
  // Ignore terminal scenes
  if (Branches.isTerminal(e.detail.sceneId)) return;
  // Auto-select red if choice was armed but not acted on
  if (choiceArmed) {
    _handleChoice('red');
  }
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Content Loaded")
  Player.init();
  // Spider.init();
  Choice.init();

  Arcade.init({
    onPlay:     () => startGame(),
    onTrailer:  () => Arcade.showTrailer(),
    onResume:   () => {
      const saved = Save.loadStateFromStorage();
      if (saved) {
        resumeGame(saved);
      } else {
        Arcade.showCodePrompt();
      }
    },
    onLoadCode: (code) => handleLoadCode(code),
  });

  // Show RESUME button only if a save exists
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) {
    resumeBtn.style.display = Save.loadStateFromStorage() ? '' : 'none';
  }
});

// Expose debug helpers to console for local testing
if (typeof window !== 'undefined') {
  window.startGame = startGame;
  window.resumeGame = resumeGame;
  window._playScene = _playScene;
  window._beginScene = _beginScene;
}

