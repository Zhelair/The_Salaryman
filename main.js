// === BASIC GAME SETUP ===
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// --- IMAGES TO LOAD ---
const imageSources = {
  background: "assets/backgrounds/level1.png",
  playerIdle: "assets/player/idle.png",
  coffee: "assets/items/coffee.png",
  ground: "assets/tiles/ground.png",
};

const images = {};

function loadImage(key, src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images[key] = img;
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function loadAssets() {
  const promises = Object.entries(imageSources).map(([key, src]) =>
    loadImage(key, src)
  );
  await Promise.all(promises);
}

// === INPUT HANDLING ===
const keys = {
  left: false,
  right: false,
  jump: false,
};

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW")
    keys.jump = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW")
    keys.jump = false;
});

// === GAME OBJECTS ===
const gravity = 2000; // pixels per second^2
const groundHeight = 80; // height of solid ground area from bottom

const player = {
  x: WIDTH / 2 - 32,
  y: HEIGHT - groundHeight - 96,
  width: 64,
  height: 96,
  vx: 0,
  vy: 0,
  speed: 350, // horizontal speed
  jumpForce: -750,
  onGround: true,
};

const coffee = {
  x: WIDTH * 0.75,
  y: HEIGHT - groundHeight - 48,
  width: 32,
  height: 48,
  collected: false,
};

// === GAME LOOP ===
let lastTime = 0;

function update(dt) {
  // Horizontal movement
  player.vx = 0;
  if (keys.left) {
    player.vx = -player.speed;
  }
  if (keys.right) {
    player.vx = player.speed;
  }

  // Jumping
  if (keys.jump && player.onGround) {
    player.vy = player.jumpForce;
    player.onGround = false;
  }

  // Apply gravity
  player.vy += gravity * dt;

  // Apply velocities
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Ground collision
  const floorY = HEIGHT - groundHeight - player.height;
  if (player.y > floorY) {
    player.y = floorY;
    player.vy = 0;
    player.onGround = true;
  }

  // Keep player inside screen horizontally
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > WIDTH) player.x = WIDTH - player.width;

  // Coffee collision
  if (!coffee.collected && rectsOverlap(player, coffee)) {
    coffee.collected = true;
  }
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

function drawBackground() {
  const bg = images.background;
  if (!bg) return;

  // Stretch background to canvas size
  ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
}

function drawGround() {
  const groundImg = images.ground;
  if (!groundImg) return;

  const tileWidth = groundImg.width;
  const tileHeight = groundImg.height;

  const y = HEIGHT - groundHeight;

  // Tile ground images across the width
  for (let x = 0; x < WIDTH; x += tileWidth) {
    ctx.drawImage(groundImg, x, y, tileWidth, groundHeight);
  }
}

function drawPlayer() {
  const img = images.playerIdle;
  if (!img) return;

  ctx.drawImage(
    img,
    player.x,
    player.y,
    player.width,
    player.height
  );
}

function drawCoffee() {
  if (coffee.collected) return;
  const img = images.coffee;
  if (!img) return;

  ctx.drawImage(
    img,
    coffee.x,
    coffee.y,
    coffee.width,
    coffee.height
  );
}

function drawUI() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(10, 10, 260, 60);

  ctx.fillStyle = "#00ffcc";
  ctx.font = "16px system-ui";
  ctx.fillText("The Salaryman – Level 1: Morning Commute", 20, 30);

  ctx.fillStyle = "#ffffff";
  const coffeeText = coffee.collected ? "Coffee collected ✅" : "Coffee: not collected";
  ctx.fillText(coffeeText, 20, 50);
}

function draw() {
  drawBackground();
  drawGround();
  drawCoffee();
  drawPlayer();
  drawUI();
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000; // in seconds
  lastTime = timestamp;

  update(dt);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  draw();

  requestAnimationFrame(gameLoop);
}

// === START GAME ===
loadAssets()
  .then(() => {
    console.log("Assets loaded, starting game...");
    requestAnimationFrame(gameLoop);
  })
  .catch((err) => {
    console.error("Error loading assets:", err);
  });
