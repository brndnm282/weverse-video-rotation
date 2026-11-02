// ==UserScript==
// @name        Weverse Video Rotation
// @description Adds buttons and keyboard shortcuts to rotate and flip the video on Weverse.io
// @version     2
// @author      Slooshi
// @namespace   Slooshi
// @match       https://weverse.io/*
// @license     MIT
// @grant       GM_addStyle
// @downloadURL https://update.greasyfork.org/scripts/527066/Weverse%20Video%20Rotation.user.js
// @updateURL https://update.greasyfork.org/scripts/527066/Weverse%20Video%20Rotation.meta.js
// ==/UserScript==

GM_addStyle(`
#video-rotation-controls {
\tmargin-left: 15px;
\tmargin-right: 15px;
\tdisplay: inline-flex;
\talign-items: center;
\tvertical-align: middle;
\tflex-shrink: 0;
\tgap: 3px;
\tz-index: 20;
}
#video-rotation-controls button {
\tfont-size: 20px;
\tbackground: #f5f5f5;
\tborder: 1px solid #d9d9d9;
\tborder-radius: 4px;
\tcolor: #414141;
\tline-height: 22px;
\theight: 24px;
\twidth: 24px;
\tpadding: 0;
\tcursor: pointer;
\toutline: 0;
\tdisplay: inline-flex;
\talign-items: center;
\tjustify-content: center;
}
#video-rotation-controls button:hover {
\tbackground: #e8e8e8;
}
.vwplayer_vlivelive .videoBox,
.webplayer-internal-container {
\theight: calc(100% - 4px);
\twidth: calc(100% - 4px);
}
.media-post-detail-layout_--player,
.webplayer-internal-container,
.pzp-pc-video-wrapper,
.pzp-pc__video-wrapper {
\toverflow: hidden;
}
`);

const directions = {
\tleft: 'r270',
\tup: 'r0',
\tright: 'r90',
\tdown: 'r180',
\tflipH: 'flipH',
\tflipV: 'flipV',
};

const rotations = {
\tr90: 'rotate(90deg)',
\tr180: 'rotate(180deg)',
\tr270: 'rotate(270deg)',
};

const scaling = {
\tflipH: 'scaleX(-1)',
\tflipV: 'scaleY(-1)',
\tportrait: 'scale(1.77777)',
\tlandscape: 'scale(0.5625)',
};

const controlsID = 'video-rotation-controls';
let shortcutsEnabled = true;
const shortcuts = {
\t'Numpad8': directions.up,
\t'Numpad2': directions.down,
\t'Numpad4': directions.left,
\t'Numpad6': directions.right,
\t'Numpad9': directions.flipH,
\t'Numpad3': directions.flipV,
};

// Target reaction_wrap element in the media post header
const REACTION_WRAP_SELECTORS = [
\t'.media-post-header_--reaction_wrap',
\t'.media-post-header-_-reaction_wrap',
\t'[class*="media-post-header"][class*="reaction_wrap"]',
].join(', ');

// Current Weverse / Naver Prism Player video selectors
const VIDEO_SELECTORS = [
\t'video.webplayer-internal-video',
\t'.media-post-detail-layout_--player video',
\t'.pzp video',
\t'video',
].join(', ');

function getReactionWrapElement() {
\treturn document.querySelector(REACTION_WRAP_SELECTORS);
}

function getVideoElement() {
\treturn document.querySelector(VIDEO_SELECTORS);
}

function initTransformStylesheet() {
\tif (document.getElementById('video-rotation-transform-styles')) {
\t\treturn;
\t}

\tconst stylesheet = document.createElement('style');
\tstylesheet.id = 'video-rotation-transform-styles';
\tconst rules = [];

\tconst getAllSubsets = arr =>
\t\tarr.reduce((subsets, value) => subsets.concat(subsets.map(set => [...set, value])), [[]]).slice(1);
\tconst scalings = getAllSubsets(Object.keys(scaling));

\tfor (const rule in rotations) {
\t\trules.push(`video.${rule} { transform: ${rotations[rule]} !important; }`);
\t\tfor (const scalingSet of scalings) {
\t\t\tconst selectorSuffix = scalingSet.map(c => `.${c}`).join('');
\t\t\tconst transformSuffix = scalingSet.map(c => scaling[c]).join(' ');
\t\t\trules.push(`video.${rule}${selectorSuffix} { transform: ${rotations[rule]} ${transformSuffix} !important; }`);
\t\t}
\t}

\tconst flips = getAllSubsets([directions.flipH, directions.flipV]);
\tfor (const flipSet of flips) {
\t\tconst selectorSuffix = flipSet.map(c => `.${c}`).join('');
\t\tconst transformValue = flipSet.map(c => scaling[c]).join(' ');
\t\trules.push(`video${selectorSuffix} { transform: ${transformValue} !important; }`);
\t}

\tstylesheet.textContent = rules.join('\\n');
\tdocument.head.appendChild(stylesheet);
}

