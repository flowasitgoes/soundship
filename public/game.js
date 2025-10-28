// 遊戲配置
const CONFIG = {
    canvas: {
        width: 800,
        height: 600
    },
    lives: {
        hearts: 5,
        graceHits: 1
    },
    player: {
        width: 50,
        height: 50,
        speed: 5,
        color: '#4CAF50'
    },
    bullet: {
        width: 18,
        height: 18,
        speed: 4.5,
        speedVariation: 1.5,  // 速度变化范围
        color: '#ff6fae'
    },
    enemy: {
        width: 40,
        height: 40,
        speed: 1.1,
        spawnRate: 0.02,
        colors: ['#FF5252', '#FF8A65', '#FFD54F', '#4DB6AC', '#64B5F6', '#BA68C8']
    }
};

const VERTICAL_MOVEMENT_ACTIVATION_MS = 280;

function pickEnemyColor() {
    const palette = CONFIG.enemy.colors;
    if (!Array.isArray(palette) || palette.length === 0) {
        return '#FF5252';
    }
    return palette[Math.floor(Math.random() * palette.length)];
}

function componentToHex(value) {
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0').toUpperCase();
}

function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    let normalized = hex.replace('#', '');
    if (normalized.length === 3) {
        normalized = normalized.split('').map(char => char + char).join('');
    }
    if (normalized.length !== 6 || Number.isNaN(parseInt(normalized, 16))) {
        return null;
    }
    const intVal = parseInt(normalized, 16);
    return {
        r: (intVal >> 16) & 255,
        g: (intVal >> 8) & 255,
        b: intVal & 255
    };
}

function lightenColor(hex, amount = 0.25) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const lighten = (channel) => Math.round(channel + (255 - channel) * amount);
    const r = lighten(rgb.r);
    const g = lighten(rgb.g);
    const b = lighten(rgb.b);
    return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function darkenColor(hex, amount = 0.25) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const darken = (channel) => Math.round(channel * (1 - amount));
    const r = darken(rgb.r);
    const g = darken(rgb.g);
    const b = darken(rgb.b);
    return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

// 遊戲狀態
let gameState = {
    isRunning: false,
    score: 0,
    player: null,
    bullets: [],
    enemies: [],
    keys: {},
    consecutiveShots: 0,
    hitsTaken: 0,
    maxHitsBeforeGameOver: CONFIG.lives.hearts + CONFIG.lives.graceHits,
    lastShotTime: 0,
    verticalMovement: {
        direction: null,
        startedAt: 0,
        isActive: false
    }
};

// Canvas 設置
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 响应式调整Canvas尺寸
function resizeCanvas() {
    const isMobile = window.innerWidth <= 900;
    
    if (isMobile) {
        // 移动端：增加Canvas高度以填充屏幕
        canvas.width = CONFIG.canvas.width;
        // 移动端使用更高的Canvas（约为原高度的1.5倍）
        canvas.height = Math.floor(CONFIG.canvas.height * 1.5);
    } else {
        // 桌面端：使用原始尺寸
        canvas.width = CONFIG.canvas.width;
        canvas.height = CONFIG.canvas.height;
    }
}

resizeCanvas();

// 监听窗口大小变化
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const wasRunning = gameState.isRunning;
        if (wasRunning) {
            gameState.isRunning = false;
        }
        resizeCanvas();
        if (wasRunning) {
            gameState.isRunning = true;
        }
    }, 250);
});

const gameContainer = document.querySelector('.game-container');
const scoreBoardEl = document.querySelector('.score-board');
const scoreValueEl = document.getElementById('score');
const livesDisplayEl = document.getElementById('livesDisplay');
let effectsLayer = null;
let heartElements = [];
let playerAuraElement = null;
const mobileControlsEl = document.getElementById('mobileControls');
const shootButtonEl = document.getElementById('shootButton');
const joystickBaseEl = document.getElementById('joystickBase');
const joystickThumbEl = document.getElementById('joystickThumb');
let joystickPointerId = null;
let joystickRect = null;
const activeShootPointers = new Set();
let shootIntervalId = null;

if (gameContainer) {
    effectsLayer = document.createElement('div');
    effectsLayer.className = 'effects-layer';
    const gameOverOverlay = document.getElementById('gameOver');
    if (gameOverOverlay && gameOverOverlay.parentElement === gameContainer) {
        gameContainer.insertBefore(effectsLayer, gameOverOverlay);
    } else {
        gameContainer.appendChild(effectsLayer);
    }
}

function renderLivesDisplay() {
    if (!livesDisplayEl) return;
    livesDisplayEl.innerHTML = '';
    heartElements = [];

    const heartTotal = CONFIG.lives.hearts;
    for (let i = 0; i < heartTotal; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart';
        livesDisplayEl.appendChild(heart);
        heartElements.push(heart);
    }

    updateLivesDisplay();
}

function updateLivesDisplay() {
    if (!livesDisplayEl || heartElements.length === 0) return;
    const heartTotal = CONFIG.lives.hearts;
    const remaining = Math.max(heartTotal - gameState.hitsTaken, 0);

    heartElements.forEach((heart, index) => {
        if (index < remaining) {
            heart.classList.remove('heart-empty');
        } else {
            heart.classList.add('heart-empty');
        }
    });
}

renderLivesDisplay();

