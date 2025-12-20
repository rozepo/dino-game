// ===== ИГРОВОЙ МОДУЛЬ =====
const Game = {
    // Инициализация элементов
    canvas: null,
    ctx: null,
    
    // Игровые переменные
    gameRunning: false,
    score: 0,
    coinsEarned: 0,
    gameSpeed: 5,
    gravity: 0.6,
    
    // Игровые объекты
    dino: null,
    cacti: [],
    coins: [],
    mountains: [],
    
    // Спавн-рейты
    cactusSpawnRate: 0.01,
    coinSpawnRate: 0.015,
    mountainSpawnRate: 0.003,
    
    // Счетчики для спавна
    lastCoinSpawn: 0,
    lastMountainSpawn: 0,
    
    // Инициализация
    init() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas не найден!');
            return false;
        }
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        this.initDino();
        return true;
    },
    
    // Инициализация динозавра
    initDino() {
        const maxJumps = Storage.getMaxJumps();
        this.dino = {
            x: 50,
            y: 0,
            width: 40,
            height: 50,
            velocityY: 0,
            jumping: false,
            groundY: 0,
            maxJumps: maxJumps,
            jumpsAvailable: maxJumps,
            jumpsUsed: 0,
            hasMask: Storage.hasMask(),
            inMountainZone: false,
            mountainJumps: 0
        };
        initDinoMethods(this.dino);
    },
    
    // Получить масштаб
    getScale() {
        if (!this.canvas) return 1;
        return Math.min(this.canvas.width / 800, this.canvas.height / 400, 1.5);
    },
    
    // Изменить размер canvas
    resizeCanvas() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;
        
        if (width > 0 && height > 0) {
            this.canvas.width = width;
            this.canvas.height = height;
        } else {
            this.canvas.width = 800;
            this.canvas.height = 400;
        }
        
        if (this.dino) {
            const scale = this.getScale();
            this.dino.groundY = this.canvas.height - (this.dino.height * scale) - 20;
            this.dino.y = this.dino.groundY;
        }
    },
    
    // Начать игру
    start() {
        if (!this.canvas || this.canvas.width === 0 || this.canvas.height === 0) {
            this.resizeCanvas();
        }
        
        // Обновляем maxJumps из магазина
        this.initDino();
        
        // Сброс игры
        this.score = 0;
        this.coinsEarned = 0;
        this.gameSpeed = 5;
        this.cacti = [];
        this.coins = [];
        this.mountains = [];
        this.lastCoinSpawn = 0;
        this.lastMountainSpawn = 0;
        
        // Инициализация динозавра
        const scale = this.getScale();
        this.dino.groundY = this.canvas.height - (this.dino.height * scale) - 20;
        this.dino.y = this.dino.groundY;
        this.dino.velocityY = 0;
        this.dino.jumping = false;
        this.dino.jumpsAvailable = this.dino.maxJumps;
        this.dino.jumpsUsed = 0;
        this.dino.inMountainZone = false;
        this.dino.mountainJumps = 0;
        
        // UI
        UI.hideOverlay();
        UI.showHud();
        UI.updateScore(0);
        UI.updateCoins(Storage.getCoins());
        UI.updateJumpLevel(this.dino.maxJumps);
        
        // Запуск
        this.gameRunning = true;
        this.update();
    },
    
    // Обновление игры
    update() {
        if (!this.gameRunning) return;
        if (!this.canvas || !this.ctx) return;
        
        // Очистка
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем фон (небо и землю)
        this.drawBackground();
        
        // Обновляем динозавра
        if (this.dino && this.dino.update) {
            this.dino.update();
            this.dino.draw();
        }
        
        // Спавн препятствий и монет
        this.spawnObjects();
        
        // Обновляем и рисуем объекты
        this.updateObjects();
        
        // Обновляем UI
        UI.updateScore(this.score);
        
        // Увеличиваем счет
        this.score += 0.1;
        if (Math.floor(this.score) % 100 === 0 && this.gameSpeed < 12) {
            this.gameSpeed += 0.3;
        }
        
        requestAnimationFrame(() => this.update());
    },
    
    // Рисование фона
    drawBackground() {
        // Небо
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.7, '#E0F6FF');
        gradient.addColorStop(1, '#F5F5F5');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Земля
        this.ctx.fillStyle = '#95a5a6';
        this.ctx.fillRect(0, this.canvas.height - 20, this.canvas.width, 20);
        
        // Трава
        this.ctx.fillStyle = '#7CB342';
        this.ctx.fillRect(0, this.canvas.height - 20, this.canvas.width, 3);
    },
    
    // Спавн объектов
    spawnObjects() {
        // Кактусы
        if (Math.random() < this.cactusSpawnRate) {
            this.cacti.push(new Cactus(this.canvas, this.getScale(), this.dino));
        }
        
        // Монеты (пачками)
        if (this.score - this.lastCoinSpawn > 50 && Math.random() < this.coinSpawnRate) {
            this.spawnCoinGroup();
            this.lastCoinSpawn = this.score;
        }
        
        // Горы (только если maxJumps >= 2)
        if (this.dino.maxJumps >= 2 && this.score - this.lastMountainSpawn > 200 && Math.random() < this.mountainSpawnRate) {
            this.mountains.push(new Mountain(this.canvas, this.getScale(), this.dino));
            this.lastMountainSpawn = this.score;
        }
    },
    
    // Спавн группы монет
    spawnCoinGroup() {
        const scale = this.getScale();
        const x = this.canvas.width;
        const groundY = this.dino.groundY;
        const dinoHeight = this.dino.height * scale;
        
        // Создаем дугу из монет
        const coinCount = 3 + Math.floor(Math.random() * 3); // 3-5 монет
        const spacing = 40 * scale;
        const startY = groundY + dinoHeight - 30 * scale; // Низкая дуга
        const peakY = startY - 60 * scale; // Высокая точка
        
        for (let i = 0; i < coinCount; i++) {
            const progress = i / (coinCount - 1);
            const y = startY - (Math.sin(progress * Math.PI) * (startY - peakY));
            this.coins.push(new Coin(x + i * spacing, y, scale));
        }
    },
    
    // Обновление объектов
    updateObjects() {
        // Кактусы
        for (let i = this.cacti.length - 1; i >= 0; i--) {
            const cactus = this.cacti[i];
            cactus.update(this.gameSpeed);
            cactus.draw(this.ctx, this.getScale());
            
            if (cactus.collidesWith(this.dino, this.getScale())) {
                this.gameOver();
                return;
            }
            
            if (cactus.isOffScreen()) {
                this.cacti.splice(i, 1);
            }
        }
        
        // Монеты
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];
            coin.update(this.gameSpeed);
            coin.draw(this.ctx);
            
            if (coin.collidesWith(this.dino, this.getScale())) {
                this.coins.splice(i, 1);
                this.coinsEarned++;
                Storage.addCoins(1);
                UI.updateCoins(Storage.getCoins());
                UI.showNotification('+1 🪙', 'success');
            }
            
            if (coin.isOffScreen()) {
                this.coins.splice(i, 1);
            }
        }
        
        // Горы
        for (let i = this.mountains.length - 1; i >= 0; i--) {
            const mountain = this.mountains[i];
            mountain.update(this.gameSpeed, this.dino);
            mountain.draw(this.ctx, this.getScale());
            
            if (mountain.collidesWith(this.dino, this.getScale())) {
                this.gameOver();
                return;
            }
            
            if (mountain.isOffScreen()) {
                this.mountains.splice(i, 1);
            }
        }
    },
    
    // Конец игры
    gameOver() {
        this.gameRunning = false;
        
        // Сохраняем монеты
        if (this.coinsEarned > 0) {
            Storage.addCoins(this.coinsEarned);
        }
        
        // Сохраняем рекорд
        Storage.setHighScore(Math.floor(this.score));
        
        // Показываем экран Game Over
        UI.hideHud();
        UI.showGameOver(Math.floor(this.score), this.coinsEarned);
    }
};

