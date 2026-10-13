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
    } else if (type === 'powerup') {
      osc.type = 'square';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(600, now + 0.08);
      osc.frequency.setValueAtTime(900, now + 0.16);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start();
      osc.stop(now + 0.3);
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
  scene.rackLabel = null;
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === '9') {
      scene.isDraining = false;
      addEnergy(scene, 50);
      return;
    }
    if (k === '0') {
      scene.isDraining = false;
      addEnergy(scene, 100 - scene.energy);
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

  // Create a dedicated graphics object for the rack (will be masked)
  scene.rackGraphics = scene.add.graphics();

  // Create the mask (a rectangle covering the rack area)
  const rackX = 680;
  const rackY = 200;
  const rackW = 110;
  const slotH = 70;
  const rackH = slotH * 4;

  const maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
  maskShape.fillStyle(0xffffff);
  maskShape.fillRect(rackX + 2, rackY + 2, rackW - 4, rackH - 4);

  const mask = maskShape.createGeometryMask();
  scene.rackGraphics.setMask(mask);

  scene.add.text(400, 25, 'TETRIS ARCADE', { fontSize: '28px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
  scene.scoreText = scene.add.text(70, 100, 'SCORE:\n0', { fontSize: '18px', fill: '#fff', align: 'center' }).setOrigin(0.5);
  scene.comboText = scene.add.text(730, 160, 'COMBO:\nx0', { fontSize: '18px', fill: '#ff0', align: 'center' }).setOrigin(0.5);

  scene.infoText = scene.add.text(400, 570, 'MOVE: Joystick | ROTATE: U/Z | DROP: I/X | POWER: O/C | RESTART: ENTER', { fontSize: '13px', fill: '#aaa' }).setOrigin(0.5);
  scene.gameOverText = scene.add.text(400, 300, '', { fontSize: '36px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5).setDepth(200);
}

function addEnergy(scene, amount) {
  const oldEnergy = scene.energy;
  scene.energy = Math.min(100, Math.max(0, scene.energy + amount));
  
  if (amount > 0) {
    scene.energyGainAmount = amount;
    scene.energyGainTimer = 300;
  }

  if (oldEnergy < 100 && scene.energy >= 100) {
    playSound('powerup');
    const floatText = scene.add.text(80, 180, 'MAXIMUM!', { fontSize: '16px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
    scene.tweens.add({
      targets: floatText,
      y: floatText.y - 40,
      alpha: 0,
      duration: 800,
      onComplete: () => floatText.destroy()
    });
  }
}

function triggerGameOver(scene, message) {
  if (scene.gameOver) return;
  scene.gameOver = true;
  scene.gameOverText.setText(message);
  speak('GAME OVER');

  scene.glassCracked = true;
  scene.glassColorProgress = 0;
  scene.glassCrackDelay = 2000;
  scene.glassCrackReady = false;

  const barX = 70;
  const barY = 200;
  const barW = 20;
  const barH = 150;
  const minX = barX;
  const maxX = barX + barW;
  const minY = barY;
  const maxY = barY + barH;

  scene.crackPaths = [];
  const maxAngleChange = 80 * (Math.PI / 180);

  function createCrackPath(startX, startY, baseAngle, segmentCount) {
    const path = [{ x: startX, y: startY }];
    let curX = startX;
    let curY = startY;
    let curAngle = baseAngle;
    for (let s = 0; s < segmentCount; s++) {
      curAngle += (Math.random() * 2 - 1) * maxAngleChange;
      const len = Math.random() * 10 + 3;
      curX = Phaser.Math.Clamp(curX + Math.cos(curAngle) * len, minX, maxX);
      curY = Phaser.Math.Clamp(curY + Math.sin(curAngle) * len, minY, maxY);
      path.push({ x: curX, y: curY });
    }
    return path;
  }

  const mainImpactX = barX + Math.random() * barW;
  const mainImpactY = barY + Math.random() * barH;
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const segs = Phaser.Math.Between(18, 22);
    const mainPath = createCrackPath(mainImpactX, mainImpactY, angle, segs);
    scene.crackPaths.push(mainPath);

    if (Math.random() < 0.5) {
      const midIdx = Phaser.Math.Between(2, Math.max(2, mainPath.length - 3));
      const branchAngle = angle + (Math.random() < 0.5 ? -1 : 1) * (Phaser.Math.Between(35, 75) * (Math.PI / 180));
      scene.crackPaths.push(createCrackPath(mainPath[midIdx].x, mainPath[midIdx].y, branchAngle, Phaser.Math.Between(5, 8)));
    }
  }

  scene.sparkParticles = [];
  scene.sparksActive = true;
  for (let r = 0; r < scene.boardHeight; r++) {
    for (let c = 0; c < scene.boardWidth; c++) {
      if (scene.board[r][c]) {
        const color = scene.board[r][c];
        const cellCenterX = scene.boardX + c * scene.tileSize + scene.tileSize / 2;
        const cellCenterY = scene.boardY + r * scene.tileSize + scene.tileSize / 2;
        for (let i = 0; i < 3; i++) {
          const rect = scene.add.rectangle(cellCenterX, cellCenterY, 3, 3, color);
          scene.sparkParticles.push({
            obj: rect,
            vx: (Math.random() - 0.5) * 160 * 1.4,
            vy: (-Math.random() * 100 - 50) * 1.4,
            life: Math.random() * 1100 + 1700,
            age: 0
          });
        }
      }
    }
  }

  for (let r = 0; r < scene.boardHeight; r++) {
    for (let c = 0; c < scene.boardWidth; c++) {
      scene.board[r][c] = 0;
    }
  }

  scene.time.delayedCall(800, () => {
    if (scene.gameOver) scene.shatterActive = true;
  });
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

  scene.lockTimer = 0;
  scene.lockResets = 0;
  scene.isLocking = false;

  scene.timeLeft = 60;
  scene.lastTickSecond = -1;
  scene.combo = 0;
  scene.comboTimer = 0;
  scene.energy = 0; // 0 to 100
  scene.energyDrainTarget = 0;
  scene.isDraining = false;
  scene.energyGainTimer = 0;
  scene.energyGainAmount = 0;
  scene.slowMoTimer = 0;
  scene.noComboGain = false;
  scene.glassBreakTimer = 0;
  scene.glassAlpha = 1;
  scene.glassShards = [];
  scene.glassCracked = false;
  scene.glassColorProgress = 0;
  scene.glassCrackDelay = 0;
  scene.glassCrackReady = false;
  scene.crackPaths = null;
  scene.shatterActive = false;
  scene.shatterPieces = [];
  scene.shatterCracks = [];

  scene.nextPieces = [];
  for (let i = 0; i < 4; i++) {
    scene.nextPieces.push(getRandomPiece(scene));
  }
  scene.ammoShiftAnim = 0;

  if (scene.rackLabel) {
    scene.rackLabel.destroy();
    scene.rackLabel = null;
  }

  if (scene.rackGraphics) {
    scene.rackGraphics.clear();
  }

  if (scene.shatterPieces) {
    for (const sp of scene.shatterPieces) {
      if (sp.piece) sp.piece.destroy();
      if (sp.crackG) sp.crackG.destroy();
    }
  }
  scene.shatterPieces = [];
  scene.shatterActive = false;

  if (scene.sparkParticles) {
    for (const p of scene.sparkParticles) {
      if (p.obj) p.obj.destroy();
    }
  }
  scene.sparkParticles = [];
  scene.sparksActive = false;

  spawnPiece(scene);

  if (scene.scoreText) scene.scoreText.setText('SCORE:\n0');
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
  scene.currentPiece = scene.nextPieces.shift();
  scene.nextPieces.push(getRandomPiece(scene));
  scene.ammoShiftAnim = 1.0;

  if (checkCollision(scene, scene.currentPiece, 0, 0)) {
    triggerGameOver(scene, 'GAME OVER\nPRESS START TO RESTART');
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
  const rowsToClear = [];
  for (let r = scene.boardHeight - 1; r >= 0; r--) {
    if (scene.board[r].every(cell => cell !== 0)) {
      rowsToClear.push(r);
    }
  }
  
  if (rowsToClear.length === 0) return;
  
  // Save the row data for the fade animation BEFORE splicing
  const savedRows = rowsToClear.map(r => ({
    rowIndex: r,
    cells: [...scene.board[r]]
  }));
  
  // Origin column: use the current piece's center X
  const piece = scene.currentPiece;
  const originCol = piece ? piece.x + Math.floor(piece.shape[0].length / 2) : 4;
  
  // Splice the board (game logic updated immediately)
  for (const r of rowsToClear) {
    scene.board.splice(r, 1);
    scene.board.unshift(Array(scene.boardWidth).fill(0));
  }
  
  // Visual fade animation
  for (const saved of savedRows) {
    for (let c = 0; c < scene.boardWidth; c++) {
      const cellColor = saved.cells[c];
      if (!cellColor) continue;
      const distance = Math.abs(c - originCol);
      const cx = scene.boardX + c * scene.tileSize + scene.tileSize / 2;
      const cy = scene.boardY + saved.rowIndex * scene.tileSize + scene.tileSize / 2;
      
      const overlay = scene.add.rectangle(cx, cy, scene.tileSize, scene.tileSize, 0xffffff, 0.9).setDepth(6);
      scene.tweens.add({
        targets: overlay,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 200,
        delay: distance * 35,
        ease: 'Cubic.easeOut',
        onComplete: () => overlay.destroy()
      });
    }
  }
  
  // Now the scoring/combo logic (unchanged)
  const cleared = rowsToClear.length;
  if (!scene.noComboGain) {
    scene.combo++;
    addEnergy(scene, cleared * 15);
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
  
  const fontSize = Math.min(52, 22 + scene.combo * 3);
  let textColor = '#ffff00';
  if (scene.combo >= 10) textColor = '#ff00ff';
  else if (scene.combo >= 7) textColor = '#00ffff';
  else if (scene.combo >= 5) textColor = '#00ff00';
  else if (scene.combo >= 3) textColor = '#ffaa00';
  
  const floatText = scene.add.text(
    scene.boardX + scene.boardWidth * scene.tileSize / 2,
    scene.boardY + scene.boardHeight * scene.tileSize / 2,
    `+${cleared * 100 * scene.combo}` + (scene.combo > 1 ? ` x${scene.combo}` : ''),
    {
      fontSize: fontSize + 'px',
      fill: textColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5
    }
  ).setOrigin(0.5).setDepth(100);
  scene.tweens.add({
    targets: floatText,
    y: floatText.y - 80,
    scale: 1.3,
    alpha: 0,
    duration: 1000,
    ease: 'Cubic.easeOut',
    onComplete: () => floatText.destroy()
  });
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
  
  // Wall Kick offsets: try these in order until one works
  const kicks = [
    [0, 0],
    [-1, 0], [1, 0],   // shift left/right
    [0, -1],            // floor kick (lift up 1)
    [-1, -1], [1, -1],  // diagonal kicks
    [-2, 0], [2, 0],    // double shift
    [-2, -1], [2, -1]
  ];
  
  for (const [offsetX, offsetY] of kicks) {
    if (!checkCollision(scene, p, offsetX, offsetY, rotated)) {
      p.shape = rotated;
      p.x += offsetX;
      p.y += offsetY;
      if (scene.isLocking && scene.lockResets < 15) {
        scene.lockTimer = 0;
        scene.lockResets++;
      }
      playSound('move');
      return;
    }
  }
  // If no kick works, rotation is cancelled
}

function hardDrop(scene) {
  const startY = scene.currentPiece.y;
  const startX = scene.currentPiece.x;
  const pieceShape = scene.currentPiece.shape;
  const pieceColor = scene.currentPiece.color;
  
  while (!checkCollision(scene, scene.currentPiece, 0, 1)) {
    scene.currentPiece.y++;
  }
  const endY = scene.currentPiece.y;
  
  // Trail cascade effect
  for (let r = 0; r < pieceShape.length; r++) {
    for (let c = 0; c < pieceShape[r].length; c++) {
      if (pieceShape[r][c]) {
        const col = startX + c;
        const cellStartY = startY + r;
        const cellEndY = endY + r;
        if (cellEndY > cellStartY) {
          for (let row = cellStartY; row < cellEndY; row += 2) {
            const trail = scene.add.rectangle(
              scene.boardX + col * scene.tileSize + scene.tileSize / 2,
              scene.boardY + row * scene.tileSize + scene.tileSize / 2,
              scene.tileSize - 6,
              scene.tileSize - 6,
              pieceColor,
              0.55
            ).setDepth(4);
            scene.tweens.add({
              targets: trail,
              alpha: 0,
              scale: 0.4,
              duration: 280,
              delay: (row - cellStartY) * 18,
              onComplete: () => trail.destroy()
            });
          }
        }
      }
    }
  }
  
  // Burst glow effect from piece edges
  for (let r = 0; r < pieceShape.length; r++) {
    for (let c = 0; c < pieceShape[r].length; c++) {
      if (pieceShape[r][c]) {
        const col = startX + c;
        const row = endY + r;
        const centerX = scene.boardX + col * scene.tileSize + scene.tileSize / 2;
        const centerY = scene.boardY + row * scene.tileSize + scene.tileSize / 2;
        const glow = scene.add.rectangle(
          centerX, centerY,
          scene.tileSize, scene.tileSize,
          pieceColor, 0.8
        ).setDepth(5);
        scene.tweens.add({
          targets: glow,
          scaleX: 1.8,
          scaleY: 1.8,
          alpha: 0,
          duration: 250,
          ease: 'Cubic.easeOut',
          onComplete: () => glow.destroy()
        });
      }
    }
  }

  mergePiece(scene);
  clearLines(scene);
  spawnPiece(scene);
  playSound('drop');
  scene.cameras.main.shake(80, 0.015);
}

function update(time, delta) {
  const scene = this;

  if (scene.sparksActive) {
    for (let i = scene.sparkParticles.length - 1; i >= 0; i--) {
      const p = scene.sparkParticles[i];
      p.vy += 400 * (delta / 1000);
      p.obj.x += p.vx * (delta / 1000);
      p.obj.y += p.vy * (delta / 1000);

      const minX = scene.boardX;
      const maxX = scene.boardX + scene.boardWidth * scene.tileSize;
      const minY = scene.boardY;
      const maxY = scene.boardY + scene.boardHeight * scene.tileSize;

      if (p.obj.x <= minX || p.obj.x >= maxX) {
        p.vx *= -0.85;
        p.obj.x = Phaser.Math.Clamp(p.obj.x, minX, maxX);
      }
      if (p.obj.y >= maxY) {
        p.vy *= -0.85;
        p.vx *= 0.95;
        p.obj.y = maxY;
      }
      if (p.obj.y < minY) {
        p.vy *= -0.85;
        p.obj.y = minY;
      }

      p.age += delta;
      if (p.age >= p.life) {
        p.obj.destroy();
        scene.sparkParticles.splice(i, 1);
      }
    }
    if (scene.sparkParticles.length === 0) {
      scene.sparksActive = false;
    }
  }

  if (scene.glassCracked) {
    if (scene.glassColorProgress < 1) {
      scene.glassColorProgress = Math.min(1, scene.glassColorProgress + delta / 300);
    }
    if (scene.glassCrackDelay > 0) {
      scene.glassCrackDelay -= delta;
      if (scene.glassCrackDelay <= 0) {
        scene.glassCrackReady = true;
      }
    }
  }

  if (scene.shatterActive && scene.shatterPieces.length === 0) {
    // Create 4 quadrant rectangles covering the entire screen
    const W = 800, H = 600;
    const halfW = W / 2, halfH = H / 2;
    const quadrants = [
      { x: 0, y: 0 },
      { x: halfW, y: 0 },
      { x: 0, y: halfH },
      { x: halfW, y: halfH }
    ];
    
    for (let i = 0; i < 4; i++) {
      const q = quadrants[i];
      const piece = scene.add.rectangle(
        q.x + halfW / 2,
        q.y + halfH / 2,
        halfW,
        halfH,
        0x050510,
        1
      ).setDepth(150);
      
      // Draw crack lines on each piece (as a child overlay)
      const crackG = scene.add.graphics().setDepth(151);
      crackG.lineStyle(1, 0x00ffff, 0.8);
      crackG.lineBetween(q.x, q.y, q.x + halfW, q.y + halfH);
      crackG.lineStyle(1, 0xffffff, 0.5);
      crackG.lineBetween(q.x + halfW / 2, q.y, q.x, q.y + halfH / 2);
      
      scene.shatterPieces.push({ piece, crackG, q, halfW, halfH, i });
      
      // Tween: fall and rotate
      const fallDir = i < 2 ? -1 : 1;
      const fallX = i % 2 === 0 ? -120 : 120;
      scene.tweens.add({
        targets: [piece, crackG],
        x: `+=${fallX}`,
        y: `+=${H + 100}`,
        angle: fallDir * Phaser.Math.Between(25, 60),
        alpha: 0,
        duration: 1600,
        ease: 'Cubic.easeIn',
        delay: i * 60,
        onComplete: () => {
          piece.destroy();
          crackG.destroy();
        }
      });
    }
    
    playSound('clear');
    scene.cameras.main.shake(400, 0.02);
  }

  // Energy draining for Level 3
  if (scene.isDraining && scene.energy > scene.energyDrainTarget) {
    scene.energy = Math.max(scene.energyDrainTarget, scene.energy - delta * 0.6);
    if (scene.energy <= scene.energyDrainTarget) {
      scene.isDraining = false;
      scene.energyDrainTarget = 0;
    }
  }

  if (scene.glassBreakTimer > 0) {
    scene.glassBreakTimer -= delta;
    if (scene.glassBreakTimer <= 0) {
      scene.glassAlpha = 0;
    }
  } else if (scene.glassAlpha < 1) {
    scene.glassAlpha = Math.min(1, scene.glassAlpha + delta / 300);
  }

  if (scene.energyGainTimer > 0) {
    scene.energyGainTimer -= delta;
  }

  if (scene.gameOver) {
    if (scene.controls.pressed['START1']) {
      scene.controls.pressed['START1'] = false;
      resetGame(scene);
      return;
    }
    scene.controls.pressed = {};
  } else {
    scene.timeLeft -= delta / 1000;
    if (scene.timeLeft <= 0) {
      scene.timeLeft = 0;
      triggerGameOver(scene, 'TIME UP!\nPRESS START TO RESTART');
      return;
    }

    const currentSec = Math.ceil(scene.timeLeft);
    if (currentSec <= 5 && currentSec >= 0) {
      if (currentSec !== scene.lastTickSecond) {
        scene.lastTickSecond = currentSec;
        playSound('tick');
      }
    }

    if (scene.ammoShiftAnim > 0) {
      scene.ammoShiftAnim = Math.max(0, scene.ammoShiftAnim - delta / 120);
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
        // Level 3: Clear 4 lines & break energy jar
        scene.isDraining = true;
        scene.energyDrainTarget = 0;
        scene.glassBreakTimer = 400;
        scene.glassAlpha = 0;
        scene.glassShards = [];
        const barX = 70;
        const barY = 200;
        const barW = 20;
        const barH = 150;
        const shardCount = Phaser.Math.Between(8, 12);
        for (let i = 0; i < shardCount; i++) {
          const sx = barX + Math.random() * barW;
          const sy = barY + Math.random() * barH;
          const angle = Math.random() * Math.PI * 2;
          const length = Phaser.Math.Between(5, 15);
          scene.glassShards.push({
            x: sx,
            y: sy,
            dx: Math.cos(angle) * length,
            dy: Math.sin(angle) * length
          });
        }

        // Save bottom 4 rows for the fade animation
        const bottomRows = [];
        for (let i = 0; i < 4; i++) {
          const rowIdx = scene.boardHeight - 1 - i;
          bottomRows.push({ rowIndex: rowIdx, cells: [...scene.board[rowIdx]] });
        }

        // Do the actual splice
        for (let i = 0; i < 4; i++) {
          scene.board.pop();
          scene.board.unshift(Array(scene.boardWidth).fill(0));
        }

        // Left-to-right fade on rows with blocks
        for (const saved of bottomRows) {
          const hasBlocks = saved.cells.some(c => c !== 0);
          if (!hasBlocks) continue;
          for (let c = 0; c < scene.boardWidth; c++) {
            const cellColor = saved.cells[c];
            if (!cellColor) continue;
            const cx = scene.boardX + c * scene.tileSize + scene.tileSize / 2;
            const cy = scene.boardY + saved.rowIndex * scene.tileSize + scene.tileSize / 2;
            const overlay = scene.add.rectangle(cx, cy, scene.tileSize, scene.tileSize, 0xffffff, 0.9).setDepth(6);
            scene.tweens.add({
              targets: overlay,
              alpha: 0,
              scaleX: 0.5,
              scaleY: 0.5,
              duration: 200,
              delay: c * 30,
              ease: 'Cubic.easeOut',
              onComplete: () => overlay.destroy()
            });
          }
        }
        scene.score += 500;
        scene.scoreText.setText('SCORE:\n' + scene.score);
        playSound('clear');
        scene.cameras.main.shake(150, 0.025);

        for (let i = 0; i < 20; i++) {
          const px = 70 + Math.random() * 20;
          const py = 200 + Math.random() * 150;
          const p = scene.add.rectangle(px, py, 6, 6, 0xffff00);
          scene.tweens.add({
            targets: p,
            x: px + (Math.random() - 0.5) * 80,
            y: py + (Math.random() - 0.5) * 80,
            alpha: 0,
            scale: 0.2,
            duration: 500,
            onComplete: () => p.destroy()
          });
        }

      } else if (scene.energy >= 66.66 && scene.energy < 100 && scene.slowMoTimer <= 0) {
        addEnergy(scene, -66.66);
        scene.slowMoTimer = 3000;
        scene.noComboGain = true;
        playSound('move');
      } else if (scene.energy >= 33.33 && scene.energy < 66.66) {
        addEnergy(scene, -33.33);
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
          if (scene.isLocking && scene.lockResets < 15) {
            scene.lockTimer = 0;
            scene.lockResets++;
          }
          playSound('move');
        }
        scene.moveCooldown = time + 120;
      }
      if (scene.controls.held['P1_R']) {
        if (!checkCollision(scene, scene.currentPiece, 1, 0)) {
          scene.currentPiece.x++;
          if (scene.isLocking && scene.lockResets < 15) {
            scene.lockTimer = 0;
            scene.lockResets++;
          }
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
        scene.isLocking = false;
        scene.lockTimer = 0;
      }
    }

    // Lock Delay logic
    const canDrop = !checkCollision(scene, scene.currentPiece, 0, 1);
    if (!canDrop && !scene.isLocking) {
      scene.isLocking = true;
      scene.lockTimer = 0;
    } else if (canDrop) {
      scene.isLocking = false;
      scene.lockTimer = 0;
    }

    if (scene.isLocking) {
      scene.lockTimer += delta;
      if (scene.lockTimer >= 500 || scene.lockResets >= 15) {
        mergePiece(scene);
        clearLines(scene);
        spawnPiece(scene);
        scene.isLocking = false;
        scene.lockTimer = 0;
        scene.lockResets = 0;
      }
    }

    scene.controls.pressed = {};
  }

  scene.graphics.clear();
  
  // Outer background pattern (diagonal lines)
  scene.graphics.fillStyle(0x0a0a18, 1);
  scene.graphics.fillRect(0, 0, 800, 600);
  scene.graphics.lineStyle(1, 0x15152e, 0.5);
  for (let i = -600; i < 800; i += 40) {
    scene.graphics.lineBetween(i, 0, i + 600, 600);
  }

  // Board background
  scene.graphics.fillStyle(0x050510, 1);
  scene.graphics.fillRect(scene.boardX, scene.boardY, scene.boardWidth * scene.tileSize, scene.boardHeight * scene.tileSize);

  // Unified frame: board + time bar
  const boardW = scene.boardWidth * scene.tileSize;
  const boardH = scene.boardHeight * scene.tileSize;
  const timeBarW = 14;
  const timeBarGap = 4;
  const frameLeft = scene.boardX - 4;
  const frameTop = scene.boardY - 4;
  const frameRight = scene.boardX + boardW + timeBarGap + timeBarW + 4;
  const frameBottom = scene.boardY + boardH + 4;

  // Outer cyan glow
  scene.graphics.lineStyle(3, 0x00ffff, 0.9);
  scene.graphics.strokeRect(frameLeft - 2, frameTop - 2, (frameRight - frameLeft) + 4, (frameBottom - frameTop) + 4);

  // Inner subtle glow
  scene.graphics.lineStyle(1, 0x00ffff, 0.4);
  scene.graphics.strokeRect(frameLeft - 6, frameTop - 6, (frameRight - frameLeft) + 12, (frameBottom - frameTop) + 12);

  // Vertical separator between board and time bar (cyan)
  const separatorX = scene.boardX + boardW + 2;
  scene.graphics.lineStyle(2, 0x00ffff, 0.7);
  scene.graphics.lineBetween(separatorX, frameTop, separatorX, frameBottom);

  // Subtle grid lines (each cell border)
  scene.graphics.lineStyle(1, 0x1a1a3e, 0.7);
  for (let c = 0; c <= scene.boardWidth; c++) {
    const x = scene.boardX + c * scene.tileSize;
    scene.graphics.lineBetween(x, scene.boardY, x, scene.boardY + scene.boardHeight * scene.tileSize);
  }
  for (let r = 0; r <= scene.boardHeight; r++) {
    const y = scene.boardY + r * scene.tileSize;
    scene.graphics.lineBetween(scene.boardX, y, scene.boardX + scene.boardWidth * scene.tileSize, y);
  }

  // Dot markers at cell corners
  scene.graphics.fillStyle(0x2a2a5e, 0.8);
  for (let c = 0; c <= scene.boardWidth; c++) {
    for (let r = 0; r <= scene.boardHeight; r++) {
      scene.graphics.fillCircle(scene.boardX + c * scene.tileSize, scene.boardY + r * scene.tileSize, 1.5);
    }
  }
  
  for (let r = 0; r < scene.boardHeight; r++) {
    for (let c = 0; c < scene.boardWidth; c++) {
      if (scene.board[r][c] && !scene.gameOver) {
        drawTile(scene.graphics, scene.boardX + c * scene.tileSize, scene.boardY + r * scene.tileSize, scene.tileSize, scene.board[r][c]);
      }
    }
  }

  if (scene.currentPiece && !scene.gameOver) {
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

  // Ammo Cartridge (right side)
  const rackX = 680;
  const rackY = 200;
  const rackW = 110;
  const slotH = 70;
  const rackH = slotH * 4;

  if (!scene.rackLabel) {
    scene.rackLabel = scene.add.text(rackX + rackW / 2, rackY + 14, 'NEXT', {
      fontSize: '11px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10);
  }

  scene.rackGraphics.clear();

  // Frame (4 sides solid)
  scene.rackGraphics.lineStyle(2, 0x00ffff, 0.8);
  scene.rackGraphics.strokeRect(rackX, rackY, rackW, rackH);

  // Inner background
  scene.rackGraphics.fillStyle(0x0a0a15, 1);
  scene.rackGraphics.fillRect(rackX + 2, rackY + 2, rackW - 4, rackH - 4);

  // Highlighted background for the top slot
  scene.rackGraphics.fillStyle(0x1a2a3e, 1);
  scene.rackGraphics.fillRect(rackX + 4, rackY + 4, rackW - 8, slotH - 8);

  // Yellow border for the next-up slot
  scene.rackGraphics.lineStyle(2, 0xffff00, 0.9);
  scene.rackGraphics.strokeRect(rackX + 4, rackY + 4, rackW - 8, slotH - 8);

  // Separator lines between slots
  scene.rackGraphics.lineStyle(1, 0x1a1a3e, 0.6);
  for (let i = 1; i < 4; i++) {
    scene.rackGraphics.lineBetween(rackX + 8, rackY + i * slotH, rackX + rackW - 8, rackY + i * slotH);
  }

  // Draw each piece (will be clipped by the mask)
  for (let i = 0; i < scene.nextPieces.length; i++) {
    const piece = scene.nextPieces[i];
    if (!piece) continue;
    const visualOffset = scene.ammoShiftAnim * slotH;
    const slotCenterY = rackY + i * slotH + slotH / 2 + visualOffset;
    
    const pieceW = piece.shape[0].length * 14;
    const pieceH = piece.shape.length * 14;
    const offsetX = rackX + rackW / 2 - pieceW / 2;
    const offsetY = slotCenterY - pieceH / 2;
    
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          drawTile(scene.rackGraphics, offsetX + c * 14, offsetY + r * 14, 14, piece.color, 1.0);
        }
      }
    }
  }

  // Re-draw frame on top so pieces don't overflow the frame visually
  scene.rackGraphics.lineStyle(2, 0x00ffff, 0.8);
  scene.rackGraphics.strokeRect(rackX, rackY, rackW, rackH);

  // TIME BAR (right side, adjacent to board)
  const timeBarX = scene.boardX + boardW + timeBarGap + 2;
  const timeBarY = scene.boardY;
  const timeBarW_val = 14;
  const timeBarH = boardH;

  // Background of time bar
  scene.graphics.fillStyle(0x0a0a15, 1);
  scene.graphics.fillRect(timeBarX, timeBarY, timeBarW_val, timeBarH);

  // Fill (drains from top to bottom based on timeLeft)
  const timeRatio = Math.max(0, Math.min(1, scene.timeLeft / 60));
  const fillHeight = timeBarH * timeRatio;

  let timeColor;
  if (timeRatio > 0.6) {
    const t = (1 - timeRatio) / 0.4;
    const c1 = Phaser.Display.Color.ValueToColor(0x00ffff);
    const c2 = Phaser.Display.Color.ValueToColor(0xffff00);
    const interp = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 100, t * 100);
    timeColor = Phaser.Display.Color.GetColor(interp.r, interp.g, interp.b);
  } else if (timeRatio > 0.3) {
    const t = (0.6 - timeRatio) / 0.3;
    const c1 = Phaser.Display.Color.ValueToColor(0xffff00);
    const c2 = Phaser.Display.Color.ValueToColor(0xffaa00);
    const interp = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 100, t * 100);
    timeColor = Phaser.Display.Color.GetColor(interp.r, interp.g, interp.b);
  } else {
    const t = (0.3 - timeRatio) / 0.3;
    const c1 = Phaser.Display.Color.ValueToColor(0xffaa00);
    const c2 = Phaser.Display.Color.ValueToColor(0xff0000);
    const interp = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 100, t * 100);
    timeColor = Phaser.Display.Color.GetColor(interp.r, interp.g, interp.b);
  }

  // Fill from bottom (drains toward bottom, anchored at bottom)
  const fillY = timeBarY + (timeBarH - fillHeight);
  scene.graphics.fillStyle(timeColor, 1);
  scene.graphics.fillRect(timeBarX, fillY, timeBarW_val, fillHeight);

  // Inner glow line at the top of the fill (the "falling sand" edge)
  if (fillHeight > 2) {
    scene.graphics.fillStyle(0xffffff, 0.6);
    scene.graphics.fillRect(timeBarX, fillY, timeBarW_val, 2);
  }

  // Draw Energy Bar
  const barX = 70;
  const barY = 200;
  const barW = 20;
  const barH = 150;
  scene.graphics.fillStyle(0x222244, 1);
  scene.graphics.fillRect(barX, barY, barW, barH);
  
  let fillH = (scene.energy / 100) * barH;
  let barColor = scene.energy >= 66.66 ? 0x00ffff : 0xffaa00;
  if (scene.energy >= 100) {
    if (Math.floor(time / 200) % 2 === 0) {
      barColor = 0xffff00;
    } else {
      barColor = 0x00ff00;
    }
  }

  if (scene.glassCracked) {
    const c1 = Phaser.Display.Color.ValueToColor(barColor);
    const c2 = new Phaser.Display.Color(51, 51, 51);
    const interpolated = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 100, Math.min(100, scene.glassColorProgress * 100));
    barColor = Phaser.Display.Color.GetColor(interpolated.r, interpolated.g, interpolated.b);
  }

  scene.graphics.fillStyle(barColor, 1);
  scene.graphics.fillRect(barX, barY + (barH - fillH), barW, fillH);

  // Neon flash for newly added energy
  if (scene.energyGainTimer > 0 && scene.energyGainAmount > 0 && !scene.glassCracked) {
    const gainH = (scene.energyGainAmount / 100) * barH;
    const topOfNewBlock = barY + barH - (scene.energy / 100) * barH;
    scene.graphics.fillStyle(0xffffff, 1);
    scene.graphics.fillRect(barX, topOfNewBlock, barW, gainH);
  }

  if (scene.glassBreakTimer > 0) {
    scene.graphics.lineStyle(2, Math.random() > 0.5 ? 0x00ffff : 0xffffff, 1);
    for (const shard of scene.glassShards) {
      const progress = 1 - (scene.glassBreakTimer / 400);
      const curX = shard.x + shard.dx * progress;
      const curY = shard.y + shard.dy * progress;
      scene.graphics.lineBetween(curX, curY, curX + shard.dx * 0.5, curY + shard.dy * 0.5);
    }
  }

  if (scene.glassCracked && scene.glassCrackReady && scene.crackPaths) {
    for (const path of scene.crackPaths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (i < 3) {
          scene.graphics.lineStyle(2, 0xffffff, 0.9);
        } else {
          scene.graphics.lineStyle(1, 0xffffff, 0.8);
        }
        scene.graphics.lineBetween(
          path[i].x, path[i].y,
          path[i+1].x, path[i+1].y
        );
      }
    }
  }

  if (scene.glassAlpha > 0) {
    scene.graphics.lineStyle(2, 0xffffff, scene.glassAlpha);
    scene.graphics.strokeRect(barX, barY, barW, barH);
  }
}

function drawTile(g, x, y, size, color, alpha = 1.0) {
  const padding = 1;
  const innerSize = size - padding * 2;
  const innerX = x + padding;
  const innerY = y + padding;
  
  // Base darkening for shadow
  const baseColor = Phaser.Display.Color.ValueToColor(color);
  const shadowColor = Phaser.Display.Color.GetColor(
    Math.floor(baseColor.r * 0.45),
    Math.floor(baseColor.g * 0.45),
    Math.floor(baseColor.b * 0.45)
  );
  const highlightColor = Phaser.Display.Color.GetColor(
    Math.min(255, Math.floor(baseColor.r * 1.4)),
    Math.min(255, Math.floor(baseColor.g * 1.4)),
    Math.min(255, Math.floor(baseColor.b * 1.4))
  );
  
  // Main body
  g.fillStyle(color, alpha);
  g.fillRect(innerX, innerY, innerSize, innerSize);
  
  // Top highlight strip
  g.fillStyle(highlightColor, alpha);
  g.fillRect(innerX, innerY, innerSize, 3);
  g.fillRect(innerX, innerY, 3, innerSize);
  
  // Bottom shadow strip
  g.fillStyle(shadowColor, alpha);
  g.fillRect(innerX, innerY + innerSize - 3, innerSize, 3);
  g.fillRect(innerX + innerSize - 3, innerY, 3, innerSize);
  
  // Inner border (subtle)
  g.lineStyle(1, shadowColor, alpha * 0.6);
  g.strokeRect(innerX, innerY, innerSize, innerSize);
}