// 音效管理
class SoundManager {
    constructor() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.context = AudioContextClass ? new AudioContextClass() : null;
        this.masterGain = null;
        this.noiseBuffer = null;
        this.engineSound = null;
        if (this.context) {
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = 0.35;
            this.masterGain.connect(this.context.destination);
            this.noiseBuffer = this.createNoiseBuffer();
        }
    }

    unlock() {
        if (!this.context) return;
        
        // 恢复被暂停的音频上下文
        if (this.context.state === 'suspended') {
            this.context.resume().then(() => {
                console.log('音频已解锁，状态:', this.context.state);
            }).catch(err => {
                console.error('音频解锁失败:', err);
            });
        }
        
        // 在移动端，播放一个短暂的无声音频来完全解锁
        try {
            const oscillator = this.context.createOscillator();
            const gainNode = this.context.createGain();
            gainNode.gain.value = 0.001; // 几乎无声
            oscillator.connect(gainNode);
            gainNode.connect(this.context.destination);
            oscillator.start(this.context.currentTime);
            oscillator.stop(this.context.currentTime + 0.01);
        } catch (err) {
            console.error('播放测试音频失败:', err);
        }
    }

    createNoiseBuffer() {
        if (!this.context) return null;
        const sampleRate = this.context.sampleRate;
        const buffer = this.context.createBuffer(1, sampleRate * 0.5, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    playShootSound({ mode = 'normal' } = {}) {
        if (!this.context || !this.masterGain) {
            console.warn('音频上下文未初始化');
            return;
        }
        
        // 确保音频上下文处于运行状态
        if (this.context.state === 'suspended') {
            console.warn('音频上下文被暂停，尝试恢复...');
            this.unlock();
            return;
        }
        const now = this.context.currentTime;

        const variant = Math.random();
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        const waveformPool = mode === 'spread'
            ? ['sawtooth', 'triangle', 'square']
            : ['triangle', 'sine', 'square'];
        oscillator.type = waveformPool[Math.floor(Math.random() * waveformPool.length)];

        const modeRanges = {
            normal: [520, 780],
            curve: [700, 1100],
            spread: [420, 680]
        };
        const [minFreq, maxFreq] = modeRanges[mode] || modeRanges.normal;
        const startFreq = minFreq + Math.random() * (maxFreq - minFreq);
        const endFreq = startFreq * (mode === 'spread' ? 1.35 : 1.75);

        oscillator.frequency.setValueAtTime(startFreq, now);
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);

        const peak = mode === 'spread' ? 0.85 : 1.0;
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0015, now + 0.25);

        oscillator.connect(gainNode).connect(this.masterGain);
        oscillator.start(now);
        oscillator.stop(now + 0.26);

        if (variant > 0.55) {
            const overtone = this.context.createOscillator();
            overtone.type = 'sine';
            overtone.frequency.setValueAtTime(startFreq * (mode === 'spread' ? 2.1 : 1.6), now);
            overtone.frequency.exponentialRampToValueAtTime(endFreq * (mode === 'spread' ? 1.1 : 1.25), now + 0.13);

            const overtoneGain = this.context.createGain();
            overtoneGain.gain.setValueAtTime(0.0001, now);
            overtoneGain.gain.exponentialRampToValueAtTime(0.45, now + 0.015);
            overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            overtone.connect(overtoneGain).connect(this.masterGain);
            overtone.start(now);
            overtone.stop(now + 0.22);
        }
    }

    playHitSound(type = 'stone') {
        if (!this.context || !this.masterGain) return;
        const now = this.context.currentTime;

        if (type === 'crystal') {
            const tones = [1200 + Math.random() * 200, 1650 + Math.random() * 220];
            tones.forEach((freq, index) => {
                const osc = this.context.createOscillator();
                osc.type = index === 0 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.linearRampToValueAtTime(freq * 1.1, now + 0.22);

                const gain = this.context.createGain();
                const peak = index === 0 ? 0.6 : 0.35;
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.35);

                osc.connect(gain).connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.4);
            });

            if (this.noiseBuffer) {
                const shimmer = this.context.createBufferSource();
                shimmer.buffer = this.noiseBuffer;
                const bandPass = this.context.createBiquadFilter();
                bandPass.type = 'bandpass';
                bandPass.frequency.setValueAtTime(2600 + Math.random() * 400, now);
                bandPass.Q.setValueAtTime(8, now);

                const gain = this.context.createGain();
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.3);

                shimmer.connect(bandPass).connect(gain).connect(this.masterGain);
                shimmer.start(now);
                shimmer.stop(now + 0.32);
            }
        } else {
            if (this.noiseBuffer) {
                const thud = this.context.createBufferSource();
                thud.buffer = this.noiseBuffer;
                const lowPass = this.context.createBiquadFilter();
                lowPass.type = 'lowpass';
                lowPass.frequency.setValueAtTime(420 + Math.random() * 220, now);
                lowPass.Q.setValueAtTime(0.9, now);

                const gain = this.context.createGain();
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.8, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);

                thud.connect(lowPass).connect(gain).connect(this.masterGain);
                thud.start(now);
                thud.stop(now + 0.35);
            }

            const osc = this.context.createOscillator();
            osc.type = 'sine';
            const baseFreq = 160 + Math.random() * 120;
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.25);

            const gain = this.context.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.7, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.33);

            osc.connect(gain).connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.36);
        }
    }

    startEngineHum() {
        if (!this.context || !this.masterGain || this.engineSound) return;
        const now = this.context.currentTime;

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.connect(this.masterGain);

        const baseOsc = this.context.createOscillator();
        baseOsc.type = 'sawtooth';
        baseOsc.frequency.setValueAtTime(120, now);
        baseOsc.detune.setValueAtTime(-6, now);

        const midOsc = this.context.createOscillator();
        midOsc.type = 'triangle';
        midOsc.frequency.setValueAtTime(240, now);
        midOsc.detune.setValueAtTime(4, now + 0.18);

        const lfo = this.context.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(2.2, now);
        const lfoGain = this.context.createGain();
        lfoGain.gain.setValueAtTime(28, now);
        lfo.connect(lfoGain);
        lfoGain.connect(baseOsc.frequency);

        const amplitudeLfo = this.context.createOscillator();
        amplitudeLfo.type = 'sine';
        amplitudeLfo.frequency.setValueAtTime(5.5, now);
        const amplitudeGain = this.context.createGain();
        amplitudeGain.gain.setValueAtTime(0.08, now);
        amplitudeLfo.connect(amplitudeGain);
        amplitudeGain.connect(gainNode.gain);

        let noiseSource = null;
        let noiseGain = null;
        if (this.noiseBuffer) {
            noiseSource = this.context.createBufferSource();
            noiseSource.buffer = this.noiseBuffer;
            noiseSource.loop = true;
            noiseGain = this.context.createGain();
            noiseGain.gain.setValueAtTime(0.045, now);
            noiseSource.connect(noiseGain).connect(gainNode);
        }

        baseOsc.connect(gainNode);
        midOsc.connect(gainNode);

        baseOsc.start(now);
        midOsc.start(now);
        lfo.start(now);
        amplitudeLfo.start(now + 0.05);
        if (noiseSource) {
            noiseSource.start(now);
        }

        gainNode.gain.linearRampToValueAtTime(0.24, now + 0.25);

        this.engineSound = {
            baseOsc,
            midOsc,
            lfo,
            lfoGain,
            amplitudeLfo,
            amplitudeGain,
            gainNode,
            noiseSource,
            noiseGain
        };
    }

    stopEngineHum() {
        if (!this.context || !this.masterGain || !this.engineSound) return;
        const engine = this.engineSound;
        this.engineSound = null;

        const now = this.context.currentTime;
        const stopTime = now + 0.45;

        engine.gainNode.gain.cancelScheduledValues(now);
        engine.gainNode.gain.setTargetAtTime(0.0001, now, 0.18);

        [engine.baseOsc, engine.midOsc, engine.lfo, engine.amplitudeLfo, engine.noiseSource]
            .filter(Boolean)
            .forEach(node => {
                try {
                    node.stop(stopTime);
                } catch (err) {
                    // Ignored when node already stopped
                }
            });

        const cleanupDelay = Math.max((stopTime - now) * 1000 + 80, 0);
        window.setTimeout(() => {
            try {
                engine.baseOsc.disconnect();
                engine.midOsc.disconnect();
                engine.lfo.disconnect();
                engine.lfoGain.disconnect();
                engine.amplitudeLfo.disconnect();
                engine.amplitudeGain.disconnect();
                if (engine.noiseSource) {
                    engine.noiseSource.disconnect();
                }
                if (engine.noiseGain) {
                    engine.noiseGain.disconnect();
                }
                engine.gainNode.disconnect();
            } catch (err) {
                // best effort cleanup
            }
        }, cleanupDelay);
    }
}

