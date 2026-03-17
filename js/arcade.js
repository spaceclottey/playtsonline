if (typeof window !== 'undefined') {
  window.__arcade_load_count = (window.__arcade_load_count || 0) + 1;
  console.log('arcade.js loaded', window.__arcade_load_count);
}

// arcade.js — Machine-level behavior: fullscreen, mobile reveal,
// menu navigation, commentary unlock, opening sequence.

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

// PLACEHOLDER — fill in YouTube IDs when commentary tracks are recorded.
// Each entry needs a title and the 11-character YouTube video ID.
const COMMENTARY_TRACKS = [
  // { title: 'Director Commentary – Full Play',       youtubeId: 'PLACEHOLDER' },
  // { title: 'Behind the Scenes – Staging & Design',  youtubeId: 'PLACEHOLDER' },
  // { title: 'Actor Roundtable – Act I',              youtubeId: 'PLACEHOLDER' },
  // { title: 'Actor Roundtable – Act II',             youtubeId: 'PLACEHOLDER' },
  // { title: 'Writer Commentary',                     youtubeId: 'PLACEHOLDER' },
  // { title: 'Technical Commentary – Branching Logic', youtubeId: 'PLACEHOLDER' },
];

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _arcadeSection = null;
let _screenMenu = null;
let _screenVideo = null;
let _screenUnfilmed = null;
let _screenCommentary = null;
let _screenCodeprompt = null;
let _fullscreenBtn = null;

// Commentary unlock: track how long green button is held
let _greenHoldTimer = null;
const COMMENTARY_HOLD_MS = 5000;

// Callbacks set by main.js
let _onPlay = null;
let _onTrailer = null;
let _onResume = null;
let _onLoadCode = null;

// About auto-scroll state
let _aboutAutoScrollFrame = null;
let _aboutReturnTimer = null;

// ---------------------------------------------------------------------------
// Screen state management
// ---------------------------------------------------------------------------

const SCREEN_IDS = ['screen-menu', 'screen-about', 'screen-trailer', 'screen-video', 'screen-unfilmed', 'screen-commentary', 'screen-codeprompt', 'screen-notify'];

function _showScreen(id) {
  const screens = document.querySelectorAll('.screen-state');
  screens.forEach((el) => {
    if (el.id === id) {
      el.classList.add('active');
      el.style.display = 'flex';
    } else {
      el.classList.remove('active');
      el.style.display = 'none';
    }
  });
}

// ---------------------------------------------------------------------------
// Commentary
// ---------------------------------------------------------------------------

