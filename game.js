const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const menuScreen = document.getElementById('menu-screen');
const normalModeBtn = document.getElementById('normal-mode-btn');
const colorModeBtn = document.getElementById('color-mode-btn');
const gameControls = document.getElementById('game-controls');
const restartBtn = document.getElementById('restart-btn');
const exitBtn = document.getElementById('exit-btn');

let width, height;
const balls = [];
const particles = [];
const characters = [];
const spirits = [];

// Game State
let gameState = 'MENU';
let gameMode = 'NORMAL';
let targetHue = 0;
let isPaused = false;

// Audio Setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audio = {
    bgm: new Audio('public/sounds/bgm.mp3'),
    popBuffer: null,
    correct: new Audio('public/sounds/correct.mp3'),
    wrong: new Audio('public/sounds/wrong.mp3'),
    special: [
        new Audio('public/sounds/kawaii.m4a'),
        new Audio('public/sounds/mochimochi.m4a'),
        new Audio('public/sounds/daisuki.m4a')
    ],
    enabled: false
};
audio.bgm.loop = true;
audio.bgm.volume = 0.1;
audio.correct.volume = 0.5;
audio.wrong.volume = 0.5;
audio.special.forEach(s => s.volume = 0.5);

fetch('public/sounds/explosion.mp3')
    .then(res => {
        if (!res.ok) throw new Error('Sound not found');
        return res.arrayBuffer();
    })
    .then(data => audioContext.decodeAudioData(data))
    .then(buffer => audio.popBuffer = buffer)
    .catch(err => console.error("Sound load error:", err));

// Page Visibility / Pause Logic
window.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
    else resumeGame();
});
window.addEventListener('blur', pauseGame);
window.addEventListener('focus', resumeGame);

function pauseGame() {
    isPaused = true;
    if (audio.enabled) audio.bgm.pause();
}

function resumeGame() {
    isPaused = false;
    if (audio.enabled && gameState === 'PLAYING') {
        audio.bgm.play().catch(() => { });
    }
}

function enableAudio() {
    if (audio.enabled) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    audio.enabled = true;
    audio.bgm.play().catch(e => console.log("Audio play blocked", e));
}

function playPopSound(isCorrect = true) {
    if (!audio.enabled) return;

    if (gameMode === 'COLOR_FIND') {
        if (isCorrect) {
            audio.correct.currentTime = 0;
            audio.correct.play();
        } else {
            audio.wrong.currentTime = 0;
            audio.wrong.play();
            showWrongOverlay();
            return;
        }
    }

    // Special sound chance (20%)
    if (isCorrect && Math.random() < 0.2) {
        const s = audio.special[Math.floor(Math.random() * audio.special.length)];
        s.currentTime = 0;
        s.play();
    }

    if (!audio.popBuffer) return;
    [0, 20].forEach(delay => {
        setTimeout(() => {
            const source = audioContext.createBufferSource();
            const gainNode = audioContext.createGain();
            source.buffer = audio.popBuffer;
            gainNode.gain.value = 0.5;
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            source.start(0);
        }, delay);
    });
}

function showWrongOverlay() {
    const count = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
        spirits.push(new BaikinmanSpirit());
    }
}

class BaikinmanSpirit {
    constructor() {
        const side = Math.floor(Math.random() * 4);
        const margin = 200;
        if (side === 0) { // Bottom
            this.x = Math.random() * width; this.y = height + margin;
        } else if (side === 1) { // Top
            this.x = Math.random() * width; this.y = -margin;
        } else if (side === 2) { // Left
            this.x = -margin; this.y = Math.random() * height;
        } else { // Right
            this.x = width + margin; this.y = Math.random() * height;
        }

        const tx = width / 2 + (Math.random() - 0.5) * width * 0.6;
        const ty = height / 2 + (Math.random() - 0.5) * height * 0.6;
        const dist = Math.sqrt((tx - this.x) ** 2 + (ty - this.y) ** 2);
        const speed = 6 + Math.random() * 10;
        this.vx = (tx - this.x) / dist * speed;
        this.vy = (ty - this.y) / dist * speed;

        this.rotation = Math.random() * Math.PI * 2;
        this.vRot = (Math.random() - 0.5) * 0.2;
        this.scale = 0.5 + Math.random() * 0.6;
        this.opacity = 1.0;
        this.life = 1.8 + Math.random();
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.vRot;
        this.life -= 1 / 60;
        if (this.life < 1.0) this.opacity -= 0.025;
    }

    draw() {
        if (this.opacity <= 0 || !processedImages['baikinman']) return;
        const canvas = processedImages['baikinman'].canvas;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.opacity);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        ctx.restore();
    }
}