function addButtons() {
\tif (document.getElementById(controlsID)) {
\t\treturn;
\t}

\tconst reactionWrap = getReactionWrapElement();
\tif (!reactionWrap || !reactionWrap.parentNode) {
\t\treturn;
\t}

\tconst btnDirections = [
\t\t[directions.left, '🠘', 'Rotate Left (Numpad 4)'],
\t\t[directions.up, '🠙', 'Reset Rotation (Numpad 8)'],
\t\t[directions.right, '🠚', 'Rotate Right (Numpad 6)'],
\t\t[directions.down, '🠛', 'Rotate 180° (Numpad 2)'],
\t\t[directions.flipV, '🡙', 'Flip Vertically (Numpad 3)'],
\t\t[directions.flipH, '🡘', 'Flip Horizontally (Numpad 9)'],
\t];

\tconst div = document.createElement('div');
\tdiv.id = controlsID;

\tfor (const [dir, label, title] of btnDirections) {
\t\tconst btn = document.createElement('button');
\t\tbtn.type = 'button';
\t\tbtn.dataset.direction = dir;
\t\tbtn.textContent = label;
\t\tif (title) btn.title = title;
\t\tdiv.appendChild(btn);
\t}

\treactionWrap.parentNode.insertBefore(div, reactionWrap);
}

function rotateVideo(direction) {
\tconst video = getVideoElement();
\tif (!video) return;

\tconst flip = [directions.flipH, directions.flipV].includes(direction);

\tif (flip) {
\t\tvideo.classList.toggle(direction);
\t} else {
\t\tvideo.classList.remove(directions.left, directions.right, directions.down, 'portrait', 'landscape');
\t\tif (direction !== directions.up) {
\t\t\tvideo.classList.add(direction);
\t\t\tif ([directions.left, directions.right].includes(direction)) {
\t\t\t\tvideo.classList.add(video.videoHeight > video.videoWidth ? 'portrait' : 'landscape');
\t\t\t}
\t\t}
\t}
}

function isEditableTarget(target) {
\tif (!target) return false;
\tconst tag = target.tagName ? target.tagName.toLowerCase() : '';
\treturn tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

(() => {
\tinitTransformStylesheet();
\taddButtons();

\t// Re-add buttons automatically across React SPA navigation and async header rendering
\tconst observer = new MutationObserver(() => {
\t\tif (!document.getElementById(controlsID) && getReactionWrapElement()) {
\t\t\taddButtons();
\t\t}
\t});

\tif (document.body) {
\t\tobserver.observe(document.body, { childList: true, subtree: true });
\t} else {
\t\twindow.addEventListener('DOMContentLoaded', () => {
\t\t\tobserver.observe(document.body, { childList: true, subtree: true });
\t\t\taddButtons();
\t\t});
\t}
})();

window.addEventListener('click', function(e) {
\tconst btn = e.target.closest ? e.target.closest(`#${controlsID} button`) : e.target;
\tif (!btn || !btn.dataset.direction) {
\t\treturn;
\t}
\trotateVideo(btn.dataset.direction);
}, true);

// Shortcuts
window.addEventListener('keydown', function(e) {
\tif (isEditableTarget(e.target)) {
\t\treturn;
\t}

\tlet stopPropagation = false;
\tif (shortcuts[e.code] && shortcutsEnabled) {
\t\trotateVideo(shortcuts[e.code]);
\t\tstopPropagation = true;
\t} else if (e.code === 'Pause') {
\t\tshortcutsEnabled = !shortcutsEnabled;
\t\tstopPropagation = true;
\t}

\tif (stopPropagation) {
\t\te.preventDefault();
\t\te.stopPropagation();
\t}
}, true);