// ===== МЕТОДЫ ДИНОЗАВРА =====
// Добавляем методы к объекту dino после его создания
function initDinoMethods(dino) {
    if (!dino) return;
    
    dino.update = function() {
        // Гравитация
        this.velocityY += Game.gravity;
        this.y += this.velocityY;
        
        // Приземление
        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.velocityY = 0;
            this.jumping = false;
            this.jumpsAvailable = this.maxJumps;
            this.jumpsUsed = 0;
            this.inMountainZone = false;
            this.mountainJumps = 0;
        } else {
            this.jumping = true;
        }
    };
    
    dino.jump = function() {
        // На земле - первый прыжок
        if (Math.abs(this.y - this.groundY) < 2 && this.jumpsAvailable === this.maxJumps) {
            this.velocityY = -15;
            this.jumpsAvailable--;
            this.jumpsUsed++;
            if (this.inMountainZone) this.mountainJumps++;
        }
        // В воздухе - дополнительные прыжки
        else if (this.y < this.groundY && this.jumpsAvailable > 0) {
            this.velocityY = -18;
            this.jumpsAvailable--;
            this.jumpsUsed++;
            if (this.inMountainZone) this.mountainJumps++;
        }
    };
    
    dino.draw = function() {
        const scale = Game.getScale();
        const scaledWidth = this.width * scale;
        const scaledHeight = this.height * scale;
        const scaledX = this.x * scale;
        const scaledY = this.y;
        const ctx = Game.ctx;
        
        // Тело
        ctx.fillStyle = '#333';
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
        
        // Маска (если куплена)
        if (this.hasMask) {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(scaledX + scaledWidth * 0.7, scaledY - scaledHeight * 0.15, scaledWidth * 0.5, scaledHeight * 0.25);
            // Прорези для глаз
            ctx.fillStyle = '#333';
            ctx.fillRect(scaledX + scaledWidth * 0.8, scaledY - scaledHeight * 0.1, scaledWidth * 0.1, scaledHeight * 0.08);
            ctx.fillRect(scaledX + scaledWidth * 0.95, scaledY - scaledHeight * 0.1, scaledWidth * 0.1, scaledHeight * 0.08);
        } else {
            // Глаз
            ctx.fillStyle = 'white';
            ctx.fillRect(scaledX + scaledWidth * 0.875, scaledY - scaledHeight * 0.16, scaledWidth * 0.125, scaledHeight * 0.1);
        }
        
        // Ноги
        ctx.fillStyle = '#333';
        ctx.fillRect(scaledX + scaledWidth * 0.125, scaledY + scaledHeight, scaledWidth * 0.2, scaledHeight * 0.2);
        ctx.fillRect(scaledX + scaledWidth * 0.625, scaledY + scaledHeight, scaledWidth * 0.2, scaledHeight * 0.2);
    };
}

