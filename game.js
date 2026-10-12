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
  P1_U: ['w', 'ArrowUp'],
  P1_D: ['s', 'ArrowDown'],
  P1_L: ['a', 'ArrowLeft'],
  P1_R: ['d', 'ArrowRight'],
  P1_1: ['u', 'z'],
  START1: ['Enter']
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[key.toLowerCase()] = arcadeCode;
  }
}

new Phaser.Game(config);

function preload() {}

function create() {
  const scene = this;
  
  scene.controls = { held: {}, pressed: {} };
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
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

  spawnPiece(scene);

  scene.graphics = scene.add.graphics();

  scene.add.text(400, 25, 'TETRIS', { fontSize: '28px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
  scene.scoreText = scene.add.text(70, 100, 'SCORE:\n0', { fontSize: '18px', fill: '#fff', align: 'center' }).setOrigin(0.5);
}

function spawnPiece(scene) {
  const idx = Math.floor(Math.random() * scene.shapes.length);
  scene.currentPiece = {
    shape: scene.shapes[idx],
    color: scene.colors[idx],
    x: Math.floor(scene.boardWidth / 2) - Math.floor(scene.shapes[idx][0].length / 2),
    y: 0
  };

  if (checkCollision(scene, scene.currentPiece, 0, 0)) {
    scene.gameOver = true;
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
    scene.score += cleared * 100;
    scene.scoreText.setText('SCORE:\n' + scene.score);
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
  }
}

function update(time, delta) {
  const scene = this;
  if (scene.gameOver) return;

  if (time > scene.moveCooldown) {
    if (scene.controls.held['P1_L']) {
      if (!checkCollision(scene, scene.currentPiece, -1, 0)) scene.currentPiece.x--;
      scene.moveCooldown = time + 120;
    }
    if (scene.controls.held['P1_R']) {
      if (!checkCollision(scene, scene.currentPiece, 1, 0)) scene.currentPiece.x++;
      scene.moveCooldown = time + 120;
    }
  }

  if (scene.controls.pressed['P1_U'] || scene.controls.pressed['P1_1']) {
    rotatePiece(scene);
    scene.controls.pressed['P1_U'] = false;
    scene.controls.pressed['P1_1'] = false;
  }

  let dropSpeed = scene.dropInterval;
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
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c]) {
          drawTile(scene.graphics, scene.boardX + (p.x + c) * scene.tileSize, scene.boardY + (p.y + r) * scene.tileSize, scene.tileSize, p.color);
        }
      }
    }
  }
}

function drawTile(g, x, y, size, color) {
  g.fillStyle(color, 1);
  g.fillRect(x + 1, y + 1, size - 2, size - 2);
}
