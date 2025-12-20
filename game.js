// ===== ИГРОВОЙ МОДУЛЬ =====
const Game = {
    // Инициализация элементов
    canvas: null,
    ctx: null,
    
    // Игровые переменные
    gameRunning: false,
    score: 0,
    coinsEarned: 0,
    // Конвертация из px/frame в px/sec (при 60 FPS)
    // Старая скорость: 5 px/frame → 5 * 60 = 300 px/sec
    baseSpeed: 300, // Базовая скорость в пикселях/сек
    // Старая гравитация: 0.6 px/frame → 0.6 * 60 * 60 = 2160 px/sec²
    gravity: 2160, // Гравитация (пикселей в секунду²)
    
    // Debug флаг (можно включить для проверки)
    debug: false,
    
    // Time-based переменные
    lastTime: 0,
    elapsedTime: 0, // Время игры в секундах
    
    // Игровые объекты
    dino: null,
    cacti: [],
    flowers: [],
    coins: [],
    mountains: [],
    
    // Спавн-таймеры (в секундах)
    coinTimer: 0,
    obstacleTimer: 0,
    mountainCooldown: 0,
    
    // Минимальная дистанция между препятствиями (в пикселях)
    minObstacleDistance: 0,
    
    // Стадии игры
    gameStage: 'early', // early / mid / late
    
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
        this.baseSpeed = 300; // Начальная скорость: 5 px/frame * 60 = 300 px/sec
        this.elapsedTime = 0;
        this.lastTime = performance.now();
        this.gameStage = 'early';
        this.cacti = [];
        this.flowers = [];
        this.coins = [];
        this.mountains = [];
        this.coinTimer = 0;
        this.obstacleTimer = 0;
        this.mountainCooldown = 0;
        this.minObstacleDistance = 0;
        
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
        this.lastTime = performance.now();
        this.update(performance.now());
    },
    
    // Обновление игры (time-based)
    update(currentTime = performance.now()) {
        if (!this.gameRunning) return;
        if (!this.canvas || !this.ctx) return;
        
        // Вычисляем deltaTime
        if (this.lastTime === 0) {
            this.lastTime = currentTime;
        }
        
        let dt = (currentTime - this.lastTime) / 1000; // В секундах (правильно: делим на 1000)
        this.lastTime = currentTime;
        
        // Ограничиваем максимальный dt (защита от телепортов)
        dt = Math.min(dt, 0.1);
        
        // Debug: логируем dt и скорость (можно включить через Game.debug = true)
        if (this.debug && Math.floor(this.elapsedTime * 10) % 10 === 0) {
            console.log(`[DEBUG] dt: ${dt.toFixed(4)}s (${(1/dt).toFixed(1)} FPS), speed: ${this.baseSpeed.toFixed(1)}px/s, elapsed: ${this.elapsedTime.toFixed(1)}s`);
        }
        
        // Обновляем время игры
        this.elapsedTime += dt;
        
        // Обновляем стадию игры
        this.updateGameStage();
        
        // Обновляем скорость (увеличивается со временем)
        this.updateSpeed(dt);
        
        // Очистка
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем фон (небо и землю)
        this.drawBackground();
        
        // Обновляем динозавра (с dt)
        if (this.dino && this.dino.update) {
            this.dino.update(dt);
            this.dino.draw();
        }
        
        // Спавн препятствий и монет (time-based)
        this.spawnObjects(dt);
        
        // Обновляем и рисуем объекты (с dt)
        this.updateObjects(dt);
        
        // Обновляем счет (time-based)
        // Старое: score += 0.1 за кадр → на 60 FPS = 6 очков/сек
        // Но для более плавного увеличения используем 10 очков/сек
        this.score += dt * 10; // 10 очков в секунду
        
        // Debug логирование
        if (this.debug && Math.floor(this.score) % 100 === 0) {
            console.log(`dt: ${dt.toFixed(4)}s, speed: ${this.baseSpeed.toFixed(1)}px/s, score: ${Math.floor(this.score)}`);
        }
        
        // Обновляем UI
        UI.updateScore(this.score);
        
        requestAnimationFrame((time) => this.update(time));
    },
    
    // Обновление стадии игры
    updateGameStage() {
        if (this.elapsedTime < 20) {
            this.gameStage = 'early';
        } else if (this.elapsedTime < 60) {
            this.gameStage = 'mid';
        } else {
            this.gameStage = 'late';
        }
    },
    
    // Обновление скорости
    updateSpeed(dt) {
        // Скорость увеличивается со временем
        // Старое увеличение: 0.3 px/frame за 100 очков
        // На 60 FPS: 0.3 * 60 = 18 px/sec за 100 очков
        // За секунду набирается ~10 очков, так что ~1.8 px/sec за секунду
        // Но для более плавного увеличения используем 3 px/sec за секунду
        const speedIncrease = 3; // пикселей/сек за секунду
        this.baseSpeed += speedIncrease * dt;
        // Максимальная скорость: старая была ~12 px/frame → 12 * 60 = 720 px/sec
        this.baseSpeed = Math.min(this.baseSpeed, 720); // Максимальная скорость
        
        // Обновляем минимальную дистанцию между препятствиями
        this.minObstacleDistance = this.baseSpeed * 1.5; // 1.5 секунды между препятствиями
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
    
    // Спавн объектов (time-based)
    spawnObjects(dt) {
        // Обновляем таймеры
        this.coinTimer -= dt;
        this.obstacleTimer -= dt;
        this.mountainCooldown -= dt;
        
        // Спавн монет
        if (this.coinTimer <= 0) {
            this.spawnCoins();
            // Интервал спавна монет зависит от стадии
            const intervals = {
                early: 1.5, // 1.5 сек
                mid: 1.2,
                late: 1.0
            };
            this.coinTimer = intervals[this.gameStage] + Math.random() * 0.5;
        }
        
        // Спавн препятствий
        if (this.obstacleTimer <= 0) {
            this.spawnObstacle();
            // Интервал препятствий зависит от скорости
            const minDistance = this.minObstacleDistance;
            const interval = minDistance / this.baseSpeed;
            this.obstacleTimer = interval + Math.random() * 0.3;
        }
    },
    
    // Спавн монет (новые паттерны)
    spawnCoins() {
        const scale = this.getScale();
        const x = this.canvas.width;
        const groundY = this.dino.groundY;
        const dinoHeight = this.dino.height * scale;
        
        // Вероятность: 70% одиночная, 25% линия из 5, 5% линия повыше
        const rand = Math.random();
        
        if (rand < 0.7) {
            // Одиночная монета
            this.spawnCoinSingle(x, groundY, dinoHeight, scale);
        } else if (rand < 0.95) {
            // Линия из 5 монет
            this.spawnCoinLine(5, x, groundY, dinoHeight, scale, false);
        } else {
            // Линия повыше (требует двойного прыжка)
            if (this.dino.maxJumps >= 2) {
                this.spawnCoinLine(5, x, groundY, dinoHeight, scale, true);
            } else {
                // Если нет двойного прыжка - обычная линия
                this.spawnCoinLine(5, x, groundY, dinoHeight, scale, false);
            }
        }
    },
    
    // Спавн одной монеты
    spawnCoinSingle(x, groundY, dinoHeight, scale) {
        // 3 уровня высоты: земля, средняя, чуть выше
        const levels = [
            groundY + dinoHeight - 15 * scale, // Земля
            groundY + dinoHeight - 50 * scale, // Средняя
            groundY + dinoHeight - 80 * scale  // Выше
        ];
        const y = levels[Math.floor(Math.random() * levels.length)];
        this.coins.push(new Coin(x, y, scale));
    },
    
    // Спавн линии монет
    spawnCoinLine(count, x, groundY, dinoHeight, scale, high = false) {
        const spacing = 35 * scale; // Расстояние между монетами
        let baseY;
        
        if (high) {
            // Высокая линия (требует двойного прыжка)
            baseY = groundY + dinoHeight - 100 * scale;
        } else {
            // Средняя линия (можно собрать одним прыжком)
            baseY = groundY + dinoHeight - 50 * scale;
        }
        
        for (let i = 0; i < count; i++) {
            this.coins.push(new Coin(x + i * spacing, baseY, scale));
        }
    },
    
    // Спавн препятствия
    spawnObstacle() {
        // Проверяем минимальную дистанцию
        const lastObstacle = this.getLastObstacleX();
        if (lastObstacle > 0 && this.canvas.width - lastObstacle < this.minObstacleDistance) {
            return; // Слишком близко
        }
        
        // Вероятности зависят от стадии
        const probabilities = {
            early: { flower: 0.6, cactus: 0.4, mountain: 0 },
            mid: { flower: 0.3, cactus: 0.6, mountain: 0.1 },
            late: { flower: 0.2, cactus: 0.5, mountain: 0.3 }
        };
        
        const probs = probabilities[this.gameStage];
        const rand = Math.random();
        
        if (rand < probs.flower) {
            // Цветочек
            this.flowers.push(new Flower(this.canvas, this.getScale(), this.dino));
        } else if (rand < probs.flower + probs.cactus) {
            // Кактус
            this.cacti.push(new Cactus(this.canvas, this.getScale(), this.dino));
        } else if (probs.mountain > 0 && this.dino.maxJumps >= 2 && this.mountainCooldown <= 0) {
            // Гора (только если maxJumps >= 2 и нет cooldown)
            this.mountains.push(new Mountain(this.canvas, this.getScale(), this.dino));
            this.mountainCooldown = 3; // 3 секунды cooldown после горы
        }
    },
    
    // Получить X последнего препятствия
    getLastObstacleX() {
        let maxX = -1;
        
        // Проверяем кактусы
        this.cacti.forEach(c => {
            if (c.x > maxX) maxX = c.x;
        });
        
        // Проверяем цветочки
        this.flowers.forEach(f => {
            if (f.x > maxX) maxX = f.x;
        });
        
        // Проверяем горы
        this.mountains.forEach(m => {
            if (m.x + m.width > maxX) maxX = m.x + m.width;
        });
        
        return maxX;
    },
    
    // Обновление объектов (time-based)
    updateObjects(dt) {
        // Кактусы
        for (let i = this.cacti.length - 1; i >= 0; i--) {
            const cactus = this.cacti[i];
            cactus.update(this.baseSpeed, dt);
            cactus.draw(this.ctx, this.getScale());
            
            if (cactus.collidesWith(this.dino, this.getScale())) {
                this.gameOver();
                return;
            }
            
            if (cactus.isOffScreen()) {
                this.cacti.splice(i, 1);
            }
        }
        
        // Цветочки
        for (let i = this.flowers.length - 1; i >= 0; i--) {
            const flower = this.flowers[i];
            flower.update(this.baseSpeed, dt);
            flower.draw(this.ctx, this.getScale());
            
            if (flower.collidesWith(this.dino, this.getScale())) {
                this.gameOver();
                return;
            }
            
            if (flower.isOffScreen()) {
                this.flowers.splice(i, 1);
            }
        }
        
        // Монеты
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];
            coin.update(this.baseSpeed, dt);
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
            mountain.update(this.baseSpeed, dt, this.dino);
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
    
    dino.update = function(dt) {
        // Гравитация (time-based)
        this.velocityY += Game.gravity * dt;
        this.y += this.velocityY * dt;
        
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
        // Старая скорость: -15 px/frame → -15 * 60 = -900 px/sec
        if (Math.abs(this.y - this.groundY) < 2 && this.jumpsAvailable === this.maxJumps) {
            this.velocityY = -900; // Пикселей в секунду
            this.jumpsAvailable--;
            this.jumpsUsed++;
            if (this.inMountainZone) this.mountainJumps++;
        }
        // В воздухе - дополнительные прыжки
        // Старая скорость: -18 px/frame → -18 * 60 = -1080 px/sec
        else if (this.y < this.groundY && this.jumpsAvailable > 0) {
            this.velocityY = -1080; // Чуть выше для двойного прыжка
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
    
    update(speed, dt) {
        this.x -= speed * dt;
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
    
    update(speed, dt) {
        this.x -= speed * dt;
        this.rotation += 3 * dt; // Радиан в секунду
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

// ===== ЦВЕТОЧЕК =====
class Flower {
    constructor(canvas, scale, dino) {
        this.x = canvas.width;
        this.width = 20 * scale; // Меньше кактуса
        this.height = (30 + Math.random() * 15) * scale; // Меньше кактуса
        const dinoScaledHeight = dino.height * scale;
        this.y = dino.groundY + dinoScaledHeight - this.height;
    }
    
    update(speed, dt) {
        this.x -= speed * dt;
    }
    
    draw(ctx, scale) {
        // Стебель
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(this.x + this.width / 2 - 2 * scale, this.y + this.height - 10 * scale, 4 * scale, 10 * scale);
        
        // Лепестки (цветок)
        ctx.fillStyle = '#FF6B9D';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height - 15 * scale, 8 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Центр
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height - 15 * scale, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
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
    
    update(speed, dt, dino) {
        this.x -= speed * dt;
        
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
