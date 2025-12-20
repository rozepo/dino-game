// Получаем элементы
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameOverlay = document.getElementById('gameOverlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('finalScore');

// Игровые переменные
let gameRunning = false;
let score = 0;
let gameSpeed = 5;
let gravity = 0.6;

// Динозавр
const dino = {
    x: 50,
    y: 0,
    width: 40,
    height: 50,
    velocityY: 0,
    jumping: false,
    groundY: 0,
    
    draw() {
        ctx.fillStyle = '#333';
        // Тело динозавра
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Голова
        ctx.fillRect(this.x + 30, this.y - 10, 15, 15);
        // Глаз
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x + 35, this.y - 8, 5, 5);
        // Ноги
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x + 5, this.y + this.height, 8, 10);
        ctx.fillRect(this.x + 25, this.y + this.height, 8, 10);
    },
    
    update() {
        // Применяем гравитацию
        this.velocityY += gravity;
        this.y += this.velocityY;
        
        // Проверка земли
        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.velocityY = 0;
            this.jumping = false;
        }
    },
    
    jump() {
        if (!this.jumping) {
            this.velocityY = -15;
            this.jumping = true;
        }
    },
    
    reset() {
        this.y = this.groundY;
        this.velocityY = 0;
        this.jumping = false;
    }
};

// Кактусы
const cacti = [];
const cactusSpawnRate = 0.01;

class Cactus {
    constructor() {
        this.x = canvas.width;
        this.width = 30;
        this.height = 50 + Math.random() * 20;
        this.y = dino.groundY + dino.height - this.height;
    }
    
    draw() {
        ctx.fillStyle = '#2ecc71';
        // Основной ствол
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Ветки
        ctx.fillRect(this.x - 5, this.y + 10, 10, 8);
        ctx.fillRect(this.x + this.width - 5, this.y + 20, 10, 8);
    }
    
    update() {
        this.x -= gameSpeed;
    }
    
    isOffScreen() {
        return this.x + this.width < 0;
    }
    
    collidesWith(dino) {
        return dino.x < this.x + this.width &&
               dino.x + dino.width > this.x &&
               dino.y < this.y + this.height &&
               dino.y + dino.height > this.y;
    }
}

// Инициализация
function init() {
    dino.groundY = canvas.height - dino.height - 20;
    dino.y = dino.groundY;
    cacti.length = 0;
    score = 0;
    gameSpeed = 5;
    updateScore();
}

// Обновление игры
function update() {
    if (!gameRunning) return;
    
    // Очистка canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем землю
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
    
    // Обновляем динозавра
    dino.update();
    dino.draw();
    
    // Спавн кактусов
    if (Math.random() < cactusSpawnRate) {
        cacti.push(new Cactus());
    }
    
    // Обновляем и рисуем кактусы
    for (let i = cacti.length - 1; i >= 0; i--) {
        const cactus = cacti[i];
        cactus.update();
        cactus.draw();
        
        // Проверка столкновения
        if (cactus.collidesWith(dino)) {
            gameOver();
            return;
        }
        
        // Удаляем кактусы за экраном
        if (cactus.isOffScreen()) {
            cacti.splice(i, 1);
            score += 10;
            updateScore();
            // Увеличиваем скорость каждые 100 очков
            if (score % 100 === 0 && gameSpeed < 12) {
                gameSpeed += 0.5;
            }
        }
    }
    
    requestAnimationFrame(update);
}

// Обновление счета
function updateScore() {
    scoreElement.textContent = score;
}

// Начало игры
function startGame() {
    init();
    gameRunning = true;
    gameOverlay.classList.add('hidden');
    update();
}

// Конец игры
function gameOver() {
    gameRunning = false;
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
    gameOverlay.classList.remove('hidden');
}

// Перезапуск
function restartGame() {
    gameOverScreen.classList.add('hidden');
    startGame();
}

// Управление
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (gameRunning) {
            dino.jump();
        } else if (gameOverlay.classList.contains('hidden')) {
            startGame();
        }
    }
});

// Кнопки
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

// Инициализация при загрузке
init();

