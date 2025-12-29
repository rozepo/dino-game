// Модуль для работы с localStorage и Supabase (облачное сохранение)
const Storage = {
    // Ключи для localStorage (гостевой режим)
    KEYS: {
        COINS: 'dino_game_coins',
        MAX_JUMPS: 'dino_game_max_jumps',
        MASK: 'dino_game_mask',
        HIGH_SCORE: 'dino_game_high_score'
    },
    
    // Облачное состояние (для залогиненных пользователей)
    cloudState: null,
    syncTimer: null,
    isInitialized: false,
    
    // Инициализация (загрузка облачных данных если залогинен)
    async init() {
        if (this.isInitialized) return;
        
        if (Auth.isLoggedIn()) {
            await this.ensureLoaded();
        }

        // Локальные (необлачные) данные: скины персонажа
        this.ensureSkinsInitialized();
        
        this.isInitialized = true;
    },

    // ===== СКИНЫ (localStorage, по требованиям: ключи строго purchasedSkins / selectedSkin) =====
    ensureSkinsInitialized() {
        // purchasedSkins: JSON-массив id (например ["dino","dana"])
        let purchased = [];
        try {
            purchased = JSON.parse(localStorage.getItem('purchasedSkins') || '[]');
        } catch {
            purchased = [];
        }
        if (!Array.isArray(purchased)) purchased = [];
        if (!purchased.includes('dino')) purchased.unshift('dino');
        localStorage.setItem('purchasedSkins', JSON.stringify([...new Set(purchased)]));

        // selectedSkin: строка id (например "dana")
        const selected = localStorage.getItem('selectedSkin') || 'dino';
        if (!purchased.includes(selected)) {
            localStorage.setItem('selectedSkin', 'dino');
        }
    },

    getPurchasedSkins() {
        this.ensureSkinsInitialized();
        try {
            const arr = JSON.parse(localStorage.getItem('purchasedSkins') || '[]');
            return Array.isArray(arr) ? arr : ['dino'];
        } catch {
            return ['dino'];
        }
    },

    isSkinPurchased(skinId) {
        return this.getPurchasedSkins().includes(skinId);
    },

    purchaseSkin(skinId) {
        const purchased = this.getPurchasedSkins();
        if (!purchased.includes(skinId)) {
            purchased.push(skinId);
            localStorage.setItem('purchasedSkins', JSON.stringify([...new Set(purchased)]));
        }
        return true;
    },

    getSelectedSkin() {
        this.ensureSkinsInitialized();
        const skin = localStorage.getItem('selectedSkin') || 'dino';
        return this.isSkinPurchased(skin) ? skin : 'dino';
    },

    setSelectedSkin(skinId) {
        // Выбирать можно только купленные
        if (!this.isSkinPurchased(skinId)) return false;
        localStorage.setItem('selectedSkin', skinId);
        return true;
    },
    
    // Загрузить или создать облачный профиль
    async ensureLoaded() {
        if (!Auth.isLoggedIn()) {
            this.cloudState = null;
            return;
        }
        
        const userId = Auth.getUserId();
        if (!userId) {
            this.cloudState = null;
            return;
        }
        
        try {
            // Пытаемся получить существующий профиль
            const { data, error } = await window.supabaseClient
                .from('player_state')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('Ошибка загрузки профиля:', error);
                this.cloudState = null;
                return;
            }
            
            if (data) {
                // Профиль найден
                this.cloudState = {
                    coins: data.coins || 0,
                    high_score: data.high_score || 0,
                    max_jumps: data.max_jumps || 1,
                    has_mask: data.has_mask || false
                };
            } else {
                // Профиль не найден - создаём новый
                const defaultState = {
                    user_id: userId,
                    coins: 0,
                    high_score: 0,
                    max_jumps: 1,
                    has_mask: false,
                    updated_at: new Date().toISOString()
                };
                
                const { data: newData, error: insertError } = await window.supabaseClient
                    .from('player_state')
                    .insert(defaultState)
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('Ошибка создания профиля:', insertError);
                    this.cloudState = null;
                    return;
                }
                
                this.cloudState = {
                    coins: newData.coins || 0,
                    high_score: newData.high_score || 0,
                    max_jumps: newData.max_jumps || 1,
                    has_mask: newData.has_mask || false
                };
            }
        } catch (error) {
            console.error('Ошибка ensureLoaded:', error);
            this.cloudState = null;
        }
    },
    
    // Синхронизация с облаком (с дебаунсом)
    async syncToCloud() {
        if (!Auth.isLoggedIn() || !this.cloudState) {
            return;
        }
        
        const userId = Auth.getUserId();
        if (!userId) return;
        
        // Очищаем предыдущий таймер
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        
        // Устанавливаем новый таймер (дебаунс 800мс)
        this.syncTimer = setTimeout(async () => {
            try {
                const { error } = await window.supabaseClient
                    .from('player_state')
                    .upsert({
                        user_id: userId,
                        coins: this.cloudState.coins,
                        high_score: this.cloudState.high_score,
                        max_jumps: this.cloudState.max_jumps,
                        has_mask: this.cloudState.has_mask,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id'
                    });
                
                if (error) {
                    console.error('Ошибка синхронизации:', error);
                }
            } catch (error) {
                console.error('Ошибка syncToCloud:', error);
            }
        }, 800);
    },
    
    // Принудительная синхронизация (без дебаунса)
    async forceSync() {
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
        
        if (!Auth.isLoggedIn() || !this.cloudState) {
            return;
        }
        
        const userId = Auth.getUserId();
        if (!userId) return;
        
        try {
            const { error } = await window.supabaseClient
                .from('player_state')
                .upsert({
                    user_id: userId,
                    coins: this.cloudState.coins,
                    high_score: this.cloudState.high_score,
                    max_jumps: this.cloudState.max_jumps,
                    has_mask: this.cloudState.has_mask,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });
            
            if (error) {
                console.error('Ошибка forceSync:', error);
            }
        } catch (error) {
            console.error('Ошибка forceSync:', error);
        }
    },
    
    // Получить монеты
    getCoins() {
        if (Auth.isLoggedIn() && this.cloudState) {
            return this.cloudState.coins || 0;
        }
        const coins = localStorage.getItem(this.KEYS.COINS);
        return coins ? parseInt(coins, 10) : 0;
    },
    
    // Сохранить монеты
    setCoins(coins) {
        if (Auth.isLoggedIn() && this.cloudState) {
            this.cloudState.coins = coins;
            this.syncToCloud();
        } else {
            localStorage.setItem(this.KEYS.COINS, coins.toString());
        }
    },
    
    // Добавить монеты
    addCoins(amount) {
        const current = this.getCoins();
        const newAmount = current + amount;
        this.setCoins(newAmount);
        return newAmount;
    },
    
    // Получить максимальное количество прыжков
    getMaxJumps() {
        if (Auth.isLoggedIn() && this.cloudState) {
            return this.cloudState.max_jumps || 1;
        }
        const jumps = localStorage.getItem(this.KEYS.MAX_JUMPS);
        return jumps ? parseInt(jumps, 10) : 1;
    },
    
    // Сохранить максимальное количество прыжков
    setMaxJumps(jumps) {
        if (Auth.isLoggedIn() && this.cloudState) {
            this.cloudState.max_jumps = jumps;
            this.syncToCloud();
        } else {
            localStorage.setItem(this.KEYS.MAX_JUMPS, jumps.toString());
        }
    },
    
    // Проверить, куплена ли маска
    hasMask() {
        if (Auth.isLoggedIn() && this.cloudState) {
            return this.cloudState.has_mask || false;
        }
        return localStorage.getItem(this.KEYS.MASK) === 'true';
    },
    
    // Сохранить статус маски
    setMask(hasMask) {
        if (Auth.isLoggedIn() && this.cloudState) {
            this.cloudState.has_mask = hasMask;
            this.syncToCloud();
        } else {
            localStorage.setItem(this.KEYS.MASK, hasMask.toString());
        }
    },
    
    // Получить рекорд
    getHighScore() {
        if (Auth.isLoggedIn() && this.cloudState) {
            return this.cloudState.high_score || 0;
        }
        const score = localStorage.getItem(this.KEYS.HIGH_SCORE);
        return score ? parseInt(score, 10) : 0;
    },
    
    // Сохранить рекорд
    setHighScore(score) {
        const current = this.getHighScore();
        if (score > current) {
            if (Auth.isLoggedIn() && this.cloudState) {
                this.cloudState.high_score = score;
                this.syncToCloud();
            } else {
                localStorage.setItem(this.KEYS.HIGH_SCORE, score.toString());
            }
            return true; // Новый рекорд
        }
        return false;
    },
    
    // Миграция гостевого прогресса в облако
    async migrateGuestProgress() {
        if (!Auth.isLoggedIn()) {
            return false;
        }
        
        // Получаем гостевой прогресс
        const guestCoins = parseInt(localStorage.getItem(this.KEYS.COINS) || '0', 10);
        const guestHighScore = parseInt(localStorage.getItem(this.KEYS.HIGH_SCORE) || '0', 10);
        const guestMaxJumps = parseInt(localStorage.getItem(this.KEYS.MAX_JUMPS) || '1', 10);
        const guestHasMask = localStorage.getItem(this.KEYS.MASK) === 'true';
        
        // Загружаем облачный профиль
        await this.ensureLoaded();
        
        if (!this.cloudState) {
            return false;
        }
        
        // Проверяем, нужно ли переносить (если облачный пустой или меньше)
        const shouldMigrate = 
            (this.cloudState.coins === 0 && guestCoins > 0) ||
            (this.cloudState.high_score === 0 && guestHighScore > 0) ||
            (this.cloudState.coins < guestCoins) ||
            (this.cloudState.high_score < guestHighScore);
        
        if (shouldMigrate) {
            // Переносим прогресс
            this.cloudState.coins = Math.max(this.cloudState.coins, guestCoins);
            this.cloudState.high_score = Math.max(this.cloudState.high_score, guestHighScore);
            this.cloudState.max_jumps = Math.max(this.cloudState.max_jumps, guestMaxJumps);
            this.cloudState.has_mask = this.cloudState.has_mask || guestHasMask;
            
            // Синхронизируем
            await this.forceSync();
            
            // Очищаем гостевой прогресс
            localStorage.removeItem(this.KEYS.COINS);
            localStorage.removeItem(this.KEYS.HIGH_SCORE);
            localStorage.removeItem(this.KEYS.MAX_JUMPS);
            localStorage.removeItem(this.KEYS.MASK);
            
            return true;
        }
        
        return false;
    },
    
    // Сброс состояния при выходе
    reset() {
        this.cloudState = null;
        this.isInitialized = false;
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
    }
};
