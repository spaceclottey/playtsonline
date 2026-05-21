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

// Last-5-seconds urgency: throb intensifies + once-per-second beep
let _urgentTimeout = null;
let _beepInterval = null;

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

  // Demo-end scene: skip choices entirely. When the video ends, show the
  // "to be continued" screen for 5s, then return to the main menu with
  // the theme music playing.
  if (Branches.isDemoEnd(sceneId)) {
    const video = Player.getVideoElement();
    if (video) {
      const onEnded = () => {
        video.removeEventListener('ended', onEnded);
        _showDemoEnd();
      };
      video.addEventListener('ended', onEnded);
    }
    return;
  }

  // Bridge scene: auto-advance to linkScene on 'ended', no choice UI.
  const linkTarget = Branches.getLinkScene(sceneId);
  if (linkTarget) {
    Player.preloadNextScenes(linkTarget, null);
    const video = Player.getVideoElement();
    if (video) {
      const onEnded = () => {
        video.removeEventListener('ended', onEnded);
        _playScene(linkTarget);
      };
      video.addEventListener('ended', onEnded);
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
  const sv = document.getElementById('screen-video');
  if (sv) sv.classList.add('choice-active');

  // Drop out of fullscreen so the choice overlay is visible (on iOS, native
  // fullscreen covers the entire screen with just the <video> and nothing
  // else, so the overlay would otherwise be hidden until the user exits).
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitFullscreenElement) {
    document.webkitExitFullscreen && document.webkitExitFullscreen();
  }
  const vid = Player.getVideoElement();
  if (vid && vid.webkitDisplayingFullscreen && vid.webkitExitFullscreen) {
    try { vid.webkitExitFullscreen(); } catch (e) {}
  }

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

  // Final-5-seconds urgency: intensified throb + once-per-second beep.
  const urgentDelayMs = Math.max(0, (countdownSeconds - 5) * 1000);
  _urgentTimeout = setTimeout(() => {
    Choice.setUrgent(true);
    // Synthesized beep via Web Audio — louder & more reliable than the mp3.
    const fire = () => { try { Arcade.blip(1040, 0.16, 0.45); } catch (e) {} };
    fire();                                    // beep at T-5
    _beepInterval = setInterval(fire, 1000);   // then T-4, T-3, T-2, T-1
  }, urgentDelayMs);
}

function _handleChoice(color) {
  if (!choiceArmed) return; // guard double-fire
  choiceArmed = false;

  // Tear down urgency timers (the choice was made before / at countdown end).
  if (_urgentTimeout) { clearTimeout(_urgentTimeout); _urgentTimeout = null; }
  if (_beepInterval)  { clearInterval(_beepInterval); _beepInterval  = null; }

  Choice.hideChoice();
  Spider.stopCountdown();
  Player.setChoiceActive(false);
  const sv = document.getElementById('screen-video');
  if (sv) sv.classList.remove('choice-active');

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
// Quit back to the main menu — wired to the in-video BACK button.
// Stops playback, resets state, and starts the menu theme music.
// ---------------------------------------------------------------------------

function _quitToMenu() {
  _clearListeners();
  Player.pause();
  Spider.stopCountdown();
  Choice.hideChoice();
  Player.setChoiceActive(false);
  choiceArmed = false;
  _queue = [];

  Arcade.showScreen('screen-menu');

  // Start menu theme music + sync mute-button state.
  const theme = document.getElementById('audio-theme');
  if (theme) theme.currentTime = 0;
  Arcade.setThemeMusicPlaying(true);

  // Reset state so PLAY next time starts fresh.
  watched = [];
  currentScene = null;
}

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('video-back');
    if (backBtn) backBtn.addEventListener('click', _quitToMenu);
  });
}

// ---------------------------------------------------------------------------
// Demo end ("to be continued") — last playable scene reached
// ---------------------------------------------------------------------------

function _showDemoEnd() {
  // Stop the story video & clear any listeners.
  _clearListeners();
  Player.pause();
  Spider.stopCountdown();
  Choice.hideChoice();
  Player.setChoiceActive(false);

  Arcade.showScreen('screen-demoend');

  // After 5 seconds, return to the main menu and start the theme music.
  setTimeout(() => {
    Arcade.showScreen('screen-menu');
    const theme = document.getElementById('audio-theme');
    if (theme) theme.currentTime = 0;
    Arcade.setThemeMusicPlaying(true);
    // Reset state so a fresh PLAY starts from the top.
    watched = [];
    currentScene = null;
  }, 5000);
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
  Spider.stopCountdown();
  Choice.hideChoice();
  Arcade.showScreen('screen-video');

  // Stop menu theme music — story video has its own audio.
  const theme = document.getElementById('audio-theme');
  if (theme) { theme.pause(); theme.currentTime = 0; }

  // Play start.mp4; _beginScene sets up the countdown listener so the
  // cup/paperTowel choice arms 10s before the video ends.
  Player.loadScene('start');
  _beginScene('start');
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

  // RESUME on the main menu is replaced by PLAY → RESUME GAME (code prompt).
  // Always hide the legacy main-menu RESUME button.
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) resumeBtn.style.display = 'none';

  // Center the screen vertically in the viewport on load
  const screenRegion = document.getElementById('screen-region');
  if (screenRegion) {
    screenRegion.scrollIntoView({ behavior: 'instant', block: 'center' });
  }
});

// ---------------------------------------------------------------------------
// TEST MODE — scene-level forward/back for quickly walking choice routing
// ---------------------------------------------------------------------------

/**
 * Test-only: skip ahead to the next decision point.
 *  - If a choice is already armed, just resolve it (default green).
 *  - If the current scene auto-advances to a linkScene (no choice at its
 *    end), play that next scene directly — no point sitting through the
 *    rest of the bridge clip.
 *  - Otherwise jump to t-15 of the current clip so the choice arms ~5s later.
 */
function _testForward() {
  if (choiceArmed) {
    _handleChoice('green');
    return;
  }
  const linkTarget = Branches.getLinkScene(currentScene);
  if (linkTarget) {
    _playScene(linkTarget);
    return;
  }
  const video = Player.getVideoElement();
  if (video && isFinite(video.duration)) {
    video.currentTime = Math.max(0, video.duration - 15);
    video.play().catch(() => {});
  }
}

/**
 * Go back one scene. Pops current + previous from watched, replays previous.
 * Useful for re-testing a different choice from the same branch point.
 */
function _testBack() {
  if (watched.length < 2) return;
  Choice.hideChoice();
  Spider.stopCountdown();
  Player.setChoiceActive(false);
  choiceArmed = false;
  _clearListeners();
  _queue = [];

  watched.pop();              // drop current
  const prev = watched.pop(); // drop previous so _playScene re-pushes it
  _playScene(prev);
}

// In test mode: just reveal #test-skip-end (jumps to t-15). Both skip-back
// and skip-forward keep their normal ±10s behavior. Scene-level back/forward
// are still exposed on `window._testBack` / `window._testForward` for the
// console if you need them.
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.__TEST_MODE) return;
    const testEnd = document.getElementById('test-skip-end');
    if (testEnd) {
      testEnd.style.display = '';
      testEnd.addEventListener('click', _testForward);
    }
    console.log('TEST MODE active — test-skip-end jumps to t-15.');
  });
}

// Expose debug helpers to console for local testing
if (typeof window !== 'undefined') {
  window.startGame = startGame;
  window.resumeGame = resumeGame;
  window._playScene = _playScene;
  window._beginScene = _beginScene;
  window._testForward = _testForward;
  window._testBack = _testBack;
}