function _buildCommentaryMenu() {
  const list = document.getElementById('commentary-list');
  if (!list) return;
  list.innerHTML = '';

  if (COMMENTARY_TRACKS.length === 0) {
    list.innerHTML = '<li class="commentary-placeholder">Commentary coming soon.</li>';
    return;
  }

  COMMENTARY_TRACKS.forEach((track, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = track.title;
    btn.addEventListener('click', () => _playCommentary(track.youtubeId));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function _playCommentary(youtubeId) {
  const menu   = document.getElementById('commentary-menu');
  const player = document.getElementById('commentary-player');
  const iframe = document.getElementById('commentary-iframe');

  if (!iframe) return;
  iframe.src = 'https://www.youtube-nocookie.com/embed/' + youtubeId + '?autoplay=1';
  menu   && (menu.style.display = 'none');
  player && (player.style.display = 'block');
}

function _closeCommentary() {
  const iframe = document.getElementById('commentary-iframe');
  if (iframe) iframe.src = '';
  const menu   = document.getElementById('commentary-menu');
  const player = document.getElementById('commentary-player');
  menu   && (menu.style.display = '');
  player && (player.style.display = 'none');
}

// ---------------------------------------------------------------------------
// Mobile choice reveal
// ---------------------------------------------------------------------------

function _revealChoiceOnMobile() {
  if (window.innerWidth >= 768) return;

  // Exit fullscreen first
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  // Smooth-scroll the control panel into view
  const btnRegion = document.getElementById('button-region');
  if (btnRegion) {
    btnRegion.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btnRegion.classList.add('button-region--pulse');
    setTimeout(() => btnRegion.classList.remove('button-region--pulse'), 2000);
  }
}

// ---------------------------------------------------------------------------
// Fullscreen
// ---------------------------------------------------------------------------

function _toggleFullscreen() {
  if (!document.fullscreenElement) {
    _arcadeSection && _arcadeSection.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const Arcade = {
  /**
   * Must be called once after DOM is ready.
   * Callbacks let main.js own game state while arcade.js owns UI routing.
   */
  init({ onPlay, onTrailer, onResume, onLoadCode }) {
    _onPlay      = onPlay;
    _onTrailer   = onTrailer;
    _onResume    = onResume;
    _onLoadCode  = onLoadCode;

    _arcadeSection      = document.getElementById('arcade-section');
    _screenMenu         = document.getElementById('screen-menu');
    _screenVideo        = document.getElementById('screen-video');
    _screenUnfilmed     = document.getElementById('screen-unfilmed');
    _screenCommentary   = document.getElementById('screen-commentary');
    _screenCodeprompt   = document.getElementById('screen-codeprompt');
    _fullscreenBtn      = document.getElementById('fullscreen-btn');

    // Fullscreen toggle
    // Hide fullscreen button and do not wire it for now.
    if (_fullscreenBtn) {
      _fullscreenBtn.style.display = 'none';
    }

    // Menu buttons
    document.getElementById('btn-play')
      && document.getElementById('btn-play').addEventListener('click', () => {
        if (_onPlay) _onPlay();
      });

    document.getElementById('btn-trailer')
      && document.getElementById('btn-trailer').addEventListener('click', () => {
        if (_onTrailer) _onTrailer();
      });

    document.getElementById('btn-about')
      && document.getElementById('btn-about').addEventListener('click', () => {
        Arcade.showAbout();
      });

    document.getElementById('btn-credits-menu')
      && document.getElementById('btn-credits-menu').addEventListener('click', () => {
        document.getElementById('credits-section')
          && document.getElementById('credits-section').scrollIntoView({ behavior: 'smooth' });
      });

    // Resume code prompt
    document.getElementById('resume-code-btn')
      && document.getElementById('resume-code-btn').addEventListener('click', () => {
        const input = document.getElementById('resume-code-input');
        if (input && _onLoadCode) _onLoadCode(input.value.trim());
      });

    document.getElementById('resume-cancel-btn')
      && document.getElementById('resume-cancel-btn').addEventListener('click', () => {
        _showScreen('screen-menu');
      });

    // Notify screen
    document.getElementById('btn-notify')
      && document.getElementById('btn-notify').addEventListener('click', () => {
        Arcade.showNotify();
      });

    document.getElementById('notify-cancel-btn')
      && document.getElementById('notify-cancel-btn').addEventListener('click', () => {
        _showScreen('screen-menu');
      });

    const notifySubmitBtn = document.getElementById('notify-submit-btn');
    if (notifySubmitBtn) {
      notifySubmitBtn.addEventListener('click', () => {
        const input = document.getElementById('notify-email-input');
        if (!input || !input.value.trim()) return;

        const params = new URLSearchParams();
        params.append('entry.849628579', input.value.trim());
        fetch(
          'https://docs.google.com/forms/d/e/1FAIpQLSc1iOe1GBUF9YJprX-3vtlRnhc-0T6HyIaSOw_Iqv0jAt_YoQ/formResponse',
          { method: 'POST', mode: 'no-cors', body: params }
        );

        notifySubmitBtn.textContent = 'SUBMITTED!';
        notifySubmitBtn.disabled = true;

        setTimeout(() => {
          _showScreen('screen-menu');
          input.value = '';
          notifySubmitBtn.textContent = 'SUBMIT';
          notifySubmitBtn.disabled = false;
        }, 1800);
      });
    }

    // Load code from save section at bottom of page
    document.getElementById('load-code-btn')
      && document.getElementById('load-code-btn').addEventListener('click', () => {
        const input = document.getElementById('load-code-input');
        if (input && _onLoadCode) _onLoadCode(input.value.trim());
      });

    // Skip buttons
    document.getElementById('skip-back')
      && document.getElementById('skip-back').addEventListener('click', () => {
        if (typeof Player !== 'undefined') Player.skipBack();
      });

    document.getElementById('btn-pause')
      && document.getElementById('btn-pause').addEventListener('click', () => {
        const btn = document.getElementById('btn-pause');
        if (!btn || typeof Player === 'undefined') return;
        const video = Player.getVideoElement();
        if (!video) return;

        if (video.paused) {
          Player.resume();
          btn.textContent = '⏸';
          btn.setAttribute('aria-label', 'Pause');
        } else {
          Player.pause();
          btn.textContent = '▶';
          btn.setAttribute('aria-label', 'Resume');
        }
      });

    document.getElementById('skip-forward')
      && document.getElementById('skip-forward').addEventListener('click', () => {
        if (typeof Player !== 'undefined') Player.skipForward();
      });

    // Commentary unlock: hold green button 5 seconds
    const greenBtn = document.getElementById('btn-green');
    if (greenBtn) {
      const startHold = () => {
        _greenHoldTimer = setTimeout(() => {
          Arcade.showCommentary();
        }, COMMENTARY_HOLD_MS);
      };
      const cancelHold = () => {
        clearTimeout(_greenHoldTimer);
        _greenHoldTimer = null;
      };
      greenBtn.addEventListener('mousedown', startHold);
      greenBtn.addEventListener('touchstart', startHold, { passive: true });
      greenBtn.addEventListener('mouseup', cancelHold);
      greenBtn.addEventListener('mouseleave', cancelHold);
      greenBtn.addEventListener('touchend', cancelHold);
    }

    // Trailer back button
    document.getElementById('trailer-back')
      && document.getElementById('trailer-back').addEventListener('click', () => {
        if (_aboutReturnTimer) { clearTimeout(_aboutReturnTimer); _aboutReturnTimer = null; }
        const iframe = document.getElementById('trailer-iframe');
        if (iframe) iframe.src = '';
        _showScreen('screen-menu');
      });

    // Commentary back button
    document.getElementById('commentary-back')
      && document.getElementById('commentary-back').addEventListener('click', () => {
        _closeCommentary();
      });

    // Build commentary menu items
    _buildCommentaryMenu();

    // Copy play code
    document.getElementById('copy-code-btn')
      && document.getElementById('copy-code-btn').addEventListener('click', () => {
        const code = document.getElementById('play-code-display');
        if (code && code.textContent && code.textContent !== '—') {
          navigator.clipboard.writeText(code.textContent).catch(() => {
            // Clipboard API unavailable — silently ignore
          });
        }
      });

    // Start on menu screen
    _showScreen('screen-menu');
  },

  /**
   * Switches the visible screen region.
   * id: 'screen-menu' | 'screen-video' | 'screen-unfilmed' | 'screen-commentary' | 'screen-codeprompt'
   */
  showScreen(id) {
    _showScreen(id);
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = '⏸';
  },

  /**
   * Shows the trailer as a YouTube embed.
   */
  showTrailer() {
    if (_aboutAutoScrollFrame) {
      cancelAnimationFrame(_aboutAutoScrollFrame);
      _aboutAutoScrollFrame = null;
    }
    if (_aboutReturnTimer) {
      clearTimeout(_aboutReturnTimer);
      _aboutReturnTimer = null;
    }

    const iframe = document.getElementById('trailer-iframe');
    if (iframe) {
      iframe.src = 'https://www.youtube-nocookie.com/embed/sUGTUjznAbU?autoplay=1&controls=0&rel=0';
    }
    _showScreen('screen-trailer');

    _aboutReturnTimer = setTimeout(() => {
      const iframe = document.getElementById('trailer-iframe');
      if (iframe) iframe.src = '';
      _showScreen('screen-menu');
      _aboutReturnTimer = null;
    }, 34000);
  },

  showAbout() {
    _showScreen('screen-about');
    const about = document.getElementById('about-text');
    if (!about) {
      setTimeout(() => _showScreen('screen-menu'), 5000);
      return;
    }

    // Cancel any previous about auto-scroll/return timers.
    if (_aboutAutoScrollFrame) {
      cancelAnimationFrame(_aboutAutoScrollFrame);
      _aboutAutoScrollFrame = null;
    }
    if (_aboutReturnTimer) {
      clearTimeout(_aboutReturnTimer);
      _aboutReturnTimer = null;
    }

    about.innerHTML = `
<div class="about-lead-space"></div>
<p>A manager of a dying arcade takes initiative to follow her moral convictions amidst the recession.</p>
<p>A jaded entomologist clocks in after committing academic fraud for breakfast.</p>
<p>A listless teenager suffocated by boredom has nothing better to do.</p>
<p>They play a game that hasn't been touched in a very, very long time.</p>
<p>Fall semester can't come soon enough... if it comes at all.</p>
<p>Can you make all the right choices? Or will you ensnare the characters in webs of tangled truths?</p>
<div class="about-trail-space"></div>
`;
    about.scrollTop = 0;

    const SCROLL_DELAY = 1200;
    const total = Math.max(0, about.scrollHeight - about.clientHeight);
    if (total > 0) {
      const start = performance.now();
      const duration = 24000;
      const frame = (ts) => {
        const elapsed = ts - start - SCROLL_DELAY;
        if (elapsed < 0) {
          _aboutAutoScrollFrame = requestAnimationFrame(frame);
          return;
        }
        const progress = Math.min(elapsed / duration, 1);
        about.scrollTop = Math.round(total * progress);
        if (progress < 1) {
          _aboutAutoScrollFrame = requestAnimationFrame(frame);
        } else {
          _aboutAutoScrollFrame = null;
          _aboutReturnTimer = setTimeout(() => {
            _showScreen('screen-menu');
            _aboutReturnTimer = null;
          }, 5000);
        }
      };
      _aboutAutoScrollFrame = requestAnimationFrame(frame);
    } else {
      _aboutReturnTimer = setTimeout(() => {
        _showScreen('screen-menu');
        _aboutReturnTimer = null;
      }, 20000);
    }
  },

  /**
   * Shows the code-entry prompt inside the screen region.
   */
  showCodePrompt() {
    _showScreen('screen-codeprompt');
    const input = document.getElementById('resume-code-input');
    input && input.focus();
  },

  /**
   * Shows the email notification signup screen.
   */
  showNotify() {
    _showScreen('screen-notify');
    const input = document.getElementById('notify-email-input');
    input && input.focus();
  },

  /**
   * Shows the commentary screen.
   */
  showCommentary() {
    _closeCommentary(); // reset to menu view
    _showScreen('screen-commentary');
  },

  /**
   * Called when a choice becomes active — triggers mobile scroll reveal.
   */
  onChoiceActive() {
    _revealChoiceOnMobile();
  },

  /**
   * Updates the play code display and the bottom-of-page display.
   */
  updatePlayCode(code) {
    const el = document.getElementById('play-code-display');
    if (el) el.textContent = code || '—';
  },
};

// Expose Arcade in global window for console debugging and external callers.
if (typeof window !== 'undefined') {
  window.Arcade = Arcade;
}

