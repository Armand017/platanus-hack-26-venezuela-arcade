const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-root',
  backgroundColor: '#111122',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s', 'ArrowDown'],
  P1_L: ['a', 'ArrowLeft'],
  P1_R: ['d', 'ArrowRight'],
  P1_1: ['u', 'z'],
  P1_2: ['i', 'x'],
  P1_3: ['o', 'c'],
  START1: ['Enter']
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[key.toLowerCase()] = arcadeCode;
  }
}

let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'move') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'drop') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'tick') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
      osc.start();
      osc.stop(ctx.currentTime + 0.02);
    } else if (type === 'clear') {
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
    }
  } catch (e) {}
}

function speak(text) {
  try {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.2;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {}
}

new Phaser.Game(config);

function preload() {}

function create() {
  const scene = this;
  
  scene.controls = { held: {}, pressed: {} };
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === '9') {
      scene.energy = 50;
      return;
    }
    if (k === '0') {
      scene.energy = 100;
      return;
    }
    const code = KEYBOARD_TO_ARCADE[k];
    if (code) {
      if (!scene.controls.held[code]) scene.controls.pressed[code] = true;
      scene.controls.held[code] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    const code = KEYBOARD_TO_ARCADE[k];
    if (code) scene.controls.held[code] = false;
  });

  resetGame(scene);

  scene.graphics = scene.add.graphics();

  scene.add.text(400, 25, 'TETRIS ARCADE', { fontSize: '28px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
  scene.scoreText = scene.add.text(70, 100, 'SCORE:\n0', { fontSize: '18px', fill: '#fff', align: 'center' }).setOrigin(0.5);
  scene.timerText = scene.add.text(730, 60, 'TIME:\n60', { fontSize: '18px', fill: '#fff', align: 'center' }).setOrigin(0.5);
  scene.comboText = scene.add.text(730, 160, 'COMBO:\nx0', { fontSize: '18px', fill: '#ff0', align: 'center' }).setOrigin(0.5);
  scene.add.text(730, 240, 'NEXT:', { fontSize: '16px', fill: '#fff', align: 'center' }).setOrigin(0.5);

  scene.infoText = scene.add.text(400, 570, 'MOVE: Joystick | ROTATE: U/Z | DROP: I/X | POWER: O/C | RESTART: ENTER', { fontSize: '13px', fill: '#aaa' }).setOrigin(0.5);
  scene.gameOverText = scene.add.text(400, 300, '', { fontSize: '36px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5);
}

function resetGame(scene) {
  scene.boardWidth = 10;
  scene.boardHeight = 20;
  scene.tileSize = 24;
  scene.boardX = 280;
  scene.boardY = 60;

  scene.board = Array(scene.boardHeight).fill(0).map(() => Array(scene.boardWidth).fill(0));

  scene.shapes = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[0,1,1],[1,1,0]], // S
    [[1,1,0],[0,1,1]], // Z
    [[1,0,0],[1,1,1]], // J
    [[0,0,1],[1,1,1]]  // L
  ];
  scene.colors = [0x00ffff, 0xffff00, 0xaa00ff, 0x00ff00, 0xff0000, 0x0000ff, 0xffaa00];

  scene.score = 0;
  scene.dropTimer = 0;
  scene.dropInterval = 500;
  scene.gameOver = false;
  scene.moveCooldown = 0;

  scene.timeLeft = 60;
  scene.lastTickSecond = -1;
  scene.combo = 0;
  scene.comboTimer = 0;
  scene.energy = 0; // 0 to 100
  scene.slowMoTimer = 0;
  scene.noComboGain = false;

  scene.nextPiece = getRandomPiece(scene);
  spawnPiece(scene);

  if (scene.scoreText) scene.scoreText.setText('SCORE:\n0');
  if (scene.timerText) {
    scene.timerText.setText('TIME:\n60');
    scene.timerText.setStyle({ fill: '#fff' });
    scene.timerText.setAlpha(1);
  }
  if (scene.comboText) scene.comboText.setText('COMBO:\nx0');
  if (scene.gameOverText) scene.gameOverText.setText('');
}

function getRandomPiece(scene) {
  const idx = Math.floor(Math.random() * scene.shapes.length);
  return {
    shape: scene.shapes[idx],
    color: scene.colors[idx],
    x: Math.floor(scene.boardWidth / 2) - Math.floor(scene.shapes[idx][0].length / 2),
    y: 0
  };
}

function spawnPiece(scene) {
  scene.currentPiece = scene.nextPiece;
  scene.nextPiece = getRandomPiece(scene);

  if (checkCollision(scene, scene.currentPiece, 0, 0)) {
    scene.gameOver = true;
    scene.gameOverText.setText('GAME OVER\nPRESS START TO RESTART');
    speak('GAME OVER');
  }
}

function checkCollision(scene, piece, offsetX, offsetY, customShape) {
  const shape = customShape || piece.shape;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        let newX = piece.x + c + offsetX;
        let newY = piece.y + r + offsetY;
        if (newX < 0 || newX >= scene.boardWidth || newY >= scene.boardHeight) {
          return true;
        }
        if (newY >= 0 && scene.board[newY][newX]) {
          return true;
        }
      }
    }
  }
  return false;
}

