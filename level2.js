const Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Runner = Matter.Runner,
    Events = Matter.Events;

let engine, world;
let blocks = [];
let floor, foundation;

// Config
const BLOCK_SIZE = 60;

// Magnet Settings
const MAGNET_RANGE_X = 30;
const MAGNET_RANGE_Y = 100;
const MAGNET_FORCE = 0.0005;
const STABILIZER_FORCE = 0.01;

let currentBlock = null;
let isGameOver = false;
let score = 0;
let camY = 0;
let groundY;

// Ambil score dari cookie untuk start blockCounter dan score
function getCookie(name) {
    let match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return parseInt(match[2]);
    return 0;
}

// --- VARIABEL BARU UNTUK ANGKA ---
let blockCounter = getCookie('score') || 1;
score = getCookie('score') || 0;

let bg;
let blockImg;
let clawImg;
let floorImg; // Variabel baru untuk gambar tanah

function preload() {
    bg = loadImage('assets/giphy.gif');
    blockImg = loadImage('assets/blokgiphy.png');
    clawImg = loadImage('assets/claw.png');
    
    // LOAD GAMBAR TANAH BARU
    floorImg = loadImage('https://i.ibb.co.com/Y7bLrdSw/tanahgiphy.png');
}

function setup() {
    createCanvas(windowHeight * 0.56, windowHeight);
    groundY = height - 100;

    engine = Engine.create();
    world = engine.world;
    engine.world.gravity.y = 1.2;

    // Tanah
    floor = Bodies.rectangle(width / 2, groundY + 100, width * 2, 200, { isStatic: true, label: 'floor' });
    World.add(world, floor);

    // Pondasi
    foundation = Bodies.rectangle(width / 2, groundY, 80, 40, {
        isStatic: true,
        label: 'foundation',
        friction: 1.0, restitution: 0.0
    });
    World.add(world, foundation);

    // --- UPDATE COLLISION LOGIC (PERBAIKAN UTAMA) ---
    Events.on(engine, 'collisionStart', (e) => {
        e.pairs.forEach(pair => {
            let bodyA = pair.bodyA;
            let bodyB = pair.bodyB;

            // Cek Game Over
            if ((bodyA.label === 'floor' && bodyB.label === 'block') ||
                (bodyB.label === 'floor' && bodyA.label === 'block')) {
                gameOver();
            }

            // PERBAIKAN: Tandai blok sudah mendarat agar kamera mau mengikuti
            if (bodyA.label === 'block') bodyA.hasLanded = true;
            if (bodyB.label === 'block') bodyB.hasLanded = true;
        });
    });

    Runner.run(engine);
    spawnNextBlock();
}

function draw() {
    image(bg, 0, 0, width, height);

    if (!isGameOver) {
        updateCrane();
        applySmoothMagnet();
    }

    // ==========================================
    // PERBAIKAN LOGIC KAMERA (ANTI JEGLEK)
    // ==========================================
    let targetY = 0;
    let highestLandedBlock = null;

    // Cari blok paling atas yang SUDAH pernah mendarat (hasLanded == true)
    // Loop dari belakang agar dapat yang paling tinggi (terbaru mendarat)
    for (let i = blocks.length - 1; i >= 0; i--) {
        if (blocks[i].hasLanded) {
            highestLandedBlock = blocks[i];
            break;
        }
    }

    // Hanya gerakkan kamera jika ada blok yg sudah mendarat melebihi tengah layar
    if (highestLandedBlock && highestLandedBlock.position.y < height / 2) {
        targetY = -(highestLandedBlock.position.y - height / 2) - 80;
    }

    camY = lerp(camY, targetY, 0.05);
    // ==========================================

    push();
    translate(0, camY);

    // --- VISUAL TANAH (UPDATED) ---
    rectMode(CENTER);
    imageMode(CENTER);
    
    if (floorImg) {
        // Menggunakan gambar tanah yang baru
        image(floorImg, width / 2, groundY + 100, width, 200);
    } else {
        // Fallback jika gambar gagal load
        noStroke(); fill(40);
        rect(width / 2, groundY + 100, width, 200);
    }

    // --- VISUAL PONDASI (UPDATED) ---
    fill('#163e65'); // Warna solid sesuai request
    noStroke();      // Hilangkan outline agar full solid
    rect(foundation.position.x, foundation.position.y, 80, 40);
    
    drawMagnetGlow(foundation.position.x, foundation.position.y - 20, 80);

    // Blocks
    for (let b of blocks) drawBlock(b);

    // Crane
    if (currentBlock) drawCrane();

    pop();
    drawUI();
}