const soundManager = new SoundManager();
['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
    window.addEventListener(eventName, () => soundManager.unlock(), { passive: true });
});

function setVirtualKeyState(key, isActive) {
    if (!gameState || !gameState.keys) return;
    if (isActive) {
        gameState.keys[key] = true;
    } else {
        delete gameState.keys[key];
    }
}

function resetShootButton() {
    activeShootPointers.clear();
    if (shootIntervalId) {
        clearInterval(shootIntervalId);
        shootIntervalId = null;
    }
    if (shootButtonEl) {
        shootButtonEl.classList.remove('shoot-active');
    }
}

function stopShooting(pointerId) {
    if (typeof pointerId === 'number') {
        activeShootPointers.delete(pointerId);
    }

    if (activeShootPointers.size === 0) {
        resetShootButton();
    }
}

function startShooting(pointerId) {
    if (!gameState.isRunning || !gameState.player) return;
    if (typeof pointerId === 'number') {
        activeShootPointers.add(pointerId);
    }
    if (shootButtonEl) {
        shootButtonEl.classList.add('shoot-active');
    }

    gameState.player.shoot();

    if (!shootIntervalId) {
        shootIntervalId = setInterval(() => {
            if (!gameState.isRunning || activeShootPointers.size === 0) {
                resetShootButton();
                return;
            }
            if (gameState.player) {
                gameState.player.shoot();
            }
        }, 260);
    }
}

function clearMobileControlState() {
    resetShootButton();
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(key => setVirtualKeyState(key, false));
    joystickPointerId = null;
    joystickRect = null;
    if (joystickThumbEl) {
        joystickThumbEl.style.transform = 'translate(-50%, -50%)';
    }
}

function updateJoystickKeys(deltaX, deltaY) {
    const threshold = 0.25;
    const horizontal = Math.abs(deltaX) >= threshold ? Math.sign(deltaX) : 0;
    const vertical = Math.abs(deltaY) >= threshold ? Math.sign(deltaY) : 0;

    setVirtualKeyState('ArrowLeft', horizontal < 0);
    setVirtualKeyState('ArrowRight', horizontal > 0);
    setVirtualKeyState('ArrowUp', vertical < 0);
    setVirtualKeyState('ArrowDown', vertical > 0);
}

function handleJoystickMove(event) {
    if (!joystickBaseEl || !joystickThumbEl) return;
    if (joystickPointerId === null || event.pointerId !== joystickPointerId) return;

    if (!joystickRect) {
        joystickRect = joystickBaseEl.getBoundingClientRect();
    }

    const baseRadius = joystickRect.width / 2;
    const thumbRadius = joystickThumbEl.offsetWidth / 2;
    const maxDistance = Math.max(40, baseRadius - thumbRadius * 0.6);
    const centerX = joystickRect.left + baseRadius;
    const centerY = joystickRect.top + baseRadius;

    const offsetX = event.clientX - centerX;
    const offsetY = event.clientY - centerY;
    const distance = Math.min(Math.sqrt(offsetX * offsetX + offsetY * offsetY), maxDistance);

    const angle = Math.atan2(offsetY, offsetX);
    const clampedX = Math.cos(angle) * distance;
    const clampedY = Math.sin(angle) * distance;

    joystickThumbEl.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

    const normalizedX = clampedX / maxDistance;
    const normalizedY = clampedY / maxDistance;
    updateJoystickKeys(normalizedX, normalizedY);
}

function handleJoystickEnd(event) {
    if (joystickPointerId === null) return;
    if (event && event.pointerId !== joystickPointerId) return;

    joystickPointerId = null;
    joystickRect = null;
    if (joystickThumbEl) {
        joystickThumbEl.style.transform = 'translate(-50%, -50%)';
    }
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(key => setVirtualKeyState(key, false));
}

