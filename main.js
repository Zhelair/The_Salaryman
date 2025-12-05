// === BASIC GAME SETUP ===
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// === WORLD & CAMERA ===
const world = {
  width: 3000, // world is wider than screen
};
let cameraX = 0;

// --- IMAGES TO LOAD ---
const imageSources = {
  background: "assets/backgrounds/level1.png",
  playerIdle: "assets/player/idle.png",
  coffee: "assets/items/coffee.png",
  ground: "assets/tiles/ground.png",
  hrDrone: "assets/enemies/hr_drone.png",
  credit: "assets/items/credit.png",
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
  x: 200,
  y: HEIGHT - groundHeight - 96,
  width: 64,
  height: 96,
  vx: 0,
  vy: 0,
  speed: 350,
  jumpForce: -750,
  onGround: true,
};

const coffee = {
  x: 450,
  y: HEIGHT - groundHeight - 48,
  width: 32,
  height: 48,
  collected: false,
};

const moneyPickups = [
  {
    x: 700,
    y: HEIGHT - groundHeight - 40,
    width: 32,
    height: 32,
    collected: false,
  },
  {
    x: 1200,
    y: HEIGHT - groundHeight - 40,
    width: 32,
    height: 32,
    collected: false,
  },
  {
    x: 1800,
    y: HEIGHT - groundHeight - 40,
    width: 32,
    height: 32,
    collected: false,
  },
];

const hrDrone = {
  x: 1000,
  y: HEIGHT - groundHeight - 160,
  width: 48,
  height: 48,
  vx: 120,
  leftBound: 950,
  rightBound: 1250,
};

let burnout = 0;
const burnoutMax = 100;
let invincibleTimer = 0; // short grace period after hit

let credits = 0;
const rent = 120;

// === MESSAGES (DIALOG POPUPS) ===
const messages = [];

function showMessage(text) {
  messages.push({
    text,
    time: 7, // seconds on screen
  });
}

// === GAME STATE ===
let lastTime = 0;
let gameOver = false;
let gameOverReason = "";

// === UTILS ===
function rectsOverlap(a, b) {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

// === UPDATE FUNCTIONS ===
function updatePlayer(dt) {
  if (gameOver) return;

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

  // Clamp to world bounds
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > world.width)
    player.x = world.width - player.width;

  // Ground collision
  const floorY = HEIGHT - groundHeight - player.height;
  if (player.y > floorY) {
    player.y = floorY;
    player.vy = 0;
    player.onGround = true;
  }
}

function updateCamera() {
  // Camera follows player, but clamped inside world
  cameraX = player.x + player.width / 2 - WIDTH / 2;
  if (cameraX < 0) cameraX = 0;
  if (cameraX > world.width - WIDTH) cameraX = world.width - WIDTH;
}

function updateHRDrone(dt) {
  if (gameOver) return;

  hrDrone.x += hrDrone.vx * dt;

  if (hrDrone.x < hrDrone.leftBound) {
    hrDrone.x = hrDrone.leftBound;
    hrDrone.vx *= -1;
  }
  if (hrDrone.x + hrDrone.width > hrDrone.rightBound) {
    hrDrone.x = hrDrone.rightBound - hrDrone.width;
    hrDrone.vx *= -1;
  }

  // Collision with player
  if (!gameOver && rectsOverlap(player, hrDrone)) {
    if (invincibleTimer <= 0) {
      burnout += 25;
      invincibleTimer = 1.0; // 1 second of grace
      showMessage("HR Drone: unauthorized happiness detected.");
      if (burnout >= burnoutMax) {
        burnout = burnoutMax;
        triggerGameOver("Burnout: you finally quit your job.");
      }
    }
  }
}

function updatePickups(dt) {
  // coffee
  if (!coffee.collected && rectsOverlap(player, coffee)) {
    coffee.collected = true;
    showMessage("Coffee acquired: +5 morale (pure placebo).");
  }

  // money
  for (const m of moneyPickups) {
    if (!m.collected && rectsOverlap(player, m)) {
      m.collected = true;
      credits += 20;
      showMessage(`+20 credits (total: ${credits})`);
    }
  }
}

function updateMessages(dt) {
  for (const msg of messages) {
    msg.time -= dt;
  }
  // Remove expired
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].time <= 0) messages.splice(i, 1);
  }
}

function updateTimers(dt) {
  if (invincibleTimer > 0) invincibleTimer -= dt;
}

function triggerGameOver(reason) {
  gameOver = true;
  gameOverReason = reason;
  showMessage("Game over. Refresh the page to try again.");
}

// === MAIN UPDATE ===
function update(dt) {
  if (!gameOver) {
    updatePlayer(dt);
    updateHRDrone(dt);
    updatePickups(dt);
    updateTimers(dt);
    updateCamera();
  } else {
    // Even when game over, keep camera on player
    updateCamera();
  }
  updateMessages(dt);
}

// === DRAW FUNCTIONS ===
function drawBackground() {
  const bg = images.background;
  if (!bg) return;

  // Parallax scrolling
  const scrollFactor = 0.4;
  const scaledHeight = HEIGHT;
  const scale = scaledHeight / bg.height;
  const scaledWidth = bg.width * scale;

  // We tile the background horizontally
  let bgX = (-cameraX * scrollFactor) % scaledWidth;
  if (bgX > 0) bgX -= scaledWidth;

  for (let x = bgX; x < WIDTH; x += scaledWidth) {
    ctx.drawImage(bg, x, 0, scaledWidth, scaledHeight);
  }
}

