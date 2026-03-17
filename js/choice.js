// choice.js — Choice UI: fixed/filmed, unfilmed, and fake modes.
// Manages enabling/disabling buttons, populating unfilmed panels,
// and the fake-choice animation state.

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _greenBtn = null;
let _redBtn = null;
let _choiceScreenUnfilmed = null;
let _unfilmedGreenPanel = null;
let _unfilmedRedPanel = null;
let _greenClickHandler = null;
let _redClickHandler = null;
let _isFake = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _setButtonsEnabled(enabled) {
  if (_greenBtn) _greenBtn.disabled = !enabled;
  if (_redBtn) _redBtn.disabled = !enabled;
}

function _clearHandlers() {
  if (_greenClickHandler && _greenBtn) {
    _greenBtn.removeEventListener('click', _greenClickHandler);
  }
  if (_redClickHandler && _redBtn) {
    _redBtn.removeEventListener('click', _redClickHandler);
  }
  _greenClickHandler = null;
  _redClickHandler = null;

  // Also clear unfilmed panel click handlers by cloning
  if (_unfilmedGreenPanel) {
    const clone = _unfilmedGreenPanel.cloneNode(true);
    _unfilmedGreenPanel.parentNode.replaceChild(clone, _unfilmedGreenPanel);
    _unfilmedGreenPanel = document.getElementById('unfilmed-green');
  }
  if (_unfilmedRedPanel) {
    const clone = _unfilmedRedPanel.cloneNode(true);
    _unfilmedRedPanel.parentNode.replaceChild(clone, _unfilmedRedPanel);
    _unfilmedRedPanel = document.getElementById('unfilmed-red');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const Choice = {
  /**
   * Must be called once after DOM is ready.
   */
  init() {
    _greenBtn          = document.getElementById('btn-green');
    _redBtn            = document.getElementById('btn-red');
    _choiceScreenUnfilmed    = document.getElementById('screen-unfilmed');
    _unfilmedGreenPanel = document.getElementById('unfilmed-green');
    _unfilmedRedPanel  = document.getElementById('unfilmed-red');
  },

  /**
   * Shows a fixed or filmed choice.
   * Both buttons become clickable. Labels updated for accessibility.
   * onChoose(choice) called with 'green' or 'red'.
   */
  showFixed(greenLabel, redLabel, onChoose) {
    _isFake = false;
    _clearHandlers();

    if (_greenBtn) {
      _greenBtn.setAttribute('aria-label', 'Green: ' + greenLabel);
      _greenBtn.setAttribute('data-label', greenLabel);
    }
    if (_redBtn) {
      _redBtn.setAttribute('aria-label', 'Red: ' + redLabel);
      _redBtn.setAttribute('data-label', redLabel);
    }

    _greenClickHandler = () => {
      if (!_isFake) onChoose('green');
    };
    _redClickHandler = () => {
      if (!_isFake) onChoose('red');
    };

    _greenBtn && _greenBtn.addEventListener('click', _greenClickHandler);
    _redBtn   && _redBtn.addEventListener('click', _redClickHandler);

    _setButtonsEnabled(true);
  },

  /**
   * Shows an unfilmed choice: hides video, shows the two thumbnail panels.
   * Each panel has a looping video thumbnail and a label.
   * onChoose(choice) called with 'green' or 'red'.
   */
  showUnfilmed(greenSceneId, redSceneId, greenLabel, redLabel, onChoose) {
    _isFake = false;
    _clearHandlers();

    // Populate green panel
    const greenThumb = _unfilmedGreenPanel
      ? _unfilmedGreenPanel.querySelector('.unfilmed-thumb')
      : null;
    const greenLabelEl = _unfilmedGreenPanel
      ? _unfilmedGreenPanel.querySelector('.unfilmed-label')
      : null;
    if (greenThumb) {
      greenThumb.src = 'assets/thumbnails/' + greenSceneId + '_loop.mp4';
    }
    if (greenLabelEl) greenLabelEl.textContent = greenLabel;

    // Populate red panel
    const redThumb = _unfilmedRedPanel
      ? _unfilmedRedPanel.querySelector('.unfilmed-thumb')
      : null;
    const redLabelEl = _unfilmedRedPanel
      ? _unfilmedRedPanel.querySelector('.unfilmed-label')
      : null;
    if (redThumb) {
      redThumb.src = 'assets/thumbnails/' + redSceneId + '_loop.mp4';
    }
    if (redLabelEl) redLabelEl.textContent = redLabel;

    // Button labels too
    if (_greenBtn) {
      _greenBtn.setAttribute('aria-label', 'Green: ' + greenLabel);
      _greenBtn.setAttribute('data-label', greenLabel);
    }
    if (_redBtn) {
      _redBtn.setAttribute('aria-label', 'Red: ' + redLabel);
      _redBtn.setAttribute('data-label', redLabel);
    }

    // Wire click handlers to both buttons AND panels
    _greenClickHandler = () => { if (!_isFake) onChoose('green'); };
    _redClickHandler   = () => { if (!_isFake) onChoose('red'); };

    _greenBtn && _greenBtn.addEventListener('click', _greenClickHandler);
    _redBtn   && _redBtn.addEventListener('click', _redClickHandler);

    // Re-query after cloneNode replacement above
    _unfilmedGreenPanel = document.getElementById('unfilmed-green');
    _unfilmedRedPanel   = document.getElementById('unfilmed-red');
    _unfilmedGreenPanel && _unfilmedGreenPanel.addEventListener('click', _greenClickHandler);
    _unfilmedRedPanel   && _unfilmedRedPanel.addEventListener('click', _redClickHandler);

    _setButtonsEnabled(true);
    _choiceScreenUnfilmed && _choiceScreenUnfilmed.classList.add('active');
  },

  /**
   * Shows a fake choice: buttons animate but register no clicks.
   * Spider countdown still runs; auto-advance is handled by main.js.
   */
  showFake(greenLabel, redLabel) {
    _isFake = true;
    _clearHandlers();

    if (_greenBtn) {
      _greenBtn.setAttribute('aria-label', 'Green: ' + greenLabel);
      _greenBtn.setAttribute('data-label', greenLabel);
      _greenBtn.classList.add('choice-button--animating');
    }
    if (_redBtn) {
      _redBtn.setAttribute('aria-label', 'Red: ' + redLabel);
      _redBtn.setAttribute('data-label', redLabel);
      _redBtn.classList.add('choice-button--animating');
    }

    _setButtonsEnabled(false); // visually enabled-ish via CSS, but not interactive
  },

  /**
   * Hides choice UI and resets button state.
   */
  hideChoice() {
    _isFake = false;
    _clearHandlers();
    _setButtonsEnabled(false);

    if (_greenBtn) {
      _greenBtn.classList.remove('choice-button--animating');
      _greenBtn.removeAttribute('data-label');
      _greenBtn.setAttribute('aria-label', 'Green');
    }
    if (_redBtn) {
      _redBtn.classList.remove('choice-button--animating');
      _redBtn.removeAttribute('data-label');
      _redBtn.setAttribute('aria-label', 'Red');
    }

    _choiceScreenUnfilmed && _choiceScreenUnfilmed.classList.remove('active');
  },
};