if (joystickBaseEl && joystickThumbEl) {
    joystickThumbEl.style.transform = 'translate(-50%, -50%)';

    joystickBaseEl.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        soundManager.unlock(); // 解锁音频
        joystickPointerId = event.pointerId;
        joystickRect = joystickBaseEl.getBoundingClientRect();
        if (joystickBaseEl.setPointerCapture) {
            joystickBaseEl.setPointerCapture(event.pointerId);
        }
        handleJoystickMove(event);
    }, { passive: false });

    joystickBaseEl.addEventListener('pointermove', handleJoystickMove);
    joystickBaseEl.addEventListener('pointerup', handleJoystickEnd);
    joystickBaseEl.addEventListener('pointercancel', handleJoystickEnd);
    joystickBaseEl.addEventListener('lostpointercapture', handleJoystickEnd);
    joystickBaseEl.addEventListener('pointerleave', handleJoystickEnd);
    joystickBaseEl.addEventListener('pointerout', handleJoystickEnd);
    joystickBaseEl.addEventListener('contextmenu', (event) => event.preventDefault());
}

if (shootButtonEl) {
    const handleShootDown = (event) => {
        event.preventDefault();
        soundManager.unlock(); // 解锁音频
        if (shootButtonEl.setPointerCapture) {
            shootButtonEl.setPointerCapture(event.pointerId);
        }
        startShooting(event.pointerId);
    };

    const handleShootEnd = (event) => {
        stopShooting(event.pointerId);
    };

    shootButtonEl.addEventListener('pointerdown', handleShootDown, { passive: false });
    shootButtonEl.addEventListener('pointerup', handleShootEnd);
    shootButtonEl.addEventListener('pointercancel', handleShootEnd);
    shootButtonEl.addEventListener('lostpointercapture', handleShootEnd);
    shootButtonEl.addEventListener('pointerleave', handleShootEnd);
    shootButtonEl.addEventListener('pointerout', handleShootEnd);
    shootButtonEl.addEventListener('contextmenu', (event) => event.preventDefault());
}

// 產生命中特效
function spawnHitEffect(x, y) {
    if (!effectsLayer) return;

    const effect = document.createElement('div');
    effect.className = 'hit-effect';
    const effectLeft = canvas.offsetLeft + x;
    const effectTop = canvas.offsetTop + y;
    effect.style.left = `${effectLeft}px`;
    effect.style.top = `${effectTop}px`;

    effectsLayer.appendChild(effect);
    effect.addEventListener('animationend', () => effect.remove());
}

function ensurePlayerAuraElement() {
    if (!effectsLayer) return null;
    if (!playerAuraElement) {
        playerAuraElement = document.createElement('div');
        playerAuraElement.className = 'player-engine-aura';
        effectsLayer.appendChild(playerAuraElement);
    }
    return playerAuraElement;
}

function updatePlayerAuraPosition() {
    if (!playerAuraElement || !gameState.verticalMovement?.isActive || !gameState.player) return;
    const centerX = canvas.offsetLeft + gameState.player.x + gameState.player.width / 2;
    const centerY = canvas.offsetTop + gameState.player.y + gameState.player.height / 2;
    playerAuraElement.style.left = `${centerX}px`;
    playerAuraElement.style.top = `${centerY}px`;
}

function activateEngineAura(direction) {
    const state = gameState.verticalMovement;
    if (!state || state.isActive) return;
    const aura = ensurePlayerAuraElement();
    if (!aura) return;
    aura.classList.add('is-active');
    aura.dataset.direction = direction || '';
    state.isActive = true;
    updatePlayerAuraPosition();
    soundManager.startEngineHum();
}

function deactivateEngineAura() {
    const state = gameState.verticalMovement;
    if (!state || !state.isActive) return;
    if (playerAuraElement) {
        playerAuraElement.classList.remove('is-active');
        delete playerAuraElement.dataset.direction;
    }
    state.isActive = false;
    soundManager.stopEngineHum();
}

function updateVerticalMovementEffect(timestamp = 0) {
    const state = gameState.verticalMovement;
    if (!state) return;

    const upPressed = gameState.keys['ArrowUp'] || gameState.keys['w'];
    const downPressed = gameState.keys['ArrowDown'] || gameState.keys['s'];

    let nextDirection = null;
    if (upPressed && !downPressed) {
        nextDirection = 'up';
    } else if (downPressed && !upPressed) {
        nextDirection = 'down';
    }

    if (nextDirection) {
        if (state.direction !== nextDirection) {
            if (state.isActive) {
                deactivateEngineAura();
            }
            state.direction = nextDirection;
            state.startedAt = timestamp;
            state.isActive = false;
        } else if (!state.isActive && timestamp - state.startedAt >= VERTICAL_MOVEMENT_ACTIVATION_MS) {
            activateEngineAura(nextDirection);
        }
    } else {
        if (state.isActive) {
            deactivateEngineAura();
        }
        state.direction = null;
        state.startedAt = 0;
    }

    updatePlayerAuraPosition();
}

// 玩家類別
class Player {
    constructor() {
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.x = CONFIG.canvas.width / 2 - this.width / 2;
        this.y = CONFIG.canvas.height - this.height - 20;
        this.speed = CONFIG.player.speed;
    }