// ===== КАКТУС =====
class Cactus {
    constructor(canvas, scale, dino) {
        this.x = canvas.width;
        this.width = 30 * scale;
        this.height = (50 + Math.random() * 20) * scale;
        const dinoScaledHeight = dino.height * scale;
        this.y = dino.groundY + dinoScaledHeight - this.height;
    }
    
    update(speed) {
        this.x -= speed;
    }
    
    draw(ctx, scale) {
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillRect(this.x - 5 * scale, this.y + 10 * scale, 10 * scale, 8 * scale);
        ctx.fillRect(this.x + this.width - 5 * scale, this.y + 20 * scale, 10 * scale, 8 * scale);
    }
    
    isOffScreen() {
        return this.x + this.width < 0;
    }
    
    collidesWith(dino, scale) {
        const dinoScaledWidth = dino.width * scale;
        const dinoScaledHeight = dino.height * scale;
        const dinoX = dino.x * scale;
        
        return dinoX < this.x + this.width &&
               dinoX + dinoScaledWidth > this.x &&
               dino.y < this.y + this.height &&
               dino.y + dinoScaledHeight > this.y;
    }
}

// ===== МОНЕТА =====
class Coin {
    constructor(x, y, scale) {
        this.x = x;
        this.y = y;
        this.radius = 12 * scale;
        this.rotation = 0;
    }
    
