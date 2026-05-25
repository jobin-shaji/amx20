const CONFIG = {
  trunkRevealDelay: 120,
  branchesRevealDelay: 1680,
  canopyRevealDelay: 3750,
  finalLayoutDelay: 5450,
  desktopHeartCount: 1000,
  mobileHeartCount: 650
};

const state = {
  currentView: 'home',
  surpriseTimeouts: [],
  ambientSynth: null,
  audioUnlockBound: false
};

const screens = {
  home: document.getElementById('view-home'),
  refusal: document.getElementById('view-refusal'),
  surprise: document.getElementById('view-surprise')
};

const btns = {
  yes: document.getElementById('btn-yes'),
  no: document.getElementById('btn-no'),
  tryAgain: document.getElementById('btn-try-again'),
  restart: document.getElementById('btn-restart')
};

const heartCanopy = document.getElementById('heart-canopy');
const butterflyLayer = document.getElementById('butterfly-layer');
const treePaths = Array.from(document.querySelectorAll('.tree-path'));

const HEART_COLORS = [
  '#ff4f87',
  '#ff6b45',
  '#ff8f1f',
  '#ff77c8',
  '#ff2f6d',
  '#ff9eb9',
  '#f95d9b',
  '#ffb347'
];

const BUTTERFLY_COLORS = [
  'linear-gradient(135deg, rgba(255, 118, 190, 0.95), rgba(255, 184, 212, 0.92))',
  'linear-gradient(135deg, rgba(255, 151, 58, 0.95), rgba(255, 215, 130, 0.92))',
  'linear-gradient(135deg, rgba(255, 83, 124, 0.95), rgba(255, 162, 204, 0.9))',
  'linear-gradient(135deg, rgba(255, 105, 150, 0.95), rgba(255, 218, 130, 0.88))'
];

function initRouter() {
  const handleHashChange = () => {
    const hash = window.location.hash || '#/';
    let targetView = 'home';

    if (hash === '#/no') {
      targetView = 'refusal';
    } else if (hash === '#/surprise') {
      targetView = 'surprise';
    }

    switchView(targetView);
  };

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

function switchView(viewName) {
  state.currentView = viewName;

  Object.keys(screens).forEach(key => {
    screens[key].classList.toggle('active', key === viewName);
  });

  if (viewName === 'home') {
    document.body.style.backgroundColor = 'var(--bg-home)';
    stopSurpriseScene();
  } else if (viewName === 'refusal') {
    document.body.style.backgroundColor = 'var(--bg-refusal)';
    stopSurpriseScene();
  } else if (viewName === 'surprise') {
    document.body.style.backgroundColor = 'var(--bg-surprise)';
    startSurpriseScene();
  }
}

class AmbientSynth {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.isPlaying = false;
    this.nodes = [];
  }

  start() {
    if (this.isPlaying) return;

    const beginPlayback = () => {
      if (this.isPlaying) {
        this.scheduleNextChord();
      }
    };

    this.isPlaying = true;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
        .then(beginPlayback)
        .catch(() => {
          this.isPlaying = false;
        });
      return;
    }

    beginPlayback();
  }

  stop() {
    this.isPlaying = false;
    this.nodes.forEach(node => {
      try {
        node.stop();
      } catch (error) {
        // Ignore nodes that have already stopped.
      }
    });
    this.nodes = [];
  }

  playTone(freq, duration, type = 'triangle', volume = 0.05) {
    if (!this.isPlaying) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);

    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 1.5);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);

    this.nodes.push(osc);

    window.setTimeout(() => {
      this.nodes = this.nodes.filter(node => node !== osc);
    }, duration * 1000 + 100);
  }

  scheduleNextChord() {
    if (!this.isPlaying) return;

    const progressions = [
      [174.61, 220.0, 261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63, 392.0, 440.0],
      [130.81, 164.81, 196.0, 246.94, 293.66],
      [196.0, 246.94, 293.66, 392.0, 493.88]
    ];

    const chord = progressions[Math.floor(Math.random() * progressions.length)];

    chord.forEach((freq, index) => {
      window.setTimeout(() => {
        this.playTone(freq, 8, 'sine', 0.035);
      }, index * 200);
    });

    window.setTimeout(() => {
      const melodyNotes = [329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
      const note = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
      this.playTone(note, 4, 'triangle', 0.015);
    }, 3000);

    window.setTimeout(() => this.scheduleNextChord(), 9000);
  }
}