function speak(text) {
    if (!audio.enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = 'ja-JP';
    uttr.rate = 1.1;
    uttr.pitch = 1.5;
    uttr.volume = 1.0;
    window.speechSynthesis.speak(uttr);
}

// Character Loading
const characterData = [
    { name: 'baikinman', ext: 'png' }, // For background removal
    { name: 'char0', ext: 'png', displayName: 'コキンちゃん' },
    { name: 'char1', ext: 'jpg', displayName: 'カレーパンマン' },
    { name: 'char2', ext: 'jpg', displayName: 'レモンパンナちゃん' },
    { name: 'char3', ext: 'jpg', displayName: 'だだんだん' },
    { name: 'char4', ext: 'png', displayName: 'めいけんチーズ' },
    { name: 'char5', ext: 'jpg', grid: { cols: 7, rows: 8 } },
    { name: 'char6', ext: 'png', grid: { cols: 4, rows: 3 } },
    { name: 'char7', ext: 'jpg', displayName: 'アンパンマン' }
];
const processedImages = {};

characterData.forEach(data => {
    const img = new Image();
    img.src = `public/assets/${data.name}.${data.ext}`;
    img.onload = () => {
        processedImages[data.name] = {
            canvas: removeWhiteBackground(img),
            grid: data.grid,
            displayName: data.displayName
        };
    };
});

function removeWhiteBackground(img) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // More aggressive transparency for white/near-white backgrounds
        if (data[i] > 220 && data[i + 1] > 220 && data[i + 2] > 220) {
            data[i + 3] = 0;
        }
    }
    tempCtx.putImageData(imageData, 0, 0);
    return tempCanvas;
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
window.addEventListener('resize', resize);
resize();

// Menu Logic
const startHandler = (mode) => {
    console.log("Starting mode:", mode);
    startLevel(mode);
};

// iPad/iOS verification: 'click' is the most reliable for user-initiated events like AudioContext resume
normalModeBtn.addEventListener('click', () => startHandler('NORMAL'));
colorModeBtn.addEventListener('click', () => startHandler('COLOR_FIND'));

restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetGame();
});

exitBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    returnToMenu();
});

const clearCacheBtn = document.getElementById('clear-cache-btn');
clearCacheBtn.addEventListener('click', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
            window.location.reload(true);
        });
    } else {
        window.location.reload(true);
    }
});

function startLevel(mode) {
    enableAudio();
    gameState = 'PLAYING';
    gameMode = mode;
    menuScreen.classList.add('hidden');
    gameControls.classList.remove('hidden');
    resetGame();

    if (gameMode === 'COLOR_FIND') {
        targetHue = Math.floor(Math.random() * 360);
        speak("おなじ色、探せるかな？");
    }
}

function resetGame() {
    balls.length = 0;
    particles.length = 0;
    characters.length = 0;
    spirits.length = 0;
    if (gameMode === 'COLOR_FIND') {
        targetHue = Math.floor(Math.random() * 360);
    }
}

function returnToMenu() {
    gameState = 'MENU';
    menuScreen.classList.remove('hidden');
    gameControls.classList.add('hidden');
    balls.length = 0;
    particles.length = 0;
    characters.length = 0;
    spirits.length = 0;
}

fullscreenBtn.addEventListener('click', () => {
    if (document.documentElement.requestFullscreen) {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
            fullscreenBtn.style.display = 'none';
        }
    } else {
        // iPad Safari support is limited, maybe just hide it or tell user
        fullscreenBtn.style.display = 'none';
        enableAudio(); // Safety
    }
});