function drawGround() {
  const groundImg = images.ground;
  if (!groundImg) return;

  const tileWidth = groundImg.width;
  const y = HEIGHT - groundHeight;

  // Draw only tiles visible in camera
  const startX = Math.floor(cameraX / tileWidth) * tileWidth;
  const endX = cameraX + WIDTH;

  for (let worldX = startX; worldX < endX; worldX += tileWidth) {
    const screenX = worldX - cameraX;
    ctx.drawImage(groundImg, screenX, y, tileWidth, groundHeight);
  }
}

function drawPlayer() {
  const img = images.playerIdle;
  if (!img) return;

  const screenX = player.x - cameraX;
  ctx.drawImage(img, screenX, player.y, player.width, player.height);
}

function drawCoffee() {
  if (coffee.collected) return;
  const img = images.coffee;
  if (!img) return;

  const screenX = coffee.x - cameraX;
  ctx.drawImage(img, screenX, coffee.y, coffee.width, coffee.height);
}

function drawMoney() {
  const img = images.credit;
  if (!img) return;

  for (const m of moneyPickups) {
    if (m.collected) continue;
    const screenX = m.x - cameraX;
    ctx.drawImage(img, screenX, m.y, m.width, m.height);
  }
}

function drawHRDrone() {
  const img = images.hrDrone;
  if (!img) return;

  const screenX = hrDrone.x - cameraX;
  ctx.drawImage(img, screenX, hrDrone.y, hrDrone.width, hrDrone.height);
}

function drawUI() {
  // Top-left: level info + coffee
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(10, 10, 320, 60);

  ctx.fillStyle = "#00ffcc";
  ctx.font = "16px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("The Salaryman – Level 1: Morning Commute", 20, 30);

  ctx.fillStyle = "#ffffff";
  const coffeeText = coffee.collected ? "Coffee collected ✅" : "Coffee: not collected";
  ctx.fillText(coffeeText, 20, 50);

  // Top-right: burnout bar
  const barWidth = 200;
  const barHeight = 12;
  const barX = WIDTH - barWidth - 30;
  const barY = 20;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

  ctx.fillStyle = "#333333";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  const ratio = burnout / burnoutMax;
  ctx.fillStyle = "#ff3366";
  ctx.fillRect(barX, barY, barWidth * ratio, barHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Burnout", barX + barWidth / 2, barY + barHeight - 2);

  // Bottom-left: credits vs rent
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(10, HEIGHT - 40, 260, 30);

  ctx.fillStyle = "#ffe066";
  ctx.font = "14px system-ui";
  ctx.fillText(`Credits: ${credits} / Rent: ${rent}`, 20, HEIGHT - 20);

  // Center-top messages
  ctx.textAlign = "center";
  let msgY = 90;
  for (const msg of messages) {
    const alpha = Math.min(1, msg.time / 2); // gentle fade-in
    ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * alpha})`;
    ctx.fillRect(WIDTH / 2 - 260, msgY - 20, 520, 26);
    ctx.fillStyle = `rgba(255, 238, 136, ${alpha})`;
    ctx.font = "14px system-ui";
    ctx.fillText(msg.text, WIDTH / 2, msgY);
    msgY += 30;
  }
}

function drawGameOverOverlay() {
  if (!gameOver) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff6666";
  ctx.font = "32px system-ui";
  ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 20);

  ctx.fillStyle = "#ffffff";
  ctx.font = "18px system-ui";
  ctx.fillText(gameOverReason, WIDTH / 2, HEIGHT / 2 + 10);
  ctx.fillText("Refresh the page to retry.", WIDTH / 2, HEIGHT / 2 + 40);
}

// === MOBILE / TOUCH CONTROLS ===
function setupMobileControls() {
  const mobileControls = document.getElementById("mobileControls");
  if (!mobileControls) return;

  const isTouch =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  const startEvents = isTouch ? ["touchstart"] : ["mousedown"];
  const endEvents = isTouch
    ? ["touchend", "touchcancel"]
    : ["mouseup", "mouseleave"];

  function setAction(action, pressed) {
    if (action === "left") keys.left = pressed;
    else if (action === "right") keys.right = pressed;
    else if (action === "jump") keys.jump = pressed;
    // later we can add "attack" here
  }

  mobileControls
    .querySelectorAll("button[data-action]")
    .forEach((btn) => {
      const action = btn.dataset.action;

      startEvents.forEach((ev) => {
        btn.addEventListener(ev, (e) => {
          e.preventDefault();
          setAction(action, true);
        });
      });

      endEvents.forEach((ev) => {
        btn.addEventListener(ev, (e) => {
          e.preventDefault();
          setAction(action, false);
        });
      });
    });
}

// === MAIN DRAW ===
function draw() {
  drawBackground();
  drawGround();
  drawCoffee();
  drawMoney();
  drawHRDrone();
  drawPlayer();
  drawUI();
  drawGameOverOverlay();
}

// === GAME LOOP ===
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
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
    setupMobileControls();
    requestAnimationFrame(gameLoop);
    showMessage("Morning commute: try not to burn out before the office.");
  })
  .catch((err) => {
    console.error("Error loading assets:", err);
  });
