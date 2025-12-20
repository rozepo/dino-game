// Получаем элементы (после загрузки DOM)
let canvas, ctx, startScreen, gameOverScreen, gameOverlay, startBtn, restartBtn, scoreElement, finalScoreElement;

function initElements() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    startScreen = document.getElementById('startScreen');
    gameOverScreen = document.getElementById('gameOverScreen');
    gameOverlay = document.getElementById('gameOverlay');
    startBtn = document.getElementById('startBtn');
    restartBtn = document.getElementById('restartBtn');
    scoreElement = document.getElementById('score');
    finalScoreElement = document.getElementById('finalScore');
    
    // Проверка, что все элементы найдены
    if (!canvas || !startBtn || !restartBtn) {
        console.error('Не найдены необходимые элементы!');
        return false;
    }
    return true;
}

// Функция для получения масштаба
function getScale() {
    return Math.min(canvas.width / 800, canvas.height / 400, 1.5);
}

// Настройка размера canvas
function resizeCanvas() {
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    // Пересчитываем позиции после изменения размера
    if (dino.groundY > 0) {
        dino.groundY = canvas.height - dino.height * getScale() - 20;
        dino.y = Math.min(dino.y, dino.groundY);
    }
}

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
    jumpsAvailable: 2, // Двойной прыжок
    hasDoubleJumped: false,
    
    draw() {
        const scale = getScale();
        const scaledWidth = this.width * scale;
        const scaledHeight = this.height * scale;
        const scaledX = this.x * scale;
        const scaledY = this.y;
        
        ctx.fillStyle = '#333';
        // Тело динозавра
        ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
        // Голова
        ctx.fillRect(scaledX + scaledWidth * 0.75, scaledY - scaledHeight * 0.2, scaledWidth * 0.375, scaledHeight * 0.3);
        // Рог
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.moveTo(scaledX + scaledWidth * 0.9, scaledY - scaledHeight * 0.2);
        ctx.lineTo(scaledX + scaledWidth * 0.95, scaledY - scaledHeight * 0.4);
        ctx.lineTo(scaledX + scaledWidth * 0.85, scaledY - scaledHeight * 0.35);
        ctx.closePath();
        ctx.fill();
        // Глаз
        ctx.fillStyle = 'white';
        ctx.fillRect(scaledX + scaledWidth * 0.875, scaledY - scaledHeight * 0.16, scaledWidth * 0.125, scaledHeight * 0.1);
        // Ноги
        ctx.fillStyle = '#333';
        ctx.fillRect(scaledX + scaledWidth * 0.125, scaledY + scaledHeight, scaledWidth * 0.2, scaledHeight * 0.2);
        ctx.fillRect(scaledX + scaledWidth * 0.625, scaledY + scaledHeight, scaledWidth * 0.2, scaledHeight * 0.2);
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
            this.jumpsAvailable = 2; // Восстанавливаем двойной прыжок при приземлении
            this.hasDoubleJumped = false;
        } else {
            this.jumping = true;
        }
    },
    
    jump() {
        // Если на земле - первый прыжок
        if (Math.abs(this.y - this.groundY) < 2 && this.jumpsAvailable === 2) {
            this.velocityY = -15;
            this.jumping = true;
            this.jumpsAvailable = 1; // Остался один прыжок
        }
        // Если в воздухе и есть доступный прыжок - двойной прыжок (выше)
        else if (this.y < this.groundY && this.jumpsAvailable === 1 && !this.hasDoubleJumped) {
            this.velocityY = -18; // Выше чем первый прыжок
            this.jumpsAvailable = 0;
            this.hasDoubleJumped = true;
        }
    },
    
    reset() {
        this.y = this.groundY;
        this.velocityY = 0;
        this.jumping = false;
        this.jumpsAvailable = 2;
        this.hasDoubleJumped = false;
    }
};

// Кактусы
const cacti = [];
const cactusSpawnRate = 0.01;

class Cactus {
    constructor() {
        this.x = canvas.width;
        const scale = getScale();
        this.width = 30 * scale;
        this.height = (50 + Math.random() * 20) * scale;
        const dinoScaledHeight = dino.height * scale;
        this.y = dino.groundY + dinoScaledHeight - this.height;
    }
    
    draw() {
        const scale = getScale();
        ctx.fillStyle = '#2ecc71';
        // Основной ствол
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Ветки
        ctx.fillRect(this.x - 5 * scale, this.y + 10 * scale, 10 * scale, 8 * scale);
        ctx.fillRect(this.x + this.width - 5 * scale, this.y + 20 * scale, 10 * scale, 8 * scale);
    }
    
    update() {
        this.x -= gameSpeed;
    }
    
    isOffScreen() {
        return this.x + this.width < 0;
    }
    
    collidesWith(dino) {
        const scale = getScale();
        const dinoScaledWidth = dino.width * scale;
        const dinoScaledHeight = dino.height * scale;
        const dinoX = dino.x * scale;
        
        return dinoX < this.x + this.width &&
               dinoX + dinoScaledWidth > this.x &&
               dino.y < this.y + this.height &&
               dino.y + dinoScaledHeight > this.y;
    }
}

// Инициализация
function init() {
    const scale = getScale();
    dino.groundY = canvas.height - (dino.height * scale) - 20;
    dino.y = dino.groundY;
    dino.reset();
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

// Управление клавиатурой
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

// Управление касанием (для мобильных)
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    if (gameRunning) {
        dino.jump();
    } else if (gameOverlay.classList.contains('hidden')) {
        startGame();
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    // Можно добавить логику для свайпа вверх
});

// Предотвращаем скролл при касании canvas
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// Функция для привязки обработчиков кнопок
function attachButtonHandlers() {
    if (!startBtn || !restartBtn) return;
    
    // Кнопки - обработчики клика
    startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startGame();
    });

    restartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        restartGame();
    });

    // Кнопки - обработчики касания (для мобильных)
    startBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startGame();
    });

    restartBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        restartGame();
    });
}

// Предотвращаем стандартное поведение при свайпе вниз (чтобы не закрывалась страница)
// Но только если не кликаем по кнопкам
document.addEventListener('touchmove', (e) => {
    if (gameRunning && !e.target.closest('button')) {
        e.preventDefault();
    }
}, { passive: false });

// Инициализация при загрузке
window.addEventListener('load', () => {
    if (!initElements()) {
        console.error('Ошибка инициализации элементов');
        return;
    }
    attachButtonHandlers();
    resizeCanvas();
    init();
    
    // Обработчики изменения размера окна
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 100);
    });
});