class Ball {
    constructor() {
        this.radius = 45 + Math.random() * 35;
        this.hue = Math.random() * 360;
        this.isCorrect = true;

        if (gameMode === 'COLOR_FIND') {
            if (Math.random() < 0.3) {
                this.hue = targetHue;
                this.isCorrect = true;
            } else {
                this.isCorrect = false;
            }
        }

        const side = Math.floor(Math.random() * 4);
        const margin = this.radius * 2;
        if (side === 0) { // Bottom
            this.x = Math.random() * (width - margin) + this.radius; this.y = height + this.radius;
            this.vx = (Math.random() - 0.5) * 2; this.vy = -(2 + Math.random() * 3);
        } else if (side === 1) { // Top
            this.x = Math.random() * (width - margin) + this.radius; this.y = -this.radius;
            this.vx = (Math.random() - 0.5) * 2; this.vy = (2 + Math.random() * 3);
        } else if (side === 2) { // Left
            this.x = -this.radius; this.y = Math.random() * (height - margin) + this.radius;
            this.vx = (2 + Math.random() * 3); this.vy = (Math.random() - 0.5) * 2;
        } else { // Right
            this.x = width + this.radius; this.y = Math.random() * (height - margin) + this.radius;
            this.vx = -(2 + Math.random() * 3); this.vy = (Math.random() - 0.5) * 2;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // 壁との衝突（画面内に入ってから有効化）
        if (this.x > this.radius && this.x < width - this.radius) {
            if (this.x - this.radius < 0 || this.x + this.radius > width) {
                // すでに上記ifで範囲内なのを保証してるので、ここは実際には画面端に触れた瞬間
            }
        }
        // 簡易的な画面端跳ね返りロジック
        if (this.x - this.radius < 0 && this.vx < 0) this.vx *= -1;
        if (this.x + this.radius > width && this.vx > 0) this.vx *= -1;
        if (this.y - this.radius < 0 && this.vy < 0) this.vy *= -1;
        if (this.y + this.radius > height && this.vy > 0) this.vy *= -1;
    }

    draw() {
        ctx.save();
        let colorStr;
        if (gameMode === 'COLOR_FIND' && !this.isCorrect) {
            colorStr = `hsl(${this.hue}, 5%, 70%)`;
        } else {
            colorStr = `hsl(${this.hue}, 80%, 65%)`;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = colorStr;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.radius = Math.random() * 6 + 3;
        const angle = Math.random() * Math.PI * 2;
        const force = Math.random() * 12 + 4;
        this.vx = Math.cos(angle) * force; this.vy = Math.sin(angle) * force;
        this.life = 1.0; this.decay = 0.015 + Math.random() * 0.02;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.life -= this.decay;
        this.vy += 0.2; this.vx *= 0.98;
    }
    draw() {
        if (this.life <= 0) return;
        ctx.save(); ctx.globalAlpha = this.life; ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill(); ctx.restore();
    }
}

class PopCharacter {
    constructor(x, y) {
        const availableNames = Object.keys(processedImages).filter(n => n !== 'baikinman');
        this.name = availableNames[Math.floor(Math.random() * availableNames.length)];
        const data = processedImages[this.name];
        this.canvas = data ? data.canvas : null;
        this.grid = data ? data.grid : null;
        this.displayName = data ? data.displayName : null;

        this.x = x; this.y = y; this.scale = 0; this.targetScale = 0.65;
        this.life = 4.0; // 待ち時間2秒 + 逃走用
        this.opacity = 1;
        this.rotation = (Math.random() - 0.5) * 0.1; // わずかな傾きのみ
        this.waitTime = 120; // 約2秒（60fps）

        // 逃げる方向と速度
        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 8;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        if (this.grid) {
            this.col = Math.floor(Math.random() * this.grid.cols);
            this.row = Math.floor(Math.random() * this.grid.rows);
            this.targetScale = 1.0;
        }

        if (this.canvas) this.adjustPositionAndScale();

        if (gameMode === 'COLOR_FIND') speak("やったね！");
        else if (this.grid) speak("やったー！");
        else if (this.displayName) speak(this.displayName);
        else speak("わーい！");
    }

    adjustPositionAndScale() {
        let nw = this.canvas.width; let nh = this.canvas.height;
        if (this.grid) { nw /= this.grid.cols; nh /= this.grid.rows; }
        const maxW = width * 0.75; const maxH = height * 0.75;
        let currentW = nw * this.targetScale; let currentH = nh * this.targetScale;
        if (currentW > maxW || currentH > maxH) {
            const ratio = Math.min(maxW / currentW, maxH / currentH);
            this.targetScale *= ratio; currentW = nw * this.targetScale; currentH = nh * this.targetScale;
        }
        const halfW = currentW / 2; const halfH = currentH / 2;
        if (this.x - halfW < 0) this.x = halfW + 10;
        if (this.x + halfW > width) this.x = width - halfW - 10;
        if (this.y - halfH < 0) this.y = halfH + 10;
        if (this.y + halfH > height) this.y = height - halfH - 10;
    }

    update() {
        if (!this.canvas && processedImages[this.name]) {
            const data = processedImages[this.name];
            this.canvas = data.canvas; this.grid = data.grid; this.displayName = data.displayName;
            if (this.grid) { this.col = Math.floor(Math.random() * this.grid.cols); this.row = Math.floor(Math.random() * this.grid.rows); this.targetScale = 1.0; }
            this.adjustPositionAndScale();
        }
        if (this.scale < this.targetScale) this.scale += 0.08;

        if (this.waitTime > 0) {
            this.waitTime--;
        } else {
            // 2秒経過後に逃げる
            this.x += this.vx;
            this.y += this.vy;
            // 走っているように見せるための上下の揺れ
            this.yOffset = Math.sin(Date.now() * 0.02) * 5;
            this.life -= 1 / 60;
        }

        if (this.life < 1.0) this.opacity -= 0.04;
    }

    draw() {
        if (this.opacity <= 0 || !this.canvas) return;
        ctx.save(); ctx.globalAlpha = Math.max(0, this.opacity);
        ctx.translate(this.x, this.y + (this.yOffset || 0));
        ctx.rotate(this.rotation); ctx.scale(this.scale, this.scale);
        if (this.grid) {
            const sw = this.canvas.width / this.grid.cols; const sh = this.canvas.height / this.grid.rows;
            const sx = this.col * sw; const sy = this.row * sh;
            ctx.drawImage(this.canvas, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
        } else {
            const nw = this.canvas.width; const nh = this.canvas.height;
            ctx.drawImage(this.canvas, -nw / 2, -nh / 2, nw, nh);
        }
        ctx.restore();
    }
}

function handleTouch(ex, ey) {
    if (gameState !== 'PLAYING' || isPaused) return;
    let hit = false;
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        const dist = Math.sqrt((ex - ball.x) ** 2 + (ey - ball.y) ** 2);
        if (dist < ball.radius + 25) {
            playPopSound(ball.isCorrect);
            if (ball.isCorrect) {
                for (let j = 0; j < 20; j++) particles.push(new Particle(ball.x, ball.y, `hsl(${ball.hue}, 80%, 65%)`));
                characters.push(new PopCharacter(ball.x, ball.y));
            }
            balls.splice(i, 1);
            hit = true;
            break;
        }
    }
}

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); for (let i = 0; i < e.touches.length; i++) { const t = e.touches[i]; handleTouch(t.clientX - rect.left, t.clientY - rect.top); } }, { passive: false });
canvas.addEventListener('mousedown', (e) => { const rect = canvas.getBoundingClientRect(); handleTouch(e.clientX - rect.left, e.clientY - rect.top); });