function mergePiece(scene) {
  const p = scene.currentPiece;
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (p.shape[r][c] && p.y + r >= 0) {
        scene.board[p.y + r][p.x + c] = p.color;
      }
    }
  }
}

function clearLines(scene) {
  let cleared = 0;
  for (let r = scene.boardHeight - 1; r >= 0; r--) {
    if (scene.board[r].every(cell => cell !== 0)) {
      scene.board.splice(r, 1);
      scene.board.unshift(Array(scene.boardWidth).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared > 0) {
    if (!scene.noComboGain) {
      scene.combo++;
      scene.energy = Math.min(100, scene.energy + cleared * 15);
      if (scene.energy >= 100) {
        speak('MAXIMUM LEVEL!');
      } else if (scene.combo > 1) {
        speak('COMBO!');
      }
    }
    scene.comboTimer = 3000;
    scene.score += cleared * 100 * (scene.combo > 0 ? scene.combo : 1);
    scene.scoreText.setText('SCORE:\n' + scene.score);
    scene.comboText.setText('COMBO:\nx' + scene.combo);

    playSound('clear');

    const shakeIntensity = cleared === 4 ? 0.02 : 0.01;
    scene.cameras.main.shake(100, shakeIntensity);

    const floatText = scene.add.text(scene.boardX + scene.boardWidth * scene.tileSize / 2, scene.boardY + 200, `+${cleared * 100}` + (scene.combo > 1 ? ` x${scene.combo}` : ''), { fontSize: '20px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
    scene.tweens.add({
      targets: floatText,
      y: floatText.y - 50,
      alpha: 0,
      duration: 800,
      onComplete: () => floatText.destroy()
    });
  }
}

function rotatePiece(scene) {
  const p = scene.currentPiece;
  const rows = p.shape.length;
  const cols = p.shape[0].length;
  let rotated = Array(cols).fill(0).map(() => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = p.shape[r][c];
    }
  }
  if (!checkCollision(scene, p, 0, 0, rotated)) {
    p.shape = rotated;
    playSound('move');
  }
}

function hardDrop(scene) {
  while (!checkCollision(scene, scene.currentPiece, 0, 1)) {
    scene.currentPiece.y++;
  }
  mergePiece(scene);
  clearLines(scene);
  spawnPiece(scene);
  playSound('drop');
  scene.cameras.main.shake(80, 0.015);
}

function update(time, delta) {
  const scene = this;

  if (scene.gameOver) {
    if (scene.controls.pressed['START1']) {
      scene.controls.pressed['START1'] = false;
      resetGame(scene);
    }
    scene.controls.pressed = {};
    return;
  }

  scene.timeLeft -= delta / 1000;
  if (scene.timeLeft <= 0) {
    scene.timeLeft = 0;
    scene.gameOver = true;
    scene.timerText.setText('TIME:\n0');
    scene.timerText.setStyle({ fill: '#ff0000' });
    scene.timerText.setAlpha(1);
    scene.gameOverText.setText('TIME UP!\nPRESS START TO RESTART');
    speak('GAME OVER');
    return;
  }

  const currentSec = Math.ceil(scene.timeLeft);
  if (currentSec <= 5 && currentSec >= 0) {
    if (currentSec !== scene.lastTickSecond) {
      scene.lastTickSecond = currentSec;
      playSound('tick');
    }
  }

  scene.timerText.setText('TIME:\n' + currentSec);

  if (scene.timeLeft < 5) {
    scene.timerText.setStyle({ fill: '#ff0000' });
    if (Math.floor(time / 200) % 2 === 0) {
      scene.timerText.setAlpha(0.2);
    } else {
      scene.timerText.setAlpha(1);
    }
  } else if (scene.timeLeft < 10) {
    scene.timerText.setStyle({ fill: '#ffff00' });
    scene.timerText.setAlpha(1);
  } else {
    scene.timerText.setStyle({ fill: '#ffffff' });
    scene.timerText.setAlpha(1);
  }

  if (scene.combo > 0) {
    scene.comboTimer -= delta;
    if (scene.comboTimer <= 0) {
      scene.combo = 0;
      scene.comboText.setText('COMBO:\nx0');
    }
  }

  if (scene.slowMoTimer > 0) {
    scene.slowMoTimer -= delta;
    if (scene.slowMoTimer <= 0) {
      scene.noComboGain = false;
    }
  }

  if (scene.controls.pressed['P1_1']) {
    rotatePiece(scene);
  }

  if (scene.controls.pressed['P1_2']) {
    hardDrop(scene);
  }

  if (scene.controls.pressed['P1_3']) {
    if (scene.energy >= 100) {
      scene.energy = 0;
      for (let i = 0; i < 4; i++) {
        scene.board.pop();
        scene.board.unshift(Array(scene.boardWidth).fill(0));
      }
      scene.score += 500;
      scene.scoreText.setText('SCORE:\n' + scene.score);
      playSound('clear');
      scene.cameras.main.shake(150, 0.025);
    } else if (scene.energy >= 66.66 && scene.energy < 100 && scene.slowMoTimer <= 0) {
      scene.energy -= 66.66;
      scene.slowMoTimer = 3000;
      scene.noComboGain = true;
      playSound('move');
    } else if (scene.energy >= 33.33 && scene.energy < 66.66) {
      scene.energy -= 33.33;
      scene.combo = 0;
      scene.comboText.setText('COMBO:\nx0');
      spawnPiece(scene);
      playSound('drop');
    }
  }

  if (time > scene.moveCooldown) {
    if (scene.controls.held['P1_L']) {
      if (!checkCollision(scene, scene.currentPiece, -1, 0)) {
        scene.currentPiece.x--;
        playSound('move');
      }
      scene.moveCooldown = time + 120;
    }
    if (scene.controls.held['P1_R']) {
      if (!checkCollision(scene, scene.currentPiece, 1, 0)) {
        scene.currentPiece.x++;
        playSound('move');
      }
      scene.moveCooldown = time + 120;
    }
  }

  let dropSpeed = scene.slowMoTimer > 0 ? scene.dropInterval * 2 : scene.dropInterval;
  if (scene.controls.held['P1_D']) {
    dropSpeed = 50;
  }

  scene.dropTimer += delta;
  if (scene.dropTimer > dropSpeed) {
    scene.dropTimer = 0;
    if (!checkCollision(scene, scene.currentPiece, 0, 1)) {
      scene.currentPiece.y++;
    } else {
      mergePiece(scene);
      clearLines(scene);
      spawnPiece(scene);
    }
  }

  scene.controls.pressed = {};

  scene.graphics.clear();
  
  scene.graphics.fillStyle(0x050510, 1);
  scene.graphics.fillRect(scene.boardX, scene.boardY, scene.boardWidth * scene.tileSize, scene.boardHeight * scene.tileSize);
  
  for (let r = 0; r < scene.boardHeight; r++) {
    for (let c = 0; c < scene.boardWidth; c++) {
      if (scene.board[r][c]) {
        drawTile(scene.graphics, scene.boardX + c * scene.tileSize, scene.boardY + r * scene.tileSize, scene.tileSize, scene.board[r][c]);
      }
    }
  }

  if (scene.currentPiece) {
    const p = scene.currentPiece;
    
    // Ghost Piece
    let ghostY = p.y;
    while (!checkCollision(scene, p, 0, ghostY - p.y + 1)) {
      ghostY++;
    }
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c]) {
          drawTile(scene.graphics, scene.boardX + (p.x + c) * scene.tileSize, scene.boardY + (ghostY + r) * scene.tileSize, scene.tileSize, p.color, 0.3);
        }
      }
    }

    // Current Piece
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c]) {
          drawTile(scene.graphics, scene.boardX + (p.x + c) * scene.tileSize, scene.boardY + (p.y + r) * scene.tileSize, scene.tileSize, p.color, 1.0);
        }
      }
    }
  }

  // Next Piece Preview
  if (scene.nextPiece) {
    const np = scene.nextPiece;
    const previewX = 700;
    const previewY = 280;
    scene.graphics.fillStyle(0x222244, 1);
    scene.graphics.fillRect(previewX - 10, previewY - 10, 80, 80);
    scene.graphics.lineStyle(1, 0xffffff, 0.5);
    scene.graphics.strokeRect(previewX - 10, previewY - 10, 80, 80);

    const offsetX = previewX + (4 - np.shape[0].length) * scene.tileSize / 4;
    const offsetY = previewY + (4 - np.shape.length) * scene.tileSize / 4;
    for (let r = 0; r < np.shape.length; r++) {
      for (let c = 0; c < np.shape[r].length; c++) {
        if (np.shape[r][c]) {
          drawTile(scene.graphics, offsetX + c * (scene.tileSize * 0.75), offsetY + r * (scene.tileSize * 0.75), scene.tileSize * 0.75, np.color, 1.0);
        }
      }
    }
  }

  // Draw Energy Bar
  const barX = 70;
  const barY = 200;
  const barW = 20;
  const barH = 150;
  scene.graphics.fillStyle(0x222244, 1);
  scene.graphics.fillRect(barX, barY, barW, barH);
  
  const fillH = (scene.energy / 100) * barH;
  let barColor = scene.energy >= 66.66 ? 0x00ffff : 0xffaa00;
  if (scene.energy >= 100) {
    if (Math.floor(time / 200) % 2 === 0) {
      barColor = 0xffff00;
    } else {
      barColor = 0x00ff00;
    }
  }
  scene.graphics.fillStyle(barColor, 1);
  scene.graphics.fillRect(barX, barY + (barH - fillH), barW, fillH);
  scene.graphics.lineStyle(2, 0xffffff, 1);
  scene.graphics.strokeRect(barX, barY, barW, barH);
}

function drawTile(g, x, y, size, color, alpha = 1.0) {
  g.fillStyle(color, alpha);
  g.fillRect(x + 1, y + 1, size - 2, size - 2);
}
