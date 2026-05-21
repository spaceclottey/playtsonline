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
let _aboutTypeTimeout = null;

// Credits auto-return to menu after scroll completes
let _creditsReturnTimer = null;

// Theme-music mute state — module-scoped so other modules (main.js) can
// sync it via Arcade.setThemeMusicPlaying(true/false).
let _themeMuted = true;

// ---------------------------------------------------------------------------
// Procedural blip — Web Audio API, no file needed.
// Short square-wave tone, classic CRT-game character chirp.
// ---------------------------------------------------------------------------
let _audioCtx = null;
function _ensureAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _audioCtx = new AC();
  }
  return _audioCtx;
}
function _blip(freq, duration) {
  const ctx = _ensureAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  // Quick attack/decay envelope so it sounds like a "blip" not a tone.
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.045, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}


// ---------------------------------------------------------------------------
// Screen state management
// ---------------------------------------------------------------------------

const SCREEN_IDS = ['screen-menu', 'screen-about', 'screen-trailer', 'screen-video', 'screen-unfilmed', 'screen-commentary', 'screen-codeprompt', 'screen-notify', 'screen-demoend', 'screen-playmenu', 'screen-more', 'screen-credits'];

function _showScreen(id) {
  // Tear down pseudo-fullscreen whenever we navigate away from the video
  // screen. Otherwise the overlay's `display: flex !important` wins over
  // the `display: none` we set below, and the user stays stuck behind a
  // black fixed overlay while the next screen (e.g. demo-end) is playing
  // music underneath.
  if (id !== 'screen-video') {
    const sv = document.getElementById('screen-video');
    if (sv) sv.classList.remove('pseudo-fs');
    document.body.classList.remove('pseudo-fs-active');
    _setFullscreenIcon(false);
  }

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
  // No-op: the mobile choice buttons now appear inline at the bottom of
  // the video area, so they're already visible — no scroll-reveal needed.
  // The earlier implementation scrolled #button-region (the cabinet
  // joystick panel) into view and pulsed it, which made sense when
  // choices were going to live on the cabinet itself; with the inline
  // approach it just yanks the user away from where the buttons are.
  // Left as a function so Arcade.onChoiceActive() still has something to
  // call — easy hook to bring behavior back later if the cabinet-
  // dashboard redesign needs it.
}

// ---------------------------------------------------------------------------
// Fullscreen
// ---------------------------------------------------------------------------

// SVG paths for the fullscreen icon swap (expand → compress).
const FS_EXPAND_PATH   = 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z';
const FS_COMPRESS_PATH = 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z';

function _setFullscreenIcon(isFs) {
  const path = document.querySelector('#fullscreen-btn svg path');
  if (path) path.setAttribute('d', isFs ? FS_COMPRESS_PATH : FS_EXPAND_PATH);
}