    draw() {
        // 繪製吉他造型
        const centerX = this.x + this.width / 2;
        const bodyCenterY = this.y + this.height * 0.68;
        const bodyWidth = this.width * 0.9;
        const bodyHeight = this.height * 0.82;
        const bodyColor = CONFIG.player.color;
        const bodyHighlight = lightenColor(bodyColor, 0.35);
        const bodyShadow = darkenColor(bodyColor, 0.3);

        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00000044';

        const bodyGradient = ctx.createLinearGradient(
            centerX - bodyWidth / 2,
            bodyCenterY - bodyHeight / 2,
            centerX + bodyWidth / 2,
            bodyCenterY + bodyHeight / 2
        );
        bodyGradient.addColorStop(0, bodyHighlight);
        bodyGradient.addColorStop(1, bodyShadow);
        ctx.fillStyle = bodyGradient;

        ctx.beginPath();
        ctx.moveTo(centerX - bodyWidth * 0.45, bodyCenterY + bodyHeight * 0.12);
        ctx.bezierCurveTo(
            centerX - bodyWidth * 0.7,
            bodyCenterY - bodyHeight * 0.25,
            centerX - bodyWidth * 0.25,
            bodyCenterY - bodyHeight * 0.68,
            centerX,
            bodyCenterY - bodyHeight * 0.48
        );
        ctx.bezierCurveTo(
            centerX + bodyWidth * 0.25,
            bodyCenterY - bodyHeight * 0.68,
            centerX + bodyWidth * 0.7,
            bodyCenterY - bodyHeight * 0.25,
            centerX + bodyWidth * 0.45,
            bodyCenterY + bodyHeight * 0.12
        );
        ctx.bezierCurveTo(
            centerX + bodyWidth * 0.62,
            bodyCenterY + bodyHeight * 0.48,
            centerX + bodyWidth * 0.25,
            bodyCenterY + bodyHeight * 0.65,
            centerX,
            bodyCenterY + bodyHeight * 0.55
        );
        ctx.bezierCurveTo(
            centerX - bodyWidth * 0.25,
            bodyCenterY + bodyHeight * 0.65,
            centerX - bodyWidth * 0.62,
            bodyCenterY + bodyHeight * 0.48,
            centerX - bodyWidth * 0.45,
            bodyCenterY + bodyHeight * 0.12
        );
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = darkenColor(bodyColor, 0.45);
        ctx.lineWidth = 1.8;
        ctx.stroke();

        const neckWidth = this.width * 0.18;
        const neckTop = this.y + this.height * 0.05;
        const neckBottom = bodyCenterY - bodyHeight * 0.35;
        const neckHeight = Math.max(neckBottom - neckTop, this.height * 0.18);
        const neckX = centerX - neckWidth / 2;
        const neckColor = '#d6b98c';
        ctx.fillStyle = neckColor;
        ctx.fillRect(neckX, neckTop, neckWidth, neckHeight);
        ctx.strokeStyle = darkenColor(neckColor, 0.4);
        ctx.lineWidth = 1;
        ctx.strokeRect(neckX, neckTop, neckWidth, neckHeight);

        const headstockWidth = neckWidth * 1.6;
        const headstockHeight = this.height * 0.14;
        const headstockTop = neckTop - headstockHeight;
        ctx.fillStyle = darkenColor(neckColor, 0.28);
        ctx.beginPath();
        ctx.moveTo(centerX - headstockWidth / 2 + 1, neckTop);
        ctx.lineTo(centerX + headstockWidth / 2 - 1, neckTop);
        ctx.lineTo(centerX + headstockWidth / 2, headstockTop);
        ctx.lineTo(centerX - headstockWidth / 2, headstockTop);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#cfd6df';
        const pegRadius = this.width * 0.04;
        const pegSpacing = headstockHeight * 0.4;
        for (let i = 0; i < 2; i++) {
            const yOffset = headstockTop + headstockHeight * 0.25 + pegSpacing * i;
            ctx.beginPath();
            ctx.arc(centerX - headstockWidth / 2 - pegRadius * 0.8, yOffset, pegRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX + headstockWidth / 2 + pegRadius * 0.8, yOffset + pegSpacing * 0.4, pegRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        const holeRadius = bodyWidth * 0.18;
        const holeCenterY = bodyCenterY - bodyHeight * 0.08;
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(centerX, holeCenterY, holeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f2d38a';
        ctx.lineWidth = this.width * 0.03;
        ctx.beginPath();
        ctx.arc(centerX, holeCenterY, holeRadius * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = darkenColor(bodyColor, 0.5);
        const bridgeWidth = neckWidth * 1.2;
        const bridgeHeight = this.height * 0.08;
        const bridgeY = bodyCenterY + bodyHeight * 0.25;
        ctx.fillRect(centerX - bridgeWidth / 2, bridgeY, bridgeWidth, bridgeHeight);

        ctx.strokeStyle = '#f0f4f6';
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        const stringCount = 4;
        const stringSpacing = neckWidth / (stringCount + 1);
        const stringStartY = neckTop + 2;
        const stringEndY = bridgeY + bridgeHeight / 2;
        for (let i = 1; i <= stringCount; i++) {
            const stringX = neckX + stringSpacing * i;
            ctx.beginPath();
            ctx.moveTo(stringX, stringStartY);
            ctx.quadraticCurveTo(
                stringX,
                holeCenterY - holeRadius * 0.6,
                centerX + (stringX - centerX) * 0.35,
                stringEndY
            );
            ctx.stroke();
        }

        ctx.restore();
    }

    move() {
        const leftPressed = gameState.keys['ArrowLeft'] || gameState.keys['a'];
        const rightPressed = gameState.keys['ArrowRight'] || gameState.keys['d'];
        const upPressed = gameState.keys['ArrowUp'] || gameState.keys['w'];
        const downPressed = gameState.keys['ArrowDown'] || gameState.keys['s'];

        if (leftPressed && this.x > 0) {
            this.x = Math.max(0, this.x - this.speed);
        }
        if (rightPressed && this.x < CONFIG.canvas.width - this.width) {
            this.x = Math.min(CONFIG.canvas.width - this.width, this.x + this.speed);
        }
        if (upPressed && this.y > 0) {
            this.y = Math.max(0, this.y - this.speed);
        }
        if (downPressed && this.y < CONFIG.canvas.height - this.height) {
            this.y = Math.min(CONFIG.canvas.height - this.height, this.y + this.speed);
        }
    }

    shoot() {
        const now = performance.now();
        if (now - gameState.lastShotTime > 600) {
            gameState.consecutiveShots = 0;
        }
        gameState.lastShotTime = now;
        const bulletX = this.x + this.width / 2 - CONFIG.bullet.width / 2;
        const bulletY = this.y - CONFIG.bullet.height * 0.2;

        const isMovingLeft = gameState.keys['ArrowLeft'] || gameState.keys['a'];
        const isMovingRight = gameState.keys['ArrowRight'] || gameState.keys['d'];
        const moveDirection = (isMovingRight ? 1 : 0) - (isMovingLeft ? 1 : 0);

        // 左右移動時發射散射子彈
        if (moveDirection !== 0) {
            const spreadAngles = [];
            while (spreadAngles.length < 3) {
                const candidate = (Math.random() - 0.5) * 0.95;
                if (spreadAngles.every(angle => Math.abs(angle - candidate) > 0.2)) {
                    spreadAngles.push(candidate);
                }
            }

            spreadAngles.forEach((angle, index) => {
                const offset = (index - 1) * 14;
                gameState.bullets.push(new Bullet(bulletX + offset, bulletY, {
                    isMist: true,
                    initialAngle: angle,
                    turnDirection: moveDirection,
                    consecutiveShots: gameState.consecutiveShots
                }));
            });

            gameState.consecutiveShots = 0;
            soundManager.playShootSound({ mode: 'spread' });
            return;
        }

        // 普通射擊模式
        gameState.consecutiveShots += 1;

        const shouldCurve = gameState.consecutiveShots >= 3;
        gameState.bullets.push(new Bullet(bulletX, bulletY, { 
            isCurved: shouldCurve,
            consecutiveShots: gameState.consecutiveShots
        }));

        if (shouldCurve) {
            gameState.consecutiveShots = 0;
        }

        soundManager.playShootSound({ mode: shouldCurve ? 'curve' : 'normal' });
    }
}

// 子彈類別
class Bullet {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.bullet.width;
        this.height = CONFIG.bullet.height;
        
        // 根據連續射擊次數動態調整速度
        const consecutiveShots = options.consecutiveShots || 0;
        const baseSpeed = CONFIG.bullet.speed;
        const variation = CONFIG.bullet.speedVariation;
        
        // 使用正弦波產生節奏性的速度變化
        const speedOffset = Math.sin(consecutiveShots * 0.8) * variation;
        this.speed = baseSpeed + speedOffset;
        
        this.angleAtSpawn = typeof options.initialAngle === 'number' ? options.initialAngle : 0;
        this.angle = this.angleAtSpawn;
        this.dx = Math.sin(this.angle) * this.speed;
        this.dy = -Math.cos(this.angle) * this.speed;
        this.isCurved = Boolean(options.isCurved);
        this.isMist = Boolean(options.isMist);
        this.turnDirection = this.isMist ? Math.sign(options.turnDirection || 0) : 0;
        this.turnDelay = 10;
        this.turnAngle = (Math.random() * 0.8 + 0.4) * (Math.random() < 0.5 ? -1 : 1);
        this.lifetime = 0;
        this.color = CONFIG.bullet.color;
        this.mistTurnDelay = this.isMist ? 6 + Math.floor(Math.random() * 8) : 0;
        this.mistTargetDelta = this.isMist ? (0.45 + Math.random() * 0.35) * this.turnDirection : 0;
        this.mistWobbleSpeed = this.isMist ? 0.1 + Math.random() * 0.12 : 0;
        this.mistWobbleStrength = this.isMist ? 0.05 + Math.random() * 0.04 : 0;
        this.mistWobblePhase = Math.random() * Math.PI * 2;

        if (this.isCurved) {
            this.turnDelay = 6 + Math.floor(Math.random() * 10);
            this.turnAngle = (Math.random() * 0.9 + 0.35) * (Math.random() < 0.5 ? -1 : 1);
            this.color = '#ff9ed5';
        } else if (this.isMist) {
            this.width *= 0.92;
            this.height *= 0.92;
            this.color = '#ffd6ed';
        }
    }

    draw() {
        ctx.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        ctx.translate(centerX, centerY);

        const angle = Math.atan2(this.dy, this.dx || -0.0001);
        ctx.rotate(angle + Math.PI / 2);

        const scale = this.width / 20;
        ctx.scale(scale, scale);

        const gradient = ctx.createLinearGradient(0, -10, 0, 12);
        gradient.addColorStop(0, '#ffe3f3');
        gradient.addColorStop(0.5, this.color);
        gradient.addColorStop(1, '#ff3f88');
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 14;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.bezierCurveTo(-12, -2, -8, -16, 0, -6);
        ctx.bezierCurveTo(8, -16, 12, -2, 0, 10);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    update() {
        this.lifetime += 1;

        if (this.isMist) {
            if (this.turnDirection !== 0 && this.lifetime > this.mistTurnDelay) {
                const targetAngle = this.angleAtSpawn + this.mistTargetDelta;
                this.angle += (targetAngle - this.angle) * 0.045;
            }

            const wobble = Math.sin(this.lifetime * this.mistWobbleSpeed + this.mistWobblePhase) * this.mistWobbleStrength;
            const currentAngle = this.angle + wobble;
            this.dx = Math.sin(currentAngle) * this.speed;
            this.dy = -Math.cos(currentAngle) * this.speed;
        } else if (this.isCurved && this.lifetime > this.turnDelay) {
            const targetDx = Math.sin(this.turnAngle) * this.speed;
            const targetDy = -Math.cos(this.turnAngle) * this.speed;
            this.dx += (targetDx - this.dx) * 0.08;
            this.dy += (targetDy - this.dy) * 0.08;
        }

        this.x += this.dx;
        this.y += this.dy;
    }

    isOffScreen() {
        return (
            this.y + this.height < 0 ||
            this.y > CONFIG.canvas.height ||
            this.x + this.width < 0 ||
            this.x > CONFIG.canvas.width
        );
    }
}

// 敵機類別
class Enemy {
    constructor() {
        const sizeScale = 0.6 + Math.random() * 0.9;
        const aspectJitter = 0.9 + Math.random() * 0.25;
        this.width = CONFIG.enemy.width * sizeScale * aspectJitter;
        this.height = CONFIG.enemy.height * sizeScale * (2 - aspectJitter);
        this.sizeScale = sizeScale;

        this.x = Math.random() * (CONFIG.canvas.width - this.width);
        this.y = -this.height;
        this.speed = CONFIG.enemy.speed + Math.random() * 0.6;
        this.baseColor = pickEnemyColor();
        this.shadowColor = darkenColor(this.baseColor, 0.4);
        this.highlightColor = lightenColor(this.baseColor, 0.5);
        this.type = Math.random() < 0.55 ? 'stone' : 'crystal';

        if (this.type === 'stone') {
            this.edgeColor = darkenColor(this.baseColor, 0.25);
            this.surfaceColor = lightenColor(this.baseColor, 0.18);
            this.vertices = this.generateStoneVertices();
            this.scuffs = this.generateStoneScuffs();
        } else {
            this.edgeColor = lightenColor(this.baseColor, 0.25);
            this.innerColor = lightenColor(this.baseColor, 0.4);
            this.glintColor = '#FFFFFF';
            this.facets = this.generateCrystalFacets();
        }
    }

    generateStoneVertices() {
        const vertexCount = 6 + Math.floor(Math.random() * 4);
        const vertices = [];
        const step = (Math.PI * 2) / vertexCount;

        for (let i = 0; i < vertexCount; i++) {
            const baseAngle = step * i;
            const angle = baseAngle + (Math.random() - 0.5) * step * 0.5;
            const radius = 0.55 + Math.random() * 0.25;
            const squash = 0.7 + Math.random() * 0.2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius * squash;
            vertices.push({ x, y });
        }
        return vertices;
    }

    generateStoneScuffs() {
        const scuffCount = 2 + Math.floor(Math.random() * 3);
        return Array.from({ length: scuffCount }, () => ({
            x: (Math.random() - 0.5) * 0.8,
            y: Math.random() * 0.4 - 0.2,
            length: 0.2 + Math.random() * 0.25,
            angle: (Math.random() - 0.5) * Math.PI * 0.4
        }));
    }

    generateCrystalFacets() {
        const baseShapes = [
            [
                { x: 0, y: -0.95 },
                { x: 0.52, y: -0.1 },
                { x: 0.35, y: 0.65 },
                { x: 0, y: 0.95 },
                { x: -0.35, y: 0.65 },
                { x: -0.52, y: -0.1 }
            ],
            [
                { x: 0, y: -0.9 },
                { x: 0.35, y: -0.25 },
                { x: 0.52, y: 0.35 },
                { x: 0.15, y: 0.9 },
                { x: -0.15, y: 0.9 },
                { x: -0.52, y: 0.35 },
                { x: -0.35, y: -0.25 }
            ]
        ];

        const shape = baseShapes[Math.floor(Math.random() * baseShapes.length)];
        const facetLines = [];

        for (let i = 1; i < shape.length - 1; i++) {
            facetLines.push({
                from: shape[0],
                to: shape[i],
                alpha: 0.25 + Math.random() * 0.3
            });
        }

        return { shape, facetLines };
    }

    draw(timestamp = 0) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        const scaleX = this.width / 2;
        const scaleY = this.height / 2;

        if (this.type === 'stone') {
            this.drawStone(scaleX, scaleY);
        } else {
            this.drawCrystal(scaleX, scaleY, timestamp);
        }

        ctx.restore();
    }

    drawStone(scaleX, scaleY) {
        const gradient = ctx.createRadialGradient(-scaleX * 0.15, -scaleY * 0.2, scaleX * 0.1, 0, 0, scaleX * 1.1);
        gradient.addColorStop(0, this.surfaceColor);
        gradient.addColorStop(1, this.shadowColor);
        ctx.fillStyle = gradient;
        ctx.strokeStyle = `${this.edgeColor}BB`;
        ctx.lineWidth = Math.max(1.5, this.width * 0.05);

        ctx.beginPath();
        const firstVertex = this.vertices[0];
        ctx.moveTo(firstVertex.x * scaleX, firstVertex.y * scaleY);
        for (let i = 1; i < this.vertices.length; i++) {
            const vertex = this.vertices[i];
            ctx.lineTo(vertex.x * scaleX, vertex.y * scaleY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.lineWidth = Math.max(0.5, this.width * 0.02);
        ctx.strokeStyle = `${this.highlightColor}55`;
        this.scuffs.forEach(scuff => {
            const lengthX = Math.cos(scuff.angle) * scuff.length * scaleX;
            const lengthY = Math.sin(scuff.angle) * scuff.length * scaleY;
            const startX = scuff.x * scaleX - lengthX * 0.5;
            const startY = scuff.y * scaleY - lengthY * 0.5;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(startX + lengthX, startY + lengthY);
            ctx.stroke();
        });
    }

    drawCrystal(scaleX, scaleY, timestamp) {
        const { shape, facetLines } = this.facets;
        const gradient = ctx.createLinearGradient(0, -scaleY, 0, scaleY);
        gradient.addColorStop(0, this.highlightColor);
        gradient.addColorStop(0.5, this.innerColor);
        gradient.addColorStop(1, this.shadowColor);
        ctx.fillStyle = gradient;
        ctx.strokeStyle = `${this.edgeColor}AA`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, this.width * 0.04);

        ctx.beginPath();
        ctx.moveTo(shape[0].x * scaleX, shape[0].y * scaleY);
        for (let i = 1; i < shape.length; i++) {
            const point = shape[i];
            ctx.lineTo(point.x * scaleX, point.y * scaleY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = `${this.highlightColor}55`;
        ctx.lineWidth = Math.max(0.65, this.width * 0.022);
        facetLines.forEach(line => {
            ctx.globalAlpha = line.alpha;
            ctx.beginPath();
            ctx.moveTo(line.from.x * scaleX, line.from.y * scaleY);
            ctx.lineTo(line.to.x * scaleX, line.to.y * scaleY);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        const sparkle = (Math.sin(timestamp / 250 + this.x * 0.01) + 1) / 2;
        const sparkleSize = Math.max(2, this.width * 0.08);
        ctx.fillStyle = `${this.glintColor}${Math.floor(120 + sparkle * 80).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.ellipse(0, -scaleY * 0.45, sparkleSize, sparkleSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.y += this.speed;
    }

    isOffScreen() {
        return this.y > CONFIG.canvas.height;
    }
}

// 碰撞檢測
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// 更新分數
function updateScore(points) {
    gameState.score += points;
    if (scoreValueEl) {
        scoreValueEl.textContent = gameState.score;
    }
    if (scoreBoardEl) {
        scoreBoardEl.classList.remove('score-pulse');
        void scoreBoardEl.offsetWidth;
        scoreBoardEl.classList.add('score-pulse');
    }
}

// 遊戲結束
function gameOver() {
    gameState.isRunning = false;
    deactivateEngineAura();
    clearMobileControlState();
    updateLivesDisplay();
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOver').classList.remove('hidden');
}

// 初始化遊戲
function initGame() {
    deactivateEngineAura();
    gameState = {
        isRunning: true,
        score: 0,
        player: new Player(),
        bullets: [],
        enemies: [],
        keys: {},
        consecutiveShots: 0,
        hitsTaken: 0,
        maxHitsBeforeGameOver: CONFIG.lives.hearts + CONFIG.lives.graceHits,
        lastShotTime: 0,
        verticalMovement: {
            direction: null,
            startedAt: 0,
            isActive: false
        }
    };
    
    updateScore(0);
    updateLivesDisplay();
    document.getElementById('gameOver').classList.add('hidden');
    clearMobileControlState();
}

function handlePlayerCollision(enemyIndex) {
    if (!gameState.isRunning) return;

    gameState.hitsTaken += 1;

    if (typeof enemyIndex === 'number' && enemyIndex >= 0) {
        gameState.enemies.splice(enemyIndex, 1);
    }

    const playerCenterX = gameState.player.x + gameState.player.width / 2;
    const playerCenterY = gameState.player.y + gameState.player.height / 2;
    spawnHitEffect(playerCenterX, playerCenterY);

    updateLivesDisplay();

    if (gameState.hitsTaken >= gameState.maxHitsBeforeGameOver) {
        gameOver();
    }
}

// 遊戲主循環
function gameLoop(timestamp = 0) {
    if (!gameState.isRunning) return;

    // 清空畫布
    ctx.clearRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    drawBackground(timestamp);

    // 繪製星星背景
    drawStars();

    // 更新和繪製玩家
    gameState.player.move();
    gameState.player.draw();
    updateVerticalMovementEffect(timestamp);

    // 更新和繪製子彈
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        bullet.update();
        bullet.draw();

        // 移除離開畫面的子彈
        if (bullet.isOffScreen()) {
            gameState.bullets.splice(i, 1);
        }
    }

    // 生成敵機
    if (Math.random() < CONFIG.enemy.spawnRate) {
        gameState.enemies.push(new Enemy());
    }

    // 更新和繪製敵機
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        enemy.update();
        enemy.draw(timestamp);

        // 檢查敵機是否離開畫面
        if (enemy.isOffScreen()) {
            gameState.enemies.splice(i, 1);
            continue;
        }

        // 檢查敵機與玩家碰撞
        if (checkCollision(gameState.player, enemy)) {
            handlePlayerCollision(i);
            if (!gameState.isRunning) {
                return;
            }
            continue;
        }

        // 檢查子彈與敵機碰撞
        for (let j = gameState.bullets.length - 1; j >= 0; j--) {
            const bullet = gameState.bullets[j];
            if (checkCollision(bullet, enemy)) {
                const hitX = enemy.x + enemy.width / 2;
                const hitY = enemy.y + enemy.height / 2;
                soundManager.playHitSound(enemy.type);
                gameState.enemies.splice(i, 1);
                gameState.bullets.splice(j, 1);
                updateScore(10);
                spawnHitEffect(hitX, hitY);
                break;
            }
        }
    }

    requestAnimationFrame(gameLoop);
}

function drawBackground(timestamp = 0) {
    // 使用 HSL 色彩沿時間變化，打造流動的極光背景
    const time = timestamp / 1000;
    const hueBase = (time * 25) % 360;
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
    gradient.addColorStop(0, `hsl(${(hueBase + 200) % 360}, 70%, 14%)`);
    gradient.addColorStop(0.5, `hsl(${(hueBase + 250) % 360}, 75%, 12%)`);
    gradient.addColorStop(1, `hsl(${(hueBase + 300) % 360}, 80%, 10%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
}

// 繪製星星背景
const stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * CONFIG.canvas.width,
        y: Math.random() * CONFIG.canvas.height,
        radius: Math.random() * 1.5,
        speed: Math.random() * 0.5 + 0.1
    });
}

function drawStars() {
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 移動星星
        star.y += star.speed;
        if (star.y > CONFIG.canvas.height) {
            star.y = 0;
            star.x = Math.random() * CONFIG.canvas.width;
        }
    });
}

// 鍵盤事件監聽
document.addEventListener('keydown', (e) => {
    gameState.keys[e.key] = true;
    
    // 空白鍵發射子彈
    if (e.key === ' ' && gameState.isRunning) {
        e.preventDefault();
        gameState.player.shoot();
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.key] = false;
});

// 重新開始按鈕
document.getElementById('restartBtn').addEventListener('click', () => {
    initGame();
    gameLoop();
});

// 啟動遊戲
initGame();
gameLoop();