function ensureAmbientMusic() {
  if (!state.ambientSynth) {
    state.ambientSynth = new AmbientSynth();
  }

  state.ambientSynth.start();
}

function bindAudioUnlock() {
  if (state.audioUnlockBound) return;

  const unlockAudio = () => {
    ensureAmbientMusic();
  };

  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  state.audioUnlockBound = true;
}

function prepareTreePaths() {
  treePaths.forEach(path => {
    const length = path.getTotalLength();
    path.style.setProperty('--path-length', `${length}`);
  });
}

function queueSurpriseTimeout(callback, delay) {
  const timeoutId = window.setTimeout(() => {
    state.surpriseTimeouts = state.surpriseTimeouts.filter(id => id !== timeoutId);
    callback();
  }, delay);

  state.surpriseTimeouts.push(timeoutId);
}

function clearSurpriseTimeouts() {
  state.surpriseTimeouts.forEach(timeoutId => window.clearTimeout(timeoutId));
  state.surpriseTimeouts = [];
}

function resetSurpriseScene() {
  screens.surprise.classList.remove(
    'butterflies-active',
    'sequence-started',
    'trunk-grown',
    'branches-grown',
    'canopy-active',
    'final-layout'
  );
}

function createHeartLeaf(leaf) {
  const heart = document.createElement('div');
  const core = document.createElement('span');

  heart.className = 'heart-leaf';
  heart.style.setProperty('--heart-x', `${leaf.x}%`);
  heart.style.setProperty('--heart-y', `${leaf.y}%`);
  heart.style.setProperty('--heart-size', `${leaf.size}px`);
  heart.style.setProperty('--heart-color', leaf.color);
  heart.style.setProperty('--heart-delay', `${leaf.delay}s`);
  heart.style.zIndex = `${leaf.zIndex}`;

  heart.appendChild(core);
  return heart;
}

function generateHeartLeaves(count) {
  const leaves = [];
  const outlineCount = Math.floor(count * 0.34);
  const fillCount = count - outlineCount;
  let attempts = 0;

  for (let i = 0; i < outlineCount; i++) {
    const point = getHeartOutlinePoint();
    leaves.push(createLeafFromHeartPoint(point.x, point.y, true));
  }

  while (leaves.length < count && attempts < fillCount * 220) {
    const x = -1.08 + Math.random() * 2.16;
    const y = -1.15 + Math.random() * 2.12;
    const equation = Math.pow((x * x + y * y - 1), 3) - x * x * Math.pow(y, 3);
    attempts += 1;

    if (equation > 0) continue;

    const centerDistance = Math.hypot(x * 0.9, y * 0.72);
    if (centerDistance < 0.18 && Math.random() < 0.12) continue;
    if (y > 0.94 && Math.random() < 0.12) continue;

    leaves.push(createLeafFromHeartPoint(x, y, false));
  }

  return leaves;
}

function createLeafFromHeartPoint(x, y, isOutline) {
  const centerX = 50;
  const centerY = 42;
  const heartWidth = 66;
  const heartHeight = 58;
  const jitterX = isOutline ? (Math.random() - 0.5) * 1.4 : (Math.random() - 0.5) * 1.8;
  const jitterY = isOutline ? (Math.random() - 0.5) * 1.2 : (Math.random() - 0.5) * 1.6;
  const sizeBase = isOutline ? 8.6 : 8.5;
  const size = sizeBase + Math.random() * (isOutline ? 7.8 : 7.6);

  return {
    x: centerX + x * (heartWidth / 2) + jitterX,
    y: centerY - y * (heartHeight / 2) + jitterY,
    size,
    color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
    delay: 0.02 + Math.random() * 0.85,
    zIndex: 3 + Math.floor(Math.random() * 5)
  };
}

function getHeartOutlinePoint() {
  const t = Math.random() * Math.PI * 2;
  const x = Math.pow(Math.sin(t), 3);
  const rawY =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);
  const y = rawY / 17;
  const inwardScale = 0.9 + Math.random() * 0.12;

  return {
    x: x * inwardScale,
    y: y * inwardScale
  };
}