let currentTargetBallCount = 12;
let lastBallCountUpdate = 0;

function animate() {
    if (isPaused) {
        requestAnimationFrame(animate);
        return;
    }
    ctx.clearRect(0, 0, width, height);
    if (gameState === 'PLAYING') {
        const now = Date.now();
        // 5秒ごとに目標数をランダムに変更
        if (now - lastBallCountUpdate > 5000) {
            currentTargetBallCount = 10 + Math.floor(Math.random() * 6); // 10-15
            lastBallCountUpdate = now;
        }

        // ボールの数が目標より少なければ追加
        if (balls.length < currentTargetBallCount && Math.random() < 0.05) {
            balls.push(new Ball());
        }

        // ボール同士の衝突
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const b1 = balls[i];
                const b2 = balls[j];
                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = b1.radius + b2.radius;

                if (distance < minDistance) {
                    // 衝突応答 (弾性衝突)
                    const angle = Math.atan2(dy, dx);
                    const sin = Math.sin(angle);
                    const cos = Math.cos(angle);

                    // 速度を回転
                    const vx1 = b1.vx * cos + b1.vy * sin;
                    const vy1 = b1.vy * cos - b1.vx * sin;
                    const vx2 = b2.vx * cos + b2.vy * sin;
                    const vy2 = b2.vy * cos - b2.vx * sin;

                    // 衝突後の速度 (質量は半径に比例と仮定)
                    const m1 = b1.radius;
                    const m2 = b2.radius;
                    const vx1Final = ((m1 - m2) * vx1 + 2 * m2 * vx2) / (m1 + m2);
                    const vx2Final = ((m2 - m1) * vx2 + 2 * m1 * vx1) / (m1 + m2);

                    // 速度を戻す
                    b1.vx = vx1Final * cos - vy1 * sin;
                    b1.vy = vy1 * cos + vx1Final * sin;
                    b2.vx = vx2Final * cos - vy2 * sin;
                    b2.vy = vy2 * cos + vx2Final * sin;

                    // 重なり防止
                    const overlap = minDistance - distance;
                    const moveX = (overlap / 2) * cos;
                    const moveY = (overlap / 2) * sin;
                    b1.x -= moveX; b1.y -= moveY;
                    b2.x += moveX; b2.y += moveY;
                }
            }
        }

        for (let i = balls.length - 1; i >= 0; i--) {
            balls[i].update(); balls[i].draw();
            // 画面外判定（発生直後の猶予を持たせる）
            const b = balls[i];
            const margin = 300;
            if (b.x < -margin || b.x > width + margin || b.y < -margin || b.y > height + margin) {
                balls.splice(i, 1);
            }
        }
    }
    for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); particles[i].draw(); if (particles[i].life <= 0) particles.splice(i, 1); }
    for (let i = characters.length - 1; i >= 0; i--) { characters[i].update(); characters[i].draw(); if (characters[i].opacity <= 0) characters.splice(i, 1); }
    for (let i = spirits.length - 1; i >= 0; i--) { spirits[i].update(); spirits[i].draw(); if (spirits[i].opacity <= 0) spirits.splice(i, 1); }
    requestAnimationFrame(animate);
}
animate();
