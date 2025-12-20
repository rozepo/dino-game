// Модуль управления UI
const UI = {
    // Инициализация UI
    async init() {
        this.updateHomeScreen();
        this.attachEvents();
        this.setupAuthListeners();
    },
    
    // Настройка слушателей авторизации
    setupAuthListeners() {
        Auth.onChange(() => {
            this.refreshHome();
        });
    },
    
    // Обновление Home экрана
    updateHomeScreen() {
        const coinsEl = document.getElementById('homeCoins');
        const highScoreEl = document.getElementById('homeHighScore');
        
        if (coinsEl) coinsEl.textContent = Storage.getCoins();
        if (highScoreEl) highScoreEl.textContent = Storage.getHighScore();
        
        // Обновляем статус авторизации
        this.updateAuthStatus();
    },
    
    // Обновление статуса авторизации
    updateAuthStatus() {
        const statusEl = document.getElementById('authStatus');
        if (statusEl) {
            if (Auth.isLoggedIn()) {
                const email = Auth.getEmail();
                statusEl.textContent = email || 'Вход выполнен';
            } else {
                statusEl.textContent = 'Гость';
            }
        }
    },
    
    // Полное обновление Home экрана (после auth событий)
    async refreshHome() {
        // Перезагружаем облачные данные если залогинен
        if (Auth.isLoggedIn()) {
            await Storage.ensureLoaded();
        } else {
            Storage.reset();
        }
        
        this.updateHomeScreen();
        Shop.render();
    },
    
    // Показать экран
    showScreen(screenId) {
        // Скрываем все экраны
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });

        // Показываем нужный
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.remove('hidden');
        }

        // Показываем/скрываем overlay
        const overlay = document.getElementById('gameOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    },
    
    // Скрыть overlay
    hideOverlay() {
        const overlay = document.getElementById('gameOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },
    
    // Показать HUD
    showHud() {
        const hud = document.getElementById('gameHud');
        if (hud) {
            hud.classList.remove('hidden');
        }
    },
    
    // Скрыть HUD
    hideHud() {
        const hud = document.getElementById('gameHud');
        if (hud) {
            hud.classList.add('hidden');
        }
    },
    
    // Обновить счет в HUD
    updateScore(score) {
        const el = document.getElementById('hudScore');
        if (el) el.textContent = Math.floor(score);
    },
    
    // Обновить монеты в HUD
    updateCoins(coins) {
        const el = document.getElementById('hudCoins');
        if (el) el.textContent = coins;
    },
    
    // Обновить уровень прыжка в HUD
    updateJumpLevel(jumps) {
        const el = document.getElementById('hudJumpLevel');
        if (el) el.textContent = `x${jumps}`;
    },
    
    // Показать Game Over экран
    async showGameOver(score, coinsEarned) {
        const scoreEl = document.getElementById('finalScore');
        const coinsEl = document.getElementById('finalCoins');
        
        if (scoreEl) scoreEl.textContent = Math.floor(score);
        if (coinsEl) {
            coinsEl.textContent = `+${coinsEarned}`;
            coinsEl.style.color = coinsEarned > 0 ? 'var(--success)' : 'var(--text-light)';
        }

        // Проверяем рекорд
        const isNewRecord = Storage.setHighScore(Math.floor(score));
        if (isNewRecord) {
            UI.showNotification('🎉 Новый рекорд!', 'success');
        }
        
        // Принудительная синхронизация после Game Over
        await Storage.forceSync();

        this.showScreen('gameOverScreen');
    },
    
    // Показать уведомление
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;

        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    },
    
    // Показать ошибку авторизации
    showAuthError(message) {
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    },
    
    // Скрыть ошибку авторизации
    hideAuthError() {
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
    },
    
    // Обновить UI авторизации
    updateAuthUI() {
        const loggedInDiv = document.getElementById('authLoggedIn');
        const userEmailEl = document.getElementById('authUserEmail');
        const emailInput = document.getElementById('authEmail');
        const passwordInput = document.getElementById('authPassword');
        const signInBtn = document.getElementById('signInBtn');
        const signUpBtn = document.getElementById('signUpBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        
        if (Auth.isLoggedIn()) {
            // Показываем информацию о пользователе
            if (loggedInDiv) loggedInDiv.classList.remove('hidden');
            if (userEmailEl) userEmailEl.textContent = Auth.getEmail() || '';
            if (emailInput) emailInput.style.display = 'none';
            if (passwordInput) passwordInput.style.display = 'none';
            if (signInBtn) signInBtn.style.display = 'none';
            if (signUpBtn) signUpBtn.style.display = 'none';
        } else {
            // Показываем форму входа
            if (loggedInDiv) loggedInDiv.classList.add('hidden');
            if (emailInput) emailInput.style.display = 'block';
            if (passwordInput) passwordInput.style.display = 'block';
            if (signInBtn) signInBtn.style.display = 'block';
            if (signUpBtn) signUpBtn.style.display = 'block';
        }
    },
    
    // Привязка событий
    attachEvents() {
        // Кнопка "Играть"
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                Game.start();
            });
        }

        // Кнопка "Магазин" (из Home)
        const shopBtn = document.getElementById('shopBtn');
        if (shopBtn) {
            shopBtn.addEventListener('click', () => {
                Shop.render();
                this.showScreen('shopScreen');
            });
        }

        // Кнопка "Магазин" (из Game Over)
        const shopBtnFromGameOver = document.getElementById('shopBtnFromGameOver');
        if (shopBtnFromGameOver) {
            shopBtnFromGameOver.addEventListener('click', () => {
                Shop.render();
                this.showScreen('shopScreen');
            });
        }

        // Кнопка закрытия магазина
        const closeShopBtn = document.getElementById('closeShopBtn');
        if (closeShopBtn) {
            closeShopBtn.addEventListener('click', () => {
                this.showScreen('homeScreen');
                this.updateHomeScreen();
            });
        }

        // Кнопка "Домой"
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.showScreen('homeScreen');
                this.updateHomeScreen();
            });
        }

        // Кнопка "Играть снова"
        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                Game.start();
            });
        }
        
        // Кнопка "Войти / Аккаунт"
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            authBtn.addEventListener('click', () => {
                this.updateAuthUI();
                this.showScreen('authScreen');
            });
        }
        
        // Кнопка закрытия экрана авторизации
        const closeAuthBtn = document.getElementById('closeAuthBtn');
        if (closeAuthBtn) {
            closeAuthBtn.addEventListener('click', () => {
                this.showScreen('homeScreen');
                this.updateHomeScreen();
            });
        }
        
        // Кнопка "Войти"
        const signInBtn = document.getElementById('signInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', async () => {
                this.hideAuthError();
                const email = document.getElementById('authEmail').value.trim();
                const password = document.getElementById('authPassword').value;
                
                if (!email || !password) {
                    this.showAuthError('Заполните все поля');
                    return;
                }
                
                const result = await Auth.signIn(email, password);
                if (result.success) {
                    await Storage.ensureLoaded();
                    // Предлагаем миграцию гостевого прогресса
                    const migrated = await Storage.migrateGuestProgress();
                    if (migrated) {
                        this.showNotification('Прогресс перенесён в аккаунт!', 'success');
                    }
                    this.updateHomeScreen();
                    this.showScreen('homeScreen');
                } else {
                    this.showAuthError(result.error || 'Ошибка входа');
                }
            });
        }
        
        // Кнопка "Зарегистрироваться"
        const signUpBtn = document.getElementById('signUpBtn');
        if (signUpBtn) {
            signUpBtn.addEventListener('click', async () => {
                this.hideAuthError();
                const email = document.getElementById('authEmail').value.trim();
                const password = document.getElementById('authPassword').value;
                
                if (!email || !password) {
                    this.showAuthError('Заполните все поля');
                    return;
                }
                
                if (password.length < 6) {
                    this.showAuthError('Пароль должен быть не менее 6 символов');
                    return;
                }
                
                const result = await Auth.signUp(email, password);
                if (result.success) {
                    if (result.requiresConfirmation) {
                        this.showAuthError(result.message || 'Проверь почту для подтверждения регистрации');
                    } else {
                        await Storage.ensureLoaded();
                        // Предлагаем миграцию гостевого прогресса
                        const migrated = await Storage.migrateGuestProgress();
                        if (migrated) {
                            this.showNotification('Прогресс перенесён в аккаунт!', 'success');
                        }
                        this.updateHomeScreen();
                        this.showScreen('homeScreen');
                    }
                } else {
                    this.showAuthError(result.error || 'Ошибка регистрации');
                }
            });
        }
        
        // Кнопка "Выйти"
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                await Auth.signOut();
                Storage.reset();
                this.updateHomeScreen();
                this.showScreen('homeScreen');
            });
        }
    }
};