function renderHeartCanopy() {
  if (!heartCanopy) return;

  const heartCount = window.innerWidth <= 700 ? CONFIG.mobileHeartCount : CONFIG.desktopHeartCount;
  const leaves = generateHeartLeaves(heartCount);
  const fragment = document.createDocumentFragment();

  heartCanopy.innerHTML = '';
  leaves.forEach(leaf => {
    fragment.appendChild(createHeartLeaf(leaf));
  });

  heartCanopy.appendChild(fragment);
}

function createButterfly() {
  const butterfly = document.createElement('div');
  const body = document.createElement('div');
  const wingLeftTop = document.createElement('span');
  const wingRightTop = document.createElement('span');
  const wingLeftBottom = document.createElement('span');
  const wingRightBottom = document.createElement('span');
  const core = document.createElement('span');

  butterfly.className = 'butterfly';
  body.className = 'butterfly-body';
  wingLeftTop.className = 'butterfly-wing left top';
  wingRightTop.className = 'butterfly-wing right top';
  wingLeftBottom.className = 'butterfly-wing left bottom';
  wingRightBottom.className = 'butterfly-wing right bottom';
  core.className = 'butterfly-core';

  const size = 22 + Math.random() * 24;
  const top = 12 + Math.random() * 64;
  const duration = 13 + Math.random() * 9;
  const delay = -Math.random() * duration;
  const drift = `${(Math.random() - 0.5) * 64}px`;
  const scale = (0.72 + Math.random() * 0.5).toFixed(2);
  const color = BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)];

  butterfly.style.setProperty('--butterfly-size', `${size}px`);
  butterfly.style.setProperty('--fly-top', `${top}%`);
  butterfly.style.setProperty('--fly-duration', `${duration}s`);
  butterfly.style.setProperty('--fly-delay', `${delay}s`);
  butterfly.style.setProperty('--fly-drift', drift);
  butterfly.style.setProperty('--fly-scale', scale);
  butterfly.style.setProperty('--butterfly-color', color);

  body.append(wingLeftTop, wingRightTop, wingLeftBottom, wingRightBottom, core);
  butterfly.appendChild(body);

  return butterfly;
}

function renderButterflies() {
  if (!butterflyLayer) return;

  const count = window.innerWidth <= 700 ? 4 : 7;
  const fragment = document.createDocumentFragment();

  butterflyLayer.innerHTML = '';
  for (let i = 0; i < count; i++) {
    fragment.appendChild(createButterfly());
  }

  butterflyLayer.appendChild(fragment);
}

function startSurpriseScene() {
  clearSurpriseTimeouts();
  resetSurpriseScene();
  renderHeartCanopy();
  renderButterflies();
  ensureAmbientMusic();

  void screens.surprise.offsetWidth;

  window.requestAnimationFrame(() => {
    screens.surprise.classList.add('butterflies-active');
    screens.surprise.classList.add('sequence-started');
  });

  queueSurpriseTimeout(() => {
    if (state.currentView === 'surprise') {
      screens.surprise.classList.add('trunk-grown');
    }
  }, CONFIG.trunkRevealDelay);

  queueSurpriseTimeout(() => {
    if (state.currentView === 'surprise') {
      screens.surprise.classList.add('branches-grown');
    }
  }, CONFIG.branchesRevealDelay);

  queueSurpriseTimeout(() => {
    if (state.currentView === 'surprise') {
      screens.surprise.classList.add('canopy-active');
    }
  }, CONFIG.canopyRevealDelay);

  queueSurpriseTimeout(() => {
    if (state.currentView === 'surprise') {
      screens.surprise.classList.add('final-layout');
    }
  }, CONFIG.finalLayoutDelay);
}

function stopSurpriseScene() {
  clearSurpriseTimeouts();
  resetSurpriseScene();
}

function initEvents() {
  btns.yes.addEventListener('click', () => {
    window.location.hash = '#/surprise';
  });

  btns.no.addEventListener('click', () => {
    window.location.hash = '#/no';
  });

  btns.tryAgain.addEventListener('click', () => {
    window.location.hash = '#/';
  });

  btns.restart.addEventListener('click', () => {
    window.location.hash = '#/';
  });

  window.addEventListener('resize', () => {
    if (state.currentView === 'surprise') {
      renderHeartCanopy();
      renderButterflies();
    }
  });
}

function init() {
  prepareTreePaths();
  renderHeartCanopy();
  renderButterflies();
  ensureAmbientMusic();
  bindAudioUnlock();
  initRouter();
  initEvents();
}

window.addEventListener('DOMContentLoaded', init);
