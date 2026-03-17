// save.js — Play-code encode/decode and localStorage persistence.
// Each scene ID maps to a single letter. The play code is the sequence of
// those letters — short, human-typeable, useful for testing.

// ---------------------------------------------------------------------------
// Scene-to-letter mapping (update if new scenes are added)
// ---------------------------------------------------------------------------

const SCENE_TO_LETTER = {
  start:                      'A',
  cup:                        'B',
  paperTowel:                 'C',
  NikoActsAsLucia:            'D',
  AngieActsAsLucia:           'E',
  giveCigarrette:             'F',
  dontGiveCigarrette:         'G',
  canon:                      'H',
  speakWithAngie:             'I',
  playWithLucia:              'J',
  accept:                     'K',
  reject:                     'L',
  failBlackmail:              'M',
  winBlackmail_destruction:   'N',
  failManipulate_racism:      'O',
  winManipulate_platonic:     'P',
  dontSpeakWithAngie_dropout: 'Q',
  playWithLucia_speedrun:     'R',
  dontPlayWithLucia_speedrun: 'S',
  accept_speedrun:            'T',
  reject_speedrun:            'U',
  god:                        'V',
  heist:                      'W',
};

const LETTER_TO_SCENE = Object.fromEntries(
  Object.entries(SCENE_TO_LETTER).map(([k, v]) => [v, k])
);

const STORAGE_KEY = 'tethersnipe_watched';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const Save = {
  /**
   * Encodes a watched array into a short play code string.
   * Unknown scene IDs are silently skipped.
   * Example: ['start', 'cup', 'NikoActsAsLucia'] → 'ABD'
   */
  encodePlayCode(watched) {
    return watched
      .map(s => SCENE_TO_LETTER[s] || '')
      .join('');
  },

  /**
   * Decodes a play code back into a watched array.
   * Returns null if any letter is unrecognised.
   * Example: 'ABD' → ['start', 'cup', 'NikoActsAsLucia']
   */
  decodePlayCode(code) {
    if (!code || typeof code !== 'string') return null;
    const upper = code.toUpperCase().replace(/\s/g, '');
    const watched = [];
    for (const letter of upper) {
      const scene = LETTER_TO_SCENE[letter];
      if (!scene) return null;
      watched.push(scene);
    }
    return watched.length > 0 ? watched : null;
  },

  /**
   * Saves the watched array to localStorage.
   */
  saveState(watched) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watched));
    } catch (e) {
      // localStorage may be unavailable (private browsing etc.) — fail silently
    }
  },

  /**
   * Loads the watched array from localStorage.
   * Returns an array or null if nothing is saved / invalid.
   */
  loadStateFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Clears the saved state from localStorage.
   */
  clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  },
};
