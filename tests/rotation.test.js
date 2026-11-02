const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'Weverse Video Rotation.user.js'), 'utf8');

function setup({ width = 1600, height = 900, videoWidth = 1600, videoHeight = 900, fit = 'contain' } = {}) {
  const windowListeners = new Map();
  const videoListeners = new Map();
  const classes = new Set();
  const properties = new Map();
  const player = { clientWidth: width, clientHeight: height };
  const video = {
    clientWidth: width, clientHeight: height, videoWidth, videoHeight,
    parentElement: player,
    closest: () => player,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle: name => classes.has(name) ? classes.delete(name) : classes.add(name),
    },
    style: {
      setProperty: (name, value) => properties.set(name, Number(value)),
      removeProperty: name => properties.delete(name),
    },
    addEventListener: (name, fn) => videoListeners.set(name, fn),
    removeEventListener: (name, fn) => { if (videoListeners.get(name) === fn) videoListeners.delete(name); },
  };
  const elements = new Map();
  const parent = { insertBefore: element => elements.set(element.id, element) };
  const reaction = { parentNode: parent };
  let injectedCss;
  let resizeObserver;
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = []; resizeObserver = this; }
    observe(target) { this.targets.push(target); }
    disconnect() { this.targets = []; }
  }
  const document = {
    body: {},
    head: { appendChild: element => elements.set(element.id, element) },
    getElementById: id => elements.get(id),
    querySelector: selector => selector.startsWith('.media-post-header') ? reaction : video,
    createElement: tag => ({
      tagName: tag.toUpperCase(), dataset: {}, children: [], attributes: {},
      appendChild(child) { this.children.push(child); },
      setAttribute(name, value) { this.attributes[name] = value; },
    }),
  };
  const window = {
    addEventListener: (name, fn) => windowListeners.set(name, fn),
    removeEventListener: (name, fn) => { if (windowListeners.get(name) === fn) windowListeners.delete(name); },
  };
  const context = vm.createContext({
    document, window, ResizeObserver,
    MutationObserver: class { observe() {} },
    getComputedStyle: () => ({ objectFit: fit }),
    GM_addStyle: css => { injectedCss = css; },
  });
  vm.runInContext(source, context);
  function press(code) {
    windowListeners.get('keydown')({ code, target: {}, preventDefault() {}, stopPropagation() {} });
  }
  return { video, player, classes, properties, elements, videoListeners, windowListeners, press,
    get resizeObserver() { return resizeObserver; }, injectedCss };
}

test('controls retain their visible labels and expose actions and keyboard focus', () => {
  const app = setup();
  const buttons = app.elements.get('video-rotation-controls').children;
  assert.equal(buttons.length, 6);
  assert.equal(buttons[0].textContent, '🠘');
  for (const button of buttons) assert.equal(button.attributes['aria-label'], button.title);
  assert.match(app.injectedCss, /button:focus-visible\s*\{[^}]*outline:\s*2px solid/s);
  assert.doesNotMatch(app.injectedCss, /outline:\s*0/);
  assert.match(app.injectedCss, /button:hover\s*\{[^}]*background:\s*#e8e8e8/s);
  const css = app.elements.get('video-rotation-transform-styles').textContent;
  assert.ok(css.includes('}\nvideo.'));
  assert.ok(!css.includes('}\\nvideo.'));
});

test('quarter turns fit the rendered picture for landscape, portrait and square video', () => {
  for (const [videoWidth, videoHeight, expected] of [[1600, 900, 0.5625], [900, 1600, 1600 / 900], [1000, 1000, 1]]) {
    const app = setup({ videoWidth, videoHeight });
    app.press('Numpad4');
    assert.ok(app.classes.has('r270'));
    assert.ok(Math.abs(app.properties.get('--video-rotation-scale') - expected) < 1e-10);
  }
});

test('rotation scale responds to player and video changes and preserves flips on reset', () => {
  const app = setup({ videoWidth: 1200, videoHeight: 800 });
  app.press('Numpad6');
  assert.ok(app.classes.has('r90'));
  assert.ok(Math.abs(app.properties.get('--video-rotation-scale') - 2 / 3) < 1e-10);
  assert.deepEqual(app.resizeObserver.targets, [app.video, app.player]);
  app.player.clientHeight = 600;
  app.resizeObserver.callback();
  assert.ok(Math.abs(app.properties.get('--video-rotation-scale') - 4 / 9) < 1e-10);
  app.video.videoWidth = 800;
  app.video.videoHeight = 1200;
  app.videoListeners.get('resize')();
  assert.ok(Math.abs(app.properties.get('--video-rotation-scale') - 1) < 1e-10);
  app.press('Numpad9');
  assert.ok(app.classes.has('flipH'));
  app.press('Numpad8');
  assert.ok(app.classes.has('flipH'));
  assert.ok(!app.classes.has('r90'));
  assert.ok(!app.properties.has('--video-rotation-scale'));
  assert.deepEqual(app.resizeObserver.targets, []);
  assert.equal(app.videoListeners.size, 0);
});

test('element dimensions are used for stretched video and metadata updates recalculate the scale', () => {
  const app = setup({ width: 1000, height: 800, videoWidth: 0, videoHeight: 0 });
  app.press('Numpad6');
  assert.equal(app.properties.get('--video-rotation-scale'), 0.8);
  app.video.videoWidth = 500;
  app.video.videoHeight = 1000;
  app.videoListeners.get('loadedmetadata')();
  assert.equal(app.properties.get('--video-rotation-scale'), 1.25);
  const stretched = setup({ width: 1000, height: 800, videoWidth: 500, videoHeight: 1000, fit: 'fill' });
  stretched.press('Numpad6');
  assert.equal(stretched.properties.get('--video-rotation-scale'), 0.8);
});
