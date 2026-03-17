// player.js — Video buffer pool, playback control, skip buttons.
// Three video elements: one visible (main), two hidden (preload buffers).
// Fires custom events on window: 'tethersnipe:scene-started', 'tethersnipe:scene-ended'.

// ---------------------------------------------------------------------------
// CONFIGURATION — change this one line to switch video hosts
// ---------------------------------------------------------------------------

// Default: GitHub Releases
// Upload MP4s to a release tagged "videos" on your GitHub repo.
// URL format: https://github.com/spaceclottey/playtsonline/releases/download/videos/
const VIDEO_BASE_URL =
  'https://github.com/spaceclottey/playtsonline/releases/download/videos/';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _videoMain = null;
let _bufferA = null;
let _bufferB = null;
let _currentSceneId = null;
let _choiceActive = false;

// Which buffer holds which upcoming scene
let _bufferMap = { a: null, b: null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _videoUrl(sceneId) {
  return VIDEO_BASE_URL + sceneId + '.mp4';
}

function _fireEvent(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const Player = {
  /**
   * Must be called once after the DOM is ready.
   */
  init() {
    _videoMain = document.getElementById('video-main');
    _bufferA   = document.getElementById('video-buffer-a');
    _bufferB   = document.getElementById('video-buffer-b');

    if (!_videoMain || !_bufferA || !_bufferB) {
      console.error('Player.init: video elements not found in DOM.');
      return;
    }

    _videoMain.addEventListener('ended', () => {
      _fireEvent('tethersnipe:scene-ended', { sceneId: _currentSceneId });
    });

    _videoMain.addEventListener('play', () => {
      _fireEvent('tethersnipe:scene-started', { sceneId: _currentSceneId });
    });
  },

  /**
   * Loads a scene into the main video element and starts playback.
   * Does NOT rely on buffers — used for first load and after transitions.
   */
  loadScene(sceneId) {
    _currentSceneId = sceneId;
    _choiceActive = false;
    _videoMain.src = _videoUrl(sceneId);
    _videoMain.load();
    _videoMain.play().catch(() => {
      // Autoplay blocked — user will need to interact first.
      // The 'play' event (and scene-started) will fire on first manual play.
    });
  },

  /**
   * Preloads the two candidate next scenes into the hidden buffers.
   * Call after 'scene-started' fires so buffering happens during playback.
   */
  preloadNextScenes(greenId, redId) {
    if (greenId) {
      _bufferA.src = _videoUrl(greenId);
      _bufferA.load();
      _bufferMap.a = greenId;
    }
    if (redId) {
      _bufferB.src = _videoUrl(redId);
      _bufferB.load();
      _bufferMap.b = redId;
    }
  },

  /**
   * Transitions to the chosen scene.
   * If the scene was preloaded in a buffer, swaps the buffer src into main
   * to avoid re-downloading. Otherwise falls back to a fresh load.
   */
  transitionTo(sceneId) {
    _choiceActive = false;
    _currentSceneId = sceneId;

    // Find a matching buffer
    let buffered = null;
    if (_bufferMap.a === sceneId) {
      buffered = _bufferA;
    } else if (_bufferMap.b === sceneId) {
      buffered = _bufferB;
    }

    if (buffered && buffered.src) {
      // Swap: copy src from buffer to main
      _videoMain.src = buffered.src;
      // Reset buffer slot
      if (buffered === _bufferA) _bufferMap.a = null;
      else _bufferMap.b = null;
      buffered.src = '';
    } else {
      _videoMain.src = _videoUrl(sceneId);
      _videoMain.load();
    }

    _videoMain.play().catch(() => {});
  },

  /**
   * Skip backwards 10 seconds (no-op during active choice).
   */
  skipBack() {
    if (_choiceActive || !_videoMain) return;
    _videoMain.currentTime = Math.max(0, _videoMain.currentTime - 10);
  },

  /**
   * Skip forwards 10 seconds (no-op during active choice).
   */
  skipForward() {
    if (_choiceActive || !_videoMain) return;
    const max = _videoMain.duration || Infinity;
    _videoMain.currentTime = Math.min(max, _videoMain.currentTime + 10);
  },

  /**
   * Marks a choice as active (disables skip buttons).
   */
  setChoiceActive(active) {
    _choiceActive = active;
  },

  /**
   * Pauses the main video.
   */
  pause() {
    if (_videoMain) _videoMain.pause();
  },

  /**
   * Resumes the main video.
   */
  resume() {
    if (_videoMain) _videoMain.play().catch(() => {});
  },

  /**
   * Returns the main video element (for timeupdate listeners etc.).
   */
  getVideoElement() {
    return _videoMain;
  },

  getCurrentSceneId() {
    return _currentSceneId;
  },
};