// ==========================================
// LOGIKA MAGNET "SOFT DOCKING"
// ==========================================
function applySmoothMagnet() {
    if (blocks.length === 0) return;

    for (let i = 0; i < blocks.length; i++) {
        let fallingBlock = blocks[i];
        let baseBlock = (i === 0) ? foundation : blocks[i - 1];

        let dx = fallingBlock.position.x - baseBlock.position.x;
        let dy = fallingBlock.position.y - baseBlock.position.y;

        if (Math.abs(dx) < MAGNET_RANGE_X && dy < 0 && Math.abs(dy) < MAGNET_RANGE_Y) {
            stroke(0, 255, 255, 60);
            strokeWeight(1);
            line(fallingBlock.position.x, fallingBlock.position.y, baseBlock.position.x, baseBlock.position.y);

            let forceX = -dx * MAGNET_FORCE;
            Body.applyForce(fallingBlock, fallingBlock.position, { x: forceX, y: 0 });

            let angleCorrection = -fallingBlock.angle * STABILIZER_FORCE;
            fallingBlock.torque = angleCorrection;

            fallingBlock.frictionAir = 0.1;
            fallingBlock.isBeingPulled = true;
        } else {
            fallingBlock.frictionAir = 0.01;
            fallingBlock.isBeingPulled = false;
        }
    }
}

// ==========================================
// VISUALS
// ==========================================

function drawMagnetGlow(x, y, w) {
    noStroke();
    fill(0, 255, 255, 20);
    rect(x, y, w, 5, 2);
}

function drawBlock(b) {
    let pos = b.position;
    push();
    translate(pos.x, pos.y);
    rotate(b.angle);
    imageMode(CENTER);
    image(blockImg, 0, 0, BLOCK_SIZE, BLOCK_SIZE);

    // --- GAMBAR ANGKA DI BLOK ---
    fill(255);
    noStroke();
    textSize(24);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(b.gameNumber, 0, 0);
    // ---------------------------

    if (b.speed < 0.2) {
        drawMagnetGlow(0, -BLOCK_SIZE / 2, BLOCK_SIZE);
    }

    if (b.isBeingPulled) {
        stroke(0, 255, 255, 150);
        strokeWeight(2);
        noFill();
        rect(0, 0, BLOCK_SIZE, BLOCK_SIZE, 3);
    }

    pop();
}

// ==========================================
// GAME LOGIC STANDARD
// ==========================================

function spawnNextBlock() {
    if (isGameOver) return;
    currentBlock = {
        x: width / 2,
        y: -camY + 80,
        angle: 0,
        swingSpeed: 0.03 + (score * 0.0005),
        color: color(random(80, 180), random(120, 200), random(180, 240)),
        number: blockCounter // Simpan nomor saat spawn
    };
}

function updateCrane() {
    if (!currentBlock) return;
    currentBlock.angle += currentBlock.swingSpeed;
    currentBlock.x = (width / 2) + Math.sin(currentBlock.angle) * (width / 2 - 60);
    currentBlock.y = -camY + 80;
}

function mousePressed() {
    if (showNextLevelModal) {
        // Deteksi area tombol
        let btnX = width / 2, btnY = height / 2 + 50;
        if (mouseX > btnX - 60 && mouseX < btnX + 60 && mouseY > btnY - 19 && mouseY < btnY + 19) {
            window.location.href = "level3.html";
        }
        return;
    }
    if (isGameOver) resetGame();
    else if (currentBlock) dropBlock();
}