function _toggleFullscreen() {
  const target = document.getElementById('screen-video');
  if (!target) return;

  // Touch devices: use CSS-only pseudo-fullscreen. iOS native fullscreen
  // hides our custom controls + choice overlay, pauses on exit, and
  // renders the next clip in the top-left corner after a linkScene src
  // swap. CSS fixed-position dodges all three.
  // NOTE: must check (hover: none), not (max-width: 767px) — a phone in
  // landscape is ~896px wide and would otherwise fall through to the
  // desktop branch and trigger native fullscreen.
  if (window.matchMedia('(hover: none)').matches) {
    const entering = !target.classList.contains('pseudo-fs');
    target.classList.toggle('pseudo-fs', entering);
    document.body.classList.toggle('pseudo-fs-active', entering);
    _setFullscreenIcon(entering);
    return;
  }

  // Desktop: real Fullscreen API on #screen-video so the overlay comes
  // along. Falls back to the <video> tag on browsers that reject the div.
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    return;
  }
  const video = document.getElementById('video-main');
  const useVideoFallback = () => {
    if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  };
  if (target.requestFullscreen) {
    target.requestFullscreen().catch(useVideoFallback);
  } else if (target.webkitRequestFullscreen) {
    try { target.webkitRequestFullscreen(); } catch (e) { useVideoFallback(); }
  } else {
    useVideoFallback();
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

    // Fullscreen toggle — fullscreens the whole arcade section, so the choice
    // overlay buttons stay visible during the last 10s without popping out.
    if (_fullscreenBtn) {
      _fullscreenBtn.addEventListener('click', _toggleFullscreen);
    }

    // Menu buttons
    // PLAY now opens a sub-menu with NEW GAME / RESUME GAME, instead of
    // starting the game directly.
    document.getElementById('btn-play')
      && document.getElementById('btn-play').addEventListener('click', () => {
        _showScreen('screen-playmenu');
      });

    document.getElementById('btn-newgame')
      && document.getElementById('btn-newgame').addEventListener('click', () => {
        if (_onPlay) _onPlay();
      });

    document.getElementById('btn-resumegame')
      && document.getElementById('btn-resumegame').addEventListener('click', () => {
        Arcade.showCodePrompt();
      });

    document.getElementById('playmenu-back')
      && document.getElementById('playmenu-back').addEventListener('click', () => {
        _showScreen('screen-menu');
      });

    document.getElementById('btn-trailer')
      && document.getElementById('btn-trailer').addEventListener('click', () => {
        if (_onTrailer) _onTrailer();
      });

    // MORE submenu — main-menu MORE button opens screen-more, which
    // hosts ABOUT / GET NOTIFIED / CREDITS.
    document.getElementById('btn-more')
      && document.getElementById('btn-more').addEventListener('click', () => {
        _showScreen('screen-more');
      });

    document.getElementById('more-back')
      && document.getElementById('more-back').addEventListener('click', () => {
        _showScreen('screen-menu');
      });

    document.getElementById('btn-about')
      && document.getElementById('btn-about').addEventListener('click', () => {
        Arcade.showAbout();
      });

    // About-screen back button — bail out of the typewriter early and
    // return to the MORE submenu (since that's where ABOUT now lives).
    document.getElementById('about-back')
      && document.getElementById('about-back').addEventListener('click', () => {
        if (_aboutAutoScrollFrame) { cancelAnimationFrame(_aboutAutoScrollFrame); _aboutAutoScrollFrame = null; }
        if (_aboutReturnTimer)     { clearTimeout(_aboutReturnTimer);             _aboutReturnTimer = null; }
        if (_aboutTypeTimeout)     { clearTimeout(_aboutTypeTimeout);             _aboutTypeTimeout = null; }
        _showScreen('screen-more');
      });

    // CREDITS — slow Minecraft-style scroll backed by the final 110s
    // of the Tethersnipe backing track. Respects the global mute state.
    document.getElementById('btn-credits')
      && document.getElementById('btn-credits').addEventListener('click', () => {
        Arcade.showCredits();
      });

    document.getElementById('credits-back')
      && document.getElementById('credits-back').addEventListener('click', () => {
        Arcade.hideCredits();
        _showScreen('screen-more');
      });

    // Resume code prompt
    document.getElementById('resume-code-btn')
      && document.getElementById('resume-code-btn').addEventListener('click', () => {
        const input = document.getElementById('resume-code-input');
        if (input && _onLoadCode) _onLoadCode(input.value.trim());
      });

    document.getElementById('resume-cancel-btn')
      && document.getElementById('resume-cancel-btn').addEventListener('click', () => {
        _showScreen('screen-playmenu');
      });

    // Notify screen
    document.getElementById('btn-notify')
      && document.getElementById('btn-notify').addEventListener('click', () => {
        Arcade.showNotify();
      });

    document.getElementById('notify-cancel-btn')
      && document.getElementById('notify-cancel-btn').addEventListener('click', () => {
        _showScreen('screen-more');
      });

    const notifySubmitBtn = document.getElementById('notify-submit-btn');
    if (notifySubmitBtn) {
      notifySubmitBtn.addEventListener('click', () => {
        const input = document.getElementById('notify-email-input');
        if (!input || !input.value.trim()) return;

        fetch('https://formspree.io/f/xlgpoaoj', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: input.value.trim() }),
        });

        input.value = '';
        notifySubmitBtn.textContent = 'SUBMITTED!';
        notifySubmitBtn.disabled = true;

        setTimeout(() => {
          _showScreen('screen-menu');
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

    // SVG path data for the play/pause icon swap.
    const PAUSE_PATH = 'M6 5h4v14H6V5zm8 0h4v14h-4V5z';
    const PLAY_PATH  = 'M8 5v14l11-7z';
    document.getElementById('btn-pause')
      && document.getElementById('btn-pause').addEventListener('click', () => {
        const btn = document.getElementById('btn-pause');
        if (!btn || typeof Player === 'undefined') return;
        const video = Player.getVideoElement();
        if (!video) return;
        const iconPath = btn.querySelector('#btn-pause-icon path');

        if (video.paused) {
          Player.resume();
          if (iconPath) iconPath.setAttribute('d', PAUSE_PATH);
          btn.setAttribute('aria-label', 'Pause');
        } else {
          Player.pause();
          if (iconPath) iconPath.setAttribute('d', PLAY_PATH);
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

    // Touch-screen tap-to-reveal: any tap inside a screen surfaces its
    // controls (back / skip / pause / fullscreen / etc.) for a few seconds
    // and they fade back out. Mirrors how native mobile video players behave.
    const _setupTapReveal = (screen, ms) => {
      if (!screen) return;
      let timer = null;
      screen.addEventListener('touchstart', () => {
        screen.classList.add('controls-visible');
        clearTimeout(timer);
        timer = setTimeout(() => {
          screen.classList.remove('controls-visible');
        }, ms);
      }, { passive: true });
    };
    _setupTapReveal(document.getElementById('screen-trailer'), 1000);
    _setupTapReveal(document.getElementById('screen-video'),   3000);
    _setupTapReveal(document.getElementById('screen-about'),   3000);

    // Trailer pause button
    const trailerPauseBtn = document.getElementById('trailer-pause');
    if (trailerPauseBtn) {
      trailerPauseBtn.addEventListener('click', () => {
        const video = document.getElementById('trailer-video');
        const icon = document.getElementById('trailer-pause-icon');
        if (!video) return;
        if (video.paused) {
          video.play().catch(() => {});
          trailerPauseBtn.setAttribute('aria-label', 'Pause');
          if (icon) icon.querySelector('path').setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
        } else {
          video.pause();
          trailerPauseBtn.setAttribute('aria-label', 'Resume');
          if (icon) icon.querySelector('path').setAttribute('d', 'M8 5v14l11-7z');
        }
      });
    }

    // Trailer back button
    document.getElementById('trailer-back')
      && document.getElementById('trailer-back').addEventListener('click', () => {
        const video = document.getElementById('trailer-video');
        if (video) { video.pause(); video.src = ''; }
        const icon = document.getElementById('trailer-pause-icon');
        if (icon) icon.querySelector('path').setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
        if (!_themeMuted) document.getElementById('audio-theme')?.play().catch(() => {});
        _showScreen('screen-menu');
      });

    // Trailer ended → return to menu
    const trailerVideo = document.getElementById('trailer-video');
    if (trailerVideo) {
      trailerVideo.addEventListener('ended', () => {
        trailerVideo.src = '';
        if (!_themeMuted) document.getElementById('audio-theme')?.play().catch(() => {});
        _showScreen('screen-menu');
      });
    }

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

    // Mute/unmute theme music
    const muteBtn = document.getElementById('btn-mute');
    const iconMuted = document.getElementById('icon-muted');
    const iconUnmuted = document.getElementById('icon-unmuted');
    const audioTheme = document.getElementById('audio-theme');

    if (muteBtn && audioTheme) {
      audioTheme.loop = true;
      audioTheme.volume = 0.11;
      muteBtn.addEventListener('click', () => {
        _themeMuted = !_themeMuted;
        const audioCredits = document.getElementById('audio-credits');
        const onCreditsScreen = document.getElementById('screen-credits')?.classList.contains('active');
        if (_themeMuted) {
          audioTheme.pause();
          if (audioCredits) audioCredits.pause();
          iconMuted.style.display = '';
          iconUnmuted.style.display = 'none';
          muteBtn.setAttribute('aria-label', 'Unmute');
        } else {
          // Only resume the audio appropriate to the current screen so
          // we don't suddenly start playing two tracks at once.
          if (onCreditsScreen && audioCredits) {
            audioCredits.play().catch(() => {});
          } else {
            audioTheme.play().catch(() => {});
          }
          iconMuted.style.display = 'none';
          iconUnmuted.style.display = '';
          muteBtn.setAttribute('aria-label', 'Mute');
        }
      });
    }

    // Menu button hover beep — only when theme music is off.
    //
    // Note on the autoplay policy: browsers will not play audio until a user
    // gesture (click/keypress/touch) has occurred on the page. Hover is NOT
    // a gesture. To avoid silent hover-beeps on the very first menu visit,
    // we prime the audio element by play()/pause()ing it at volume 0 on
    // the first real gesture anywhere on the document. After that, the
    // browser remembers and lets us play() from any handler.
    const menuBeep = document.getElementById('audio-menu-beep');
    if (menuBeep) {
      let _audioPrimed = false;
      const _primeAudio = () => {
        if (_audioPrimed) return;
        _audioPrimed = true;
        const v = menuBeep.volume;
        menuBeep.volume = 0;
        const p = menuBeep.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            menuBeep.pause();
            menuBeep.currentTime = 0;
            menuBeep.volume = v;
          }).catch(() => { menuBeep.volume = v; });
        }
        // Also resume the Web Audio context used by the about-screen typewriter
        // so its first blip plays without delay.
        if (_audioCtx && _audioCtx.state === 'suspended') {
          _audioCtx.resume().catch(() => {});
        }
        document.removeEventListener('pointerdown', _primeAudio, true);
        document.removeEventListener('keydown',     _primeAudio, true);
        document.removeEventListener('touchstart',  _primeAudio, true);
      };
      document.addEventListener('pointerdown', _primeAudio, true);
      document.addEventListener('keydown',     _primeAudio, true);
      document.addEventListener('touchstart',  _primeAudio, true);

      document.querySelectorAll('.menu-btn').forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
          if (!_themeMuted) return;
          try {
            menuBeep.currentTime = 0;
            menuBeep.play().catch(() => {});
          } catch (e) {}
        });
      });
    }

    // Dynamic copyright year
    const yearEl = document.getElementById('copyright-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Start on menu screen
    _showScreen('screen-menu');

    // Hold on first-frame stills, then swap to animated GIFs after 5s
    setTimeout(() => {
      const niko = document.getElementById('char-niko');
      if (niko) niko.src = 'assets/gifs/niko_menu.gif';
      const al = document.getElementById('char-angie-lucia');
      if (al) al.src = 'assets/gifs/angie_lucia_menu.gif';
    }, 5000);

  },

  /**
   * Switches the visible screen region.
   * id: 'screen-menu' | 'screen-video' | 'screen-unfilmed' | 'screen-commentary' | 'screen-codeprompt'
   */
  showScreen(id) {
    _showScreen(id);
    // Reset pause-button icon to the "pause" shape (clip is playing).
    const iconPath = document.querySelector('#btn-pause-icon path');
    if (iconPath) iconPath.setAttribute('d', 'M6 5h4v14H6V5zm8 0h4v14h-4V5z');
  },

  /**
   * Shows the trailer video.
   * PLACEHOLDER: set VIDEO_BASE_URL once R2 bucket is ready, or set src directly here.
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

    const audioTheme = document.getElementById('audio-theme');
    if (audioTheme) audioTheme.pause();

    const video = document.getElementById('trailer-video');
    if (video) {
      video.src = 'https://pub-7c58dd2cc67a41b3905832dbb21e30be.r2.dev/tethersnipe_teaser_trailer.mp4';
      video.load();
      video.play().catch(() => {});
    }
    _showScreen('screen-trailer');
  },

  showAbout() {
    _showScreen('screen-about');
    const about = document.getElementById('about-text');
    if (!about) {
      setTimeout(() => _showScreen('screen-menu'), 1000);
      return;
    }

    // Cancel any previous about timers.
    if (_aboutAutoScrollFrame) {
      cancelAnimationFrame(_aboutAutoScrollFrame);
      _aboutAutoScrollFrame = null;
    }
    if (_aboutReturnTimer) {
      clearTimeout(_aboutReturnTimer);
      _aboutReturnTimer = null;
    }
    if (_aboutTypeTimeout) {
      clearTimeout(_aboutTypeTimeout);
      _aboutTypeTimeout = null;
    }

    // Script — each entry is one paragraph. `gap` is ms pause after the
    // paragraph finishes before the next one starts.
    const SCRIPT = [
      { text: 'A manager of a dying arcade takes initiative to follow her moral convictions amidst the recession.', gap: 700 },
      { text: 'A jaded entomologist clocks in after committing academic fraud for breakfast.', gap: 700 },
      { text: 'A listless teenager suffocated by boredom has nothing better to do.', gap: 700 },
      { text: "They play a game that hasn't been touched in a very, very long time.", gap: 900 },
      { text: "Fall semester can't come soon enough... if it comes at all.", gap: 900 },
      { text: 'Can you make all the right choices? Or will you ensnare the characters in webs of tangled truths?', gap: 1200 },
      { text: 'Play through the full interactive film.', gap: 400, extraTop: true },
      { text: 'Summer 2026.', gap: 1200 },
    ];

    // Tuning
    const CHAR_DELAY = 32;        // ms per character
    const PUNCT_PAUSE = 180;      // extra pause after , . ! ? ;
    const BLIP_EVERY = 2;         // play a blip every N chars (lower = noisier)
    const BLIP_FREQ_BASE = 720;   // Hz
    const BLIP_FREQ_JITTER = 80;  // random +/- variation, Hz
    const BLIP_DUR = 0.025;       // seconds

    about.innerHTML = '<div class="about-lead-space"></div>';
    const leadSpace = about.firstChild;
    let charCounter = 0;

    function typeParagraph(paraIdx, paraEl, charIdx) {
      const entry = SCRIPT[paraIdx];
      if (charIdx >= entry.text.length) {
        // Paragraph done — wait `gap` ms then move to next.
        if (paraIdx === SCRIPT.length - 1) {
          // All done — return to menu after a hold.
          _aboutReturnTimer = setTimeout(() => {
            _showScreen('screen-menu');
            _aboutReturnTimer = null;
          }, 3500);
          return;
        }
        _aboutTypeTimeout = setTimeout(() => {
          startParagraph(paraIdx + 1);
        }, entry.gap);
        return;
      }
      const ch = entry.text[charIdx];
      paraEl.textContent += ch;
      // Beep on visible chars, skip the silent ones to avoid spam.
      if (ch !== ' ' && (charCounter % BLIP_EVERY === 0)) {
        const jitter = (Math.random() * 2 - 1) * BLIP_FREQ_JITTER;
        _blip(BLIP_FREQ_BASE + jitter, BLIP_DUR);
      }
      charCounter++;

      // Scroll so newest text stays in view if it overflows.
      if (about.scrollHeight > about.clientHeight) {
        about.scrollTop = about.scrollHeight;
      }

      const isPunct = /[,.!?;:]/.test(ch);
      _aboutTypeTimeout = setTimeout(
        () => typeParagraph(paraIdx, paraEl, charIdx + 1),
        CHAR_DELAY + (isPunct ? PUNCT_PAUSE : 0)
      );
    }

    function startParagraph(paraIdx) {
      const entry = SCRIPT[paraIdx];
      const p = document.createElement('p');
      if (entry.extraTop) p.style.marginTop = '3em';
      about.insertBefore(p, about.lastChild || null);
      typeParagraph(paraIdx, p, 0);
    }

    // Append trailing spacer once so layout stays stable.
    const trail = document.createElement('div');
    trail.className = 'about-trail-space';
    about.appendChild(trail);

    about.scrollTop = 0;
    // Small lead-in before the first character lands.
    _aboutTypeTimeout = setTimeout(() => startParagraph(0), 600);
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
   * Show the credits screen, start the slow vertical scroll, and play the
   * 157-second credits audio track (synced 1:1 with the scroll duration).
   * Respects the global mute state — if theme music is muted, credits
   * audio stays muted too.
   */
  showCredits() {
    _showScreen('screen-credits');
    const roll = document.querySelector('#screen-credits .credits-roll');
    const screen = document.getElementById('screen-credits');
    if (roll && screen) {
      // Set the animation's start position to exactly the parent's
      // height in pixels, so the column starts JUST below the visible
      // window. translateY(100%) on its own refers to the column's own
      // height, which is much taller than the parent, so without this
      // the credits would take ~30s to scroll into view.
      roll.style.setProperty('--scroll-start', screen.clientHeight + 'px');
      // Start at the last 30 seconds: use negative animation-delay to skip
      // to 127s into a 157s animation (157 - 30 = 127).
      roll.style.animationDelay = '-127s';
      // Force a fresh animation start by removing then re-adding the
      // .rolling class. Otherwise re-entering the screen wouldn't replay
      // from the top because CSS animations only fire on class-change.
      roll.classList.remove('rolling');
      void roll.offsetHeight; // reflow
      roll.classList.add('rolling');
    }
    // Swap the theme music for the credits track (don't play both).
    const audioTheme = document.getElementById('audio-theme');
    if (audioTheme) audioTheme.pause();
    const audio = document.getElementById('audio-credits');
    if (audio) {
      // Start audio at 127 seconds (last 30 seconds of the 157s track)
      audio.currentTime = 127;
      audio.volume = 0.6;
      if (!_themeMuted) {
        audio.play().catch(() => {});
      }
    }
    // Auto-return to MORE menu after credits finish (30s remaining + 3s spacer)
    if (_creditsReturnTimer) clearTimeout(_creditsReturnTimer);
    _creditsReturnTimer = setTimeout(() => {
      Arcade.hideCredits();
      _showScreen('screen-more');
      _creditsReturnTimer = null;
    }, 33000); // 30s remaining animation + 3s pause = 33s total
  },

  /**
   * Hide the credits scroll — stop animation, pause audio, reset state
   * so the next visit replays cleanly from the top. Restore theme music
   * if it was playing before. Cancel any pending auto-return timer.
   */
  hideCredits() {
    if (_creditsReturnTimer) {
      clearTimeout(_creditsReturnTimer);
      _creditsReturnTimer = null;
    }
    const roll = document.querySelector('#screen-credits .credits-roll');
    if (roll) {
      roll.classList.remove('rolling');
      roll.style.animationDelay = '0s'; // Reset animation delay for next playthrough
    }
    const audio = document.getElementById('audio-credits');
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    const audioTheme = document.getElementById('audio-theme');
    if (audioTheme && !_themeMuted) {
      audioTheme.play().catch(() => {});
    }
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

  /**
   * Procedural blip — exposes the internal Web Audio function so other
   * modules (main.js) can play a synthesized beep without depending on an
   * audio file. freq in Hz, duration in seconds, vol 0..1.
   */
  blip(freq = 880, duration = 0.12, vol = 0.35) {
    const ctx = _ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  },

  /**
   * Sync the mute-button state with externally-controlled audio playback.
   * Pass true if the theme music is now playing; false if paused.
   */
  setThemeMusicPlaying(playing) {
    _themeMuted = !playing;
    const audioTheme = document.getElementById('audio-theme');
    const iconMuted = document.getElementById('icon-muted');
    const iconUnmuted = document.getElementById('icon-unmuted');
    if (playing) {
      if (audioTheme) {
        audioTheme.loop = true;
        audioTheme.volume = 0.11;
        audioTheme.play().catch(() => {});
      }
      if (iconMuted)   iconMuted.style.display   = 'none';
      if (iconUnmuted) iconUnmuted.style.display = '';
    } else {
      if (audioTheme) audioTheme.pause();
      if (iconMuted)   iconMuted.style.display   = '';
      if (iconUnmuted) iconUnmuted.style.display = 'none';
    }
  },
};

// Expose Arcade in global window for console debugging and external callers.
if (typeof window !== 'undefined') {
  window.Arcade = Arcade;
}