    update(speed) {
        this.x -= speed;
        this.rotation += 0.2;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Монета
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Ободок
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Символ
        ctx.fillStyle = '#FFA500';
        ctx.font = `${this.radius * 0.8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪙', 0, 0);
        
        ctx.restore();
    }
    
    isOffScreen() {
        return this.x + this.radius < 0;
    }
    
    collidesWith(dino, scale) {
        const dinoX = dino.x * scale;
        const dinoY = dino.y;
        const dinoWidth = dino.width * scale;
        const dinoHeight = dino.height * scale;
        
        const dx = this.x - (dinoX + dinoWidth / 2);
        const dy = this.y - (dinoY + dinoHeight / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < this.radius + Math.min(dinoWidth, dinoHeight) / 2;
    }
}

// ===== ГОРА =====
class Mountain {
    constructor(canvas, scale, dino) {
        this.x = canvas.width;
        this.width = 120 * scale; // Широкая гора
        this.height = 80 * scale;
        const dinoScaledHeight = dino.height * scale;
        this.y = dino.groundY + dinoScaledHeight - this.height;
        this.requiredJumps = 2; // Требуется минимум 2 прыжка
    }
    
    update(speed, dino) {
        this.x -= speed;
        
        // Проверяем, находится ли динозавр в зоне горы
        const dinoX = dino.x * Game.getScale();
        if (dinoX >= this.x && dinoX <= this.x + this.width) {
            dino.inMountainZone = true;
        } else if (dinoX > this.x + this.width) {
            // Прошли гору - проверяем, сделал ли достаточно прыжков
            if (dino.inMountainZone && dino.mountainJumps < this.requiredJumps) {
                // Недостаточно прыжков - столкновение
                Game.gameOver();
            }
            dino.inMountainZone = false;
            dino.mountainJumps = 0;
        }
    }
    
    draw(ctx, scale) {
        // Гора (коричневая)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        
        // Снег на вершине
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2 - 10 * scale, this.y);
        ctx.lineTo(this.x + this.width / 2 + 10 * scale, this.y);
        ctx.lineTo(this.x + this.width / 2, this.y + 15 * scale);
        ctx.closePath();
        ctx.fill();
    }
    
    isOffScreen() {
        return this.x + this.width < 0;
    }
    
    collidesWith(dino, scale) {
        const dinoX = dino.x * scale;
        const dinoY = dino.y;
        const dinoWidth = dino.width * scale;
        const dinoHeight = dino.height * scale;
        
        // Проверка столкновения с горой
        if (dinoX < this.x + this.width &&
            dinoX + dinoWidth > this.x &&
            dinoY < this.y + this.height &&
            dinoY + dinoHeight > this.y) {
            
            // Если в зоне горы и недостаточно прыжков
            if (dino.inMountainZone && dino.mountainJumps < this.requiredJumps) {
                return true;
            }
        }
        
        return false;
    }
}

// ===== УПРАВЛЕНИЕ =====
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (Game.gameRunning) {
            Game.dino.jump();
        }
    }
    
    // Пауза
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (Game.gameRunning) {
            Game.gameRunning = false;
            UI.showNotification('Пауза', 'info');
        }
    }
});

// Касание для мобильных
function attachCanvasHandlers() {
    const canvas = Game.canvas;
    if (!canvas) return;
    
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (Game.gameRunning) {
            Game.dino.jump();
        }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        if (Game.gameRunning) {
            e.preventDefault();
        }
    }, { passive: false });
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('load', async () => {
    // Инициализация Auth
    await Auth.bootstrap();
    
    // Инициализация Storage (загрузит облачные данные если залогинен)
    await Storage.init();
    
    // Инициализация игры
    if (!Game.init()) {
        console.error('Ошибка инициализации игры');
        return;
    }
    
    // Инициализация модулей
    await UI.init();
    Shop.init();
    
    // Показываем Home экран
    UI.showScreen('homeScreen');
    
    // Обработчики изменения размера
    window.addEventListener('resize', () => {
        Game.resizeCanvas();
    });
    
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            Game.resizeCanvas();
        }, 100);
    });
    
    // Привязка обработчиков canvas
    attachCanvasHandlers();
});