function dropBlock() {
    let b = Bodies.rectangle(currentBlock.x, currentBlock.y, BLOCK_SIZE, BLOCK_SIZE, {
        restitution: 0.0,
        friction: 0.5,
        frictionAir: 0.01,
        density: 0.005,
        label: 'block'
    });
    b.renderColor = currentBlock.color;
    b.isBeingPulled = false;

    // PERBAIKAN: Set hasLanded false dulu, biar kamera gak ngejar blok jatuh
    b.hasLanded = false;

    // Assign nomor ke body fisik
    b.gameNumber = currentBlock.number;

    let swingForce = Math.cos(currentBlock.angle) * 1.5;
    Body.setVelocity(b, { x: swingForce, y: 0 });

    World.add(world, b);
    blocks.push(b);

    // Naikkan counter untuk blok berikutnya
    blockCounter++;

    // Scoring
    let target = (blocks.length > 1) ? blocks[blocks.length - 2] : foundation;
    if (Math.abs(currentBlock.x - target.position.x) < 20) score += 2; else score += 1;

    currentBlock = null;
    setTimeout(spawnNextBlock, 800);
}

function drawCrane() {
    stroke(150); strokeWeight(1);
    line(width / 2, -camY, currentBlock.x, currentBlock.y - BLOCK_SIZE / 2);

    // Gambar claw di antara tali dan block
    imageMode(CENTER);
    image(clawImg, currentBlock.x, currentBlock.y - BLOCK_SIZE / 2, BLOCK_SIZE, BLOCK_SIZE / 2);

    image(blockImg, currentBlock.x, currentBlock.y, BLOCK_SIZE, BLOCK_SIZE);

    // --- GAMBAR ANGKA DI CRANE ---
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    textStyle(BOLD);
    text(currentBlock.number, currentBlock.x, currentBlock.y);
    // -----------------------------
}

// Tambahkan variabel untuk modal
let showNextLevelModal = false;

function drawUI() {
    fill(255); noStroke(); textSize(24); textAlign(LEFT, TOP);
    text("Score: " + score, 20, 20);

    // Cek jika score mencapai 16, tampilkan modal lanjut ke level 3
    if (score >= 16 && !showNextLevelModal) {
        showNextLevelModal = true;
        document.cookie = `score=${score}; path=/; expires=${new Date(Date.now() + 86400000).toUTCString()}`;
    }

    if (showNextLevelModal) {
        fill(0, 0, 0, 220);
        rectMode(CENTER);
        rect(width / 2, height / 2, 340, 180, 16);
        fill(255); textAlign(CENTER, CENTER);
        textSize(28); text("Level Complete!", width / 2, height / 2 - 35);
        textSize(18); text("Lanjut ke Level 3?", width / 2, height / 2 + 5);
        // Tombol lanjut
        fill(0, 200, 0); stroke(0); rect(width / 2, height / 2 + 50, 120, 38, 8);
        fill(255); noStroke(); textSize(18);
        text("Lanjut", width / 2, height / 2 + 50);
    }

    if (isGameOver && !showNextLevelModal) {
        fill(0, 0, 0, 200);
        rectMode(CORNER);
        rect(0, 0, width, height);
        fill(255); textAlign(CENTER, CENTER);
        textSize(32); text("GAME OVER", width / 2, height / 2);
        textSize(16); text("Tap to Restart", width / 2, height / 2 + 40);
    }
}

function gameOver() { isGameOver = true; }

function resetGame() {
    blocks.forEach(b => World.remove(world, b));
    blocks = [];
    score = 0;
    blockCounter = 1; // Reset counter ke 1
    isGameOver = false;
    camY = 0;
    spawnNextBlock();
}

function windowResized() {
    resizeCanvas(windowHeight * 0.56, windowHeight);
    groundY = height - 100;
    Body.setPosition(foundation, { x: width / 2, y: groundY });
    Body.setPosition(floor, { x: width / 2, y: groundY + 100 });
}