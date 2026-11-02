// ==UserScript==
// @name        Weverse Video Rotation
// @description Adds buttons and keyboard shortcuts to rotate and flip the video on Weverse.io
// @version     2
// @author      brndnm282
// @namespace   https://github.com/brndnm282/weverse-video-rotation
// @supportURL  https://github.com/brndnm282/weverse-video-rotationissues
// @match       https://weverse.io/*
// @license     MIT
// @grant       GM_addStyle
// @downloadURL https://update.greasyfork.org/scripts/527066/Weverse%20Video%20Rotation.user.js
// @updateURL   https://update.greasyfork.org/scripts/527066/Weverse%20Video%20Rotation.meta.js
// ==/UserScript==

GM_addStyle(`
#video-rotation-controls {
	margin-left: 15px;
	margin-right: 15px;
	display: inline-flex;
	align-items: center;
	vertical-align: middle;
	flex-shrink: 0;
	gap: 3px;
	z-index: 20;
}
#video-rotation-controls button {
	font-size: 20px;
	background: #f5f5f5;
	border: 1px solid #d9d9d9;
	border-radius: 4px;
	color: #414141;
	line-height: 22px;
	height: 24px;
	width: 24px;
	padding: 0;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}
#video-rotation-controls button:hover {
	background: #e8e8e8;
}
#video-rotation-controls button:focus-visible {
	outline: 2px solid #005fcc;
	outline-offset: 2px;
}
.vwplayer_vlivelive .videoBox,
.webplayer-internal-container {
	height: calc(100% - 4px);
	width: calc(100% - 4px);
}
.media-post-detail-layout_--player,
.webplayer-internal-container,
.pzp-pc-video-wrapper,
.pzp-pc__video-wrapper {
	overflow: hidden;
}
`);

const directions = {
	left: 'r270',
	up: 'r0',
	right: 'r90',
	down: 'r180',
	flipH: 'flipH',
	flipV: 'flipV',
};

const rotations = {
	r90: 'rotate(90deg) scale(var(--video-rotation-scale, 1))',
	r180: 'rotate(180deg)',
	r270: 'rotate(270deg) scale(var(--video-rotation-scale, 1))',
};

const scaling = {
	flipH: 'scaleX(-1)',
	flipV: 'scaleY(-1)',
};

const controlsID = 'video-rotation-controls';
let shortcutsEnabled = true;
const shortcuts = {
	'Numpad8': directions.up,
	'Numpad2': directions.down,
	'Numpad4': directions.left,
	'Numpad6': directions.right,
	'Numpad9': directions.flipH,
	'Numpad3': directions.flipV,
};

// Target reaction_wrap element in the media post header
const REACTION_WRAP_SELECTORS = [
	'.media-post-header_--reaction_wrap',
	'.media-post-header-_-reaction_wrap',
	'[class*="media-post-header"][class*="reaction_wrap"]',
].join(', ');

// Current Weverse / Naver Prism Player video selectors
const VIDEO_SELECTORS = [
	'video.webplayer-internal-video',
	'.media-post-detail-layout_--player video',
	'.pzp video',
	'video',
].join(', ');

function getReactionWrapElement() {
	return document.querySelector(REACTION_WRAP_SELECTORS);
}

function getVideoElement() {
	return document.querySelector(VIDEO_SELECTORS);
}

function initTransformStylesheet() {
	if (document.getElementById('video-rotation-transform-styles')) {
		return;
	}

	const stylesheet = document.createElement('style');
	stylesheet.id = 'video-rotation-transform-styles';
	const rules = [];

	const getAllSubsets = arr =>
		arr.reduce((subsets, value) => subsets.concat(subsets.map(set => [...set, value])), [[]]).slice(1);
	const scalings = getAllSubsets(Object.keys(scaling));

	for (const rule in rotations) {
		rules.push(`video.${rule} { transform: ${rotations[rule]} !important; }`);
		for (const scalingSet of scalings) {
			const selectorSuffix = scalingSet.map(c => `.${c}`).join('');
			const transformSuffix = scalingSet.map(c => scaling[c]).join(' ');
			rules.push(`video.${rule}${selectorSuffix} { transform: ${rotations[rule]} ${transformSuffix} !important; }`);
		}
	}

	const flips = getAllSubsets([directions.flipH, directions.flipV]);
	for (const flipSet of flips) {
		const selectorSuffix = flipSet.map(c => `.${c}`).join('');
		const transformValue = flipSet.map(c => scaling[c]).join(' ');
		rules.push(`video${selectorSuffix} { transform: ${transformValue} !important; }`);
	}

	stylesheet.textContent = rules.join('\n');
	document.head.appendChild(stylesheet);
}

