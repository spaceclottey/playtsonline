// spider.js — 8-eye countdown timer.
// Swaps CSS classes on #spider to open/close eyes, plays audio, then fires a callback.

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

// Extension for spider eye images. Change to '.png' once real artwork is ready.
const SPIDER_EXT = '.svg'; // PLACEHOLDER

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _intervalId = null;
let _eyesOpen = 0;
let _choiceActive = false;
let _onComplete = null;
let _spiderEl = null;
let _audioDecision = null;
let _audioEyeClose = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _setEyes(n) {
  if (!_spiderEl) return;
  // Swap CSS class
  for (let i = 0; i <= 8; i++) {
    _spiderEl.classList.remove('spider--eyes-' + i);
  }
  _spiderEl.classList.add('spider--eyes-' + n);
  // Swap image src directly so no extra CSS background-image rules are needed
  _spiderEl.src = 'assets/images/spider_eyes_' + n + SPIDER_EXT;
}

function _playAudio(el) {
  if (!el) return;
  try {
    el.currentTime = 0;
    el.play().catch(() => {});
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const Spider = {
  /**
   * Must be called once after DOM is ready.
   */
  init() {
    _spiderEl = document.getElementById('spider-img');
    _audioDecision = {
      10: document.getElementById('audio-decision-10'),
      25: document.getElementById('audio-decision-25'),
    };
    _audioEyeClose = document.getElementById('audio-eye-close');
  },

  /**
   * Starts the countdown.
   * duration: 10 or 25 seconds.
   * onComplete: called with ('red') when time runs out.
   */
  startCountdown(onComplete, duration) {
    Spider.stopCountdown(); // clear any existing

    _choiceActive = true;
    _onComplete = onComplete;
    _eyesOpen = 8;

    _setEyes(8); // all eyes open

    // Play the appropriate rising-tension sound
    const audioKey = duration <= 10 ? 10 : 25;
    _playAudio(_audioDecision[audioKey]);

    // Each eye closes at equal intervals across the full duration
    const intervalMs = (duration / 8) * 1000;
    let eyesClosed = 0;

    _intervalId = setInterval(() => {
      eyesClosed++;
      _eyesOpen = 8 - eyesClosed;
      _setEyes(_eyesOpen);
      _playAudio(_audioEyeClose);

      if (eyesClosed >= 8) {
        clearInterval(_intervalId);
        _intervalId = null;
        _choiceActive = false;
        if (_onComplete) _onComplete('red');
      }
    }, intervalMs);
  },

  /**
   * Stops the countdown and resets to idle (eyes closed).
   */
  stopCountdown() {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
    _choiceActive = false;
    _eyesOpen = 0;
    _setEyes(0);

    // Stop decision audio
    for (const key of [10, 25]) {
      const el = _audioDecision && _audioDecision[key];
      if (el) {
        try { el.pause(); el.currentTime = 0; } catch (e) {}
      }
    }
  },

  /**
   * Returns true while a countdown is running.
   */
  isChoiceActive() {
    return _choiceActive;
  },
};
