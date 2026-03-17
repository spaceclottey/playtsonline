// branches.js — Pure port of tethersnipebranches.py
// No DOM access. No import/export. Exposed as global Branches object.
// Bug fix applied: Python lines 287-288 used == (comparison) instead of = (assignment).

// ---------------------------------------------------------------------------
// CONFIGURATION (edit these as footage is produced)
// ---------------------------------------------------------------------------

// Add [greenId, redId] pairs here when dynamic-choice footage is filmed.
// Order matters: first element maps to green button, second to red.
const FILMED_DYNAMIC_CHOICES = [
  // PLACEHOLDER — e.g. ['winBlackmail_destruction', 'winManipulate_platonic']
];

// ---------------------------------------------------------------------------
// SCENE DATA
// ---------------------------------------------------------------------------

const SCENES = {
  start: {
    duration: 0,
    period: 'noperiod',
    karma: 0,
    requiredChoices: ['cup', 'paperTowel'],
  },
  cup: {
    duration: 0,
    period: 'noperiod',
    karma: 1,
    requiredChoices: ['NikoActsAsLucia', 'AngieActsAsLucia'],
  },
  paperTowel: {
    duration: 0,
    period: 'noperiod',
    karma: -1,
    requiredChoices: ['NikoActsAsLucia', 'AngieActsAsLucia'],
  },
  NikoActsAsLucia: {
    duration: 0,
    period: 'noperiod',
    karma: 2,
    requiredChoices: ['giveCigarrette', 'dontGiveCigarrette'],
  },
  AngieActsAsLucia: {
    duration: 0,
    period: 'noperiod',
    karma: -1,
    requiredChoices: ['giveCigarrette', 'dontGiveCigarrette'],
  },
  giveCigarrette: {
    duration: 45,
    period: 'noperiod',
    karma: -3,
    requiredChoices: ['speakWithAngie', 'playWithLucia'],
  },
  dontGiveCigarrette: {
    duration: 45,
    period: 'noperiod',
    karma: 3,
    requiredChoices: ['speakWithAngie', 'playWithLucia'],
  },
  canon: {
    duration: 45,
    period: 'present',
    karma: 0,
    requiredChoices: ['speakWithAngie', 'playWithLucia'],
  },
  dontPlayWithLucia_speedrun: {
    duration: 1,
    period: 'present',
    karma: 0,
  },
  accept: {
    duration: 17,
    period: 'past',
    karma: -3,
  },
  reject: {
    duration: 3,
    period: 'past',
    karma: 3,
  },
  accept_speedrun: {
    duration: 1,
    period: 'terminal',
    karma: -3,
  },
  reject_speedrun: {
    duration: 1,
    period: 'terminal',
    karma: 1,
  },
  // requiredChoices here are placeholder names not used directly — speakWithAngie
  // is handled as a special case in the dynamic options logic (see getNextChoices).
  speakWithAngie: {
    duration: 1,
    period: 'present',
    karma: 2,
    requiredChoices: ['blackmail', 'manipulate'],
  },
  playWithLucia: {
    duration: 7,
    period: 'past',
    karma: -2,
    requiredChoices: ['accept', 'reject'],
  },
  playWithLucia_speedrun: {
    duration: 1,
    period: 'past',
    karma: 0,
  },
  failBlackmail: {
    duration: 2,
    period: 'speaking',
    karma: -2,
  },
  winBlackmail_destruction: {
    duration: 7,
    period: 'speaking',
    karma: -2,
  },
  failManipulate_racism: {
    duration: 3,
    period: 'speaking',
    karma: -1,
  },
  winManipulate_platonic: {
    duration: 10,
    period: 'speaking',
    karma: -2,
  },
  dontSpeakWithAngie_dropout: {
    duration: 9,
    period: 'present',
    karma: 3,
  },
  god: {
    duration: 14,
    period: 'terminal',
    karma: 0,
    // Add entries here once God Route footage is recorded:
    // { timestamp: 45.2, greenLabel: "Option A", redLabel: "Option B" }
    fakeChoices: [],
  },
  heist: {
    duration: 16,
    period: 'terminal',
    karma: 0,
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _period(sceneId) {
  return SCENES[sceneId] ? SCENES[sceneId].period : 'noperiod';
}

function _getKarmaVal(sceneId) {
  if (sceneId && SCENES[sceneId] && 'karma' in SCENES[sceneId]) {
    return SCENES[sceneId].karma;
  }
  return 0;
}

function _scaler(x) {
  const max = 7;
  if (x > max) x = max;
  if (x < -max) x = -max;
  return (x - (-max)) / (max - (-max));
}

function _runtime(watched) {
  return watched.reduce((sum, s) => sum + ((SCENES[s] && SCENES[s].duration) || 0), 0);
}

// De-duplicate array preserving insertion order.
function _unique(arr) {
  return [...new Set(arr)];
}

// ---------------------------------------------------------------------------
// Core logic — direct port of the Python while-loop body
// ---------------------------------------------------------------------------

function _buildChoices(watched) {
  if (!watched || watched.length === 0) return ['cup', 'paperTowel'];

  const curScene = watched[watched.length - 1];
  const runtime = _runtime(watched);

  const conditionsForWinManipulate =
    watched.includes('dontSpeakWithAngie_dropout') ||
    watched.includes('winBlackmail_destruction');
  const conditionsForWinBlackmail = watched.includes('playWithLucia');

  let options = [];
  let speedrunDeathSpiralGodTrigger = false;

  const sceneData = SCENES[curScene];
  const hasRequiredChoices = sceneData && 'requiredChoices' in sceneData;

  if (!hasRequiredChoices) {
    // Dynamic options branch
    options = ['speakWithAngie', 'playWithLucia'];

    const playWithLuciaIsComplete =
      watched.includes('reject') && watched.includes('accept');
    // speakWithAngieComplete is computed but unused in the original Python (no effect on flow)

    // Break apart speakWithAngie after it's been seen
    if (
      watched.includes('speakWithAngie') ||
      (playWithLuciaIsComplete && watched.includes('dontSpeakWithAngie_dropout'))
    ) {
      options.push('failBlackmail');
      options.push('failManipulate_racism');
    }

    // After failing blackmail, re-offer win version if condition unlocked
    if (conditionsForWinBlackmail) {
      options = options.filter(o => o !== 'failBlackmail');
      if (watched.includes('speakWithAngie')) {
        options.push('winBlackmail_destruction');
      }
    }

    // After failing manipulate, re-offer win version if condition unlocked
    if (conditionsForWinManipulate) {
      options = options.filter(o => o !== 'failManipulate_racism');
      if (watched.includes('speakWithAngie')) {
        options.push('winManipulate_platonic');
      }
    }

    // Split playWithLucia into its two sub-options
    if (watched.includes('playWithLucia')) {
      options = options.filter(o => o !== 'playWithLucia');
      options.push('reject');
      options.push('accept');
    }

    // After canon speedrun, only choices from that point forward
    if (curScene === 'dontPlayWithLucia_speedrun') {
      options = options.filter(o => o !== 'accept' && o !== 'reject');
    }

    // Dropout is a late-game option
    if (watched.length > 6) {
      options.push('dontSpeakWithAngie_dropout');
    }

    speedrunDeathSpiralGodTrigger =
      watched.filter(s => s === 'accept_speedrun').length +
        watched.filter(s => s === 'reject_speedrun').length ===
      3;

    // Remove already-watched scenes
    options = options.filter(s => !watched.includes(s));

    // Speedrun choices added after the watched filter (can be re-shown)
    if (playWithLuciaIsComplete) {
      options.push('accept_speedrun');
      options.push('reject_speedrun');
    }

    if (curScene === 'reject') {
      options = options.filter(o => o !== 'reject_speedrun');
    } else if (curScene === 'accept') {
      options = options.filter(o => o !== 'accept_speedrun');
    }

    // Port faithful bug: 'winManipulate' never matches any scene ID, so this
    // block is effectively dead code. Preserved for fidelity.
    if (watched.includes('winManipulate')) {
      options = options.filter(
        o =>
          !['failBlackmail', 'winBlackmail', 'winManipulate_platonic', 'failManipulate_racism'].includes(o)
      );
    }

    options = _unique(options);
  } else if (curScene === 'speakWithAngie') {
    // speakWithAngie has requiredChoices in the dict but is handled specially
    if (conditionsForWinBlackmail) {
      options.push('winBlackmail_destruction');
    } else {
      options.push('failBlackmail');
    }
    if (conditionsForWinManipulate) {
      options.push('winManipulate_platonic');
    } else {
      options.push('failManipulate_racism');
    }
  } else {
    // Fixed choices from the scene definition
    options = [...sceneData.requiredChoices];
  }

  // --- Karma & terminal logic ---
  const karma = _calculateKarma(watched);
  const conditionsForForcedGodEnding =
    watched[watched.length - 1] === 'winBlackmail_destruction' ||
    speedrunDeathSpiralGodTrigger;

  let choices = [];

  // karma < -10 force-god (only effective in the else branch below)
  if (karma < -10) {
    choices = ['god', 'god'];
  }

  // Runtime gating
  if (runtime >= 68) {
    options = options.filter(o => o !== 'playWithLucia');
  }
  if (runtime >= 68 && curScene !== 'playWithLucia') {
    options = options.filter(o => o !== 'accept');
  }

  const HEISTKARMACUTOFF = 3;
  const GODKARMACUTOFF = -0.5;

  if (options.length > 2 && runtime <= 75) {
    choices = options.slice(0, 2);
  } else {
    if (runtime >= 75) {
      choices = [];
    } else {
      choices = [...options];
    }

    if (karma >= HEISTKARMACUTOFF) {
      while (choices.length < 2) choices.push('heist');
    } else if (karma <= GODKARMACUTOFF || conditionsForForcedGodEnding) {
      while (choices.length < 2) choices.push('god');
    } else {
      choices.push('god');
      if (choices.length < 2) choices.push('heist');
    }
  }

  // Swap choices if time-period direction would be wrong
  if (choices.length >= 2) {
    const curPeriod = _period(curScene);
    const c0Period = _period(choices[0]);
    const swapCond1 =
      (curPeriod === 'present' || curPeriod === 'speaking') && c0Period === 'past';
    const swapCond2 =
      curPeriod === 'past' &&
      (c0Period === 'present' || c0Period === 'speaking');
    if (swapCond1 || swapCond2) {
      [choices[0], choices[1]] = [choices[1], choices[0]];
    }
  }

  // Bug fix from Python lines 287-288: == was used instead of =
  if (options.includes('accept_speedrun') && watched.includes('accept_speedrun')) {
    choices[0] = 'accept_speedrun';
  } else if (options.includes('reject_speedrun') && watched.includes('reject_speedrun')) {
    choices[0] = 'reject_speedrun';
  }

  return choices;
}

function _calculateKarma(watched) {
  const pairsOfSins = [
    ['cup', 'paperTowel'],
    ['NikoActsAsLucia', 'AngieActsAsLucia'],
    ['dontGiveCigarrette', 'giveCigarrette'],
    ['speakWithAngie', 'playWithLucia'],
    ['reject', 'accept'],
  ];

  let karma = 0;

  for (const currentPair of pairsOfSins) {
    const orderedPair = [];
    for (const scene of watched) {
      if (currentPair.includes(scene) && orderedPair.length < 2) {
        orderedPair.push(scene);
      }
    }
    while (orderedPair.length < 2) orderedPair.push(null);

    if (watched.includes(currentPair[0]) && watched.includes(currentPair[1])) {
      const distanceBetweenGoodAndBad =
        watched.indexOf(currentPair[0]) - watched.indexOf(currentPair[1]);
      karma +=
        _getKarmaVal(orderedPair[0]) +
        _scaler(distanceBetweenGoodAndBad) * _getKarmaVal(orderedPair[1]);
    } else {
      karma += _getKarmaVal(orderedPair[0]);
    }
  }

  return Math.round(karma * 10) / 10;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const Branches = {
  SCENES,

  /**
   * Returns [greenSceneId, redSceneId] given the current watch history.
   * watched must include the currently-playing scene as its last element.
   * Test: Branches.getNextChoices(['start']) → ['cup', 'paperTowel']
   */
  getNextChoices(watched) {
    const choices = _buildChoices(watched);
    return [choices[0] || null, choices[1] || null];
  },

  /**
   * Returns any speedrun scenes that must play before the chosen scene.
   * Returns [] if no speedrun is needed.
   * Returns ['playWithLucia_speedrun'] for present/speaking → past transitions.
   * Returns ['dontPlayWithLucia_speedrun'] for past → present/speaking transitions.
   */
  getSpeedrunPrefix(curSceneId, chosenSceneId) {
    const curPeriod = _period(curSceneId);
    const chosenPeriod = _period(chosenSceneId);

    if (
      (curPeriod === 'speaking' || curPeriod === 'present') &&
      (chosenSceneId === 'reject' || chosenSceneId === 'accept')
    ) {
      return ['playWithLucia_speedrun'];
    }

    if (
      curPeriod === 'past' &&
      (chosenPeriod === 'present' || chosenPeriod === 'speaking')
    ) {
      return ['dontPlayWithLucia_speedrun'];
    }

    return [];
  },

  /**
   * Calculates karma from the watched history.
   */
  calculateKarma(watched) {
    return _calculateKarma(watched);
  },

  /**
   * Returns true if the scene is a terminal ending (god / heist).
   */
  isTerminal(sceneId) {
    return SCENES[sceneId] ? SCENES[sceneId].period === 'terminal' : false;
  },

  /**
   * Returns 'fixed' | 'filmed' | 'unfilmed'.
   * fixed   — choices come directly from the scene's requiredChoices list.
   * filmed  — dynamic choices but we have video footage (in FILMED_DYNAMIC_CHOICES).
   * unfilmed — dynamic choices, no footage yet (show looping thumbnail panels).
   */
  getChoiceMode(watched, greenId, redId) {
    const curScene = watched[watched.length - 1];
    const sceneData = SCENES[curScene];

    // Fixed: scene has a requiredChoices list and it isn't speakWithAngie
    // (speakWithAngie has placeholder requiredChoices but is dynamically resolved)
    if (sceneData && sceneData.requiredChoices && curScene !== 'speakWithAngie') {
      return 'fixed';
    }

    // Filmed: dynamic choice with recorded footage
    for (const pair of FILMED_DYNAMIC_CHOICES) {
      if (
        (pair[0] === greenId && pair[1] === redId) ||
        (pair[0] === redId && pair[1] === greenId)
      ) {
        return 'filmed';
      }
    }

    return 'unfilmed';
  },

  /**
   * Returns true if the scene has fake choice timestamps defined.
   */
  hasFakeChoices(sceneId) {
    return !!(
      SCENES[sceneId] &&
      SCENES[sceneId].fakeChoices &&
      SCENES[sceneId].fakeChoices.length > 0
    );
  },

  /**
   * Returns the fakeChoices array for the scene (empty array if none).
   */
  getFakeChoices(sceneId) {
    return (SCENES[sceneId] && SCENES[sceneId].fakeChoices) || [];
  },
};