function addButtons() {
	if (document.getElementById(controlsID)) {
		return;
	}

	const reactionWrap = getReactionWrapElement();
	if (!reactionWrap || !reactionWrap.parentNode) {
		return;
	}

	const btnDirections = [
		[directions.left, '🠘', 'Rotate Left (Numpad 4)'],
		[directions.up, '🠙', 'Reset Rotation (Numpad 8)'],
		[directions.right, '🠚', 'Rotate Right (Numpad 6)'],
		[directions.down, '🠛', 'Rotate 180° (Numpad 2)'],
		[directions.flipV, '🡙', 'Flip Vertically (Numpad 3)'],
		[directions.flipH, '🡘', 'Flip Horizontally (Numpad 9)'],
	];

	const div = document.createElement('div');
	div.id = controlsID;

	for (const [dir, label, title] of btnDirections) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.dataset.direction = dir;
		btn.textContent = label;
		if (title) {
			btn.title = title;
			btn.setAttribute('aria-label', title);
		}
		div.appendChild(btn);
	}

	reactionWrap.parentNode.insertBefore(div, reactionWrap);
}

let observedVideo = null;
let resizeObserver = null;

function updateRotationScale() {
	if (!observedVideo) return;
	const video = observedVideo;
	const player = video.closest('.webplayer-internal-container, .media-post-detail-layout_--player, .pzp-pc-video-wrapper, .pzp-pc__video-wrapper') || video.parentElement;
	if (!player) return;

	let width = video.clientWidth;
	let height = video.clientHeight;
	const playerWidth = player.clientWidth;
	const playerHeight = player.clientHeight;
	if (!width || !height || !playerWidth || !playerHeight) return;

	// Measure the visible picture within a letterboxed video element.
	const fit = getComputedStyle(video).objectFit;
	if (video.videoWidth && video.videoHeight && (fit === 'contain' || fit === 'scale-down')) {
		let contentScale = Math.min(width / video.videoWidth, height / video.videoHeight);
		if (fit === 'scale-down') contentScale = Math.min(contentScale, 1);
		width = video.videoWidth * contentScale;
		height = video.videoHeight * contentScale;
	}
	video.style.setProperty('--video-rotation-scale', Math.min(playerWidth / height, playerHeight / width));
}

function stopObservingVideo() {
	if (!observedVideo) return;
	if (resizeObserver) resizeObserver.disconnect();
	observedVideo.removeEventListener('loadedmetadata', updateRotationScale);
	observedVideo.removeEventListener('resize', updateRotationScale);
	window.removeEventListener('resize', updateRotationScale);
	observedVideo.style.removeProperty('--video-rotation-scale');
	observedVideo = null;
}

function observeVideo(video) {
	stopObservingVideo();
	observedVideo = video;
	const player = video.closest('.webplayer-internal-container, .media-post-detail-layout_--player, .pzp-pc-video-wrapper, .pzp-pc__video-wrapper') || video.parentElement;
	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(updateRotationScale);
		resizeObserver.observe(video);
		if (player) resizeObserver.observe(player);
	}
	video.addEventListener('loadedmetadata', updateRotationScale);
	video.addEventListener('resize', updateRotationScale);
	window.addEventListener('resize', updateRotationScale);
	updateRotationScale();
}

function rotateVideo(direction) {
	const video = getVideoElement();
	if (!video) return;

	const flip = [directions.flipH, directions.flipV].includes(direction);

	if (flip) {
		video.classList.toggle(direction);
	} else {
		stopObservingVideo();
		video.classList.remove(directions.left, directions.right, directions.down);
		if (direction !== directions.up) {
			video.classList.add(direction);
			if ([directions.left, directions.right].includes(direction)) {
				observeVideo(video);
			}
		}
	}
}

function isEditableTarget(target) {
	if (!target) return false;
	const tag = target.tagName ? target.tagName.toLowerCase() : '';
	return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

(() => {
	initTransformStylesheet();
	addButtons();

	// Re-add buttons automatically across React SPA navigation and async header rendering
	const observer = new MutationObserver(() => {
		if (!document.getElementById(controlsID) && getReactionWrapElement()) {
			addButtons();
		}
	});

	if (document.body) {
		observer.observe(document.body, { childList: true, subtree: true });
	} else {
		window.addEventListener('DOMContentLoaded', () => {
			observer.observe(document.body, { childList: true, subtree: true });
			addButtons();
		});
	}
})();

window.addEventListener('click', function(e) {
	const btn = e.target.closest ? e.target.closest(`#${controlsID} button`) : e.target;
	if (!btn || !btn.dataset.direction) {
		return;
	}
	rotateVideo(btn.dataset.direction);
}, true);

// Shortcuts
window.addEventListener('keydown', function(e) {
	if (isEditableTarget(e.target)) {
		return;
	}

	let stopPropagation = false;
	if (shortcuts[e.code] && shortcutsEnabled) {
		rotateVideo(shortcuts[e.code]);
		stopPropagation = true;
	} else if (e.code === 'Pause') {
		shortcutsEnabled = !shortcutsEnabled;
		stopPropagation = true;
	}

	if (stopPropagation) {
		e.preventDefault();
		e.stopPropagation();
	}
}, true);
