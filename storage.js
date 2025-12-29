// Модуль для работы с localStorage и Supabase (облачное сохранение)
const Storage = {
    // Debug-флаг для логов синхронизации (включить: Storage.DEBUG = true)
    DEBUG: false,
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

    _log(...args) {
        if (this.DEBUG) console.log('[Storage]', ...args);
    },

    _normalizePurchasedSkins(purchased) {
        let arr = Array.isArray(purchased) ? purchased.slice() : [];
        arr = arr.filter(Boolean);
        if (!arr.includes('dino')) arr.unshift('dino');
        return [...new Set(arr)];
    },

    _readLocalSkins() {
        this.ensureSkinsInitialized();
        let purchased = [];
        try {
            purchased = JSON.parse(localStorage.getItem('purchasedSkins') || '[]');
        } catch {
            purchased = [];
        }
        purchased = this._normalizePurchasedSkins(purchased);
        const selected = localStorage.getItem('selectedSkin') || 'dino';
        return {
            purchasedSkins: purchased,
            selectedSkin: purchased.includes(selected) ? selected : 'dino'
        };
    },

    _writeLocalSkins(purchasedSkins, selectedSkin) {
        const purchased = this._normalizePurchasedSkins(purchasedSkins);
        const selected = purchased.includes(selectedSkin) ? selectedSkin : 'dino';
        localStorage.setItem('purchasedSkins', JSON.stringify(purchased));
        localStorage.setItem('selectedSkin', selected);
    },

    getPurchasedSkins() {
        if (Auth.isLoggedIn() && this.cloudState) {
            return this._normalizePurchasedSkins(this.cloudState.purchased_skins);
        }
        return this._readLocalSkins().purchasedSkins;
    },

    isSkinPurchased(skinId) {
        return this.getPurchasedSkins().includes(skinId);
    },

    purchaseSkin(skinId) {
        const purchased = this.getPurchasedSkins();
        const next = this._normalizePurchasedSkins([...purchased, skinId]);
        if (Auth.isLoggedIn() && this.cloudState) {
            this.cloudState.purchased_skins = next;
            this.syncToCloud();
        }
        this._writeLocalSkins(next, this.getSelectedSkin());
        return true;
    },

    getSelectedSkin() {
        if (Auth.isLoggedIn() && this.cloudState) {
            const skin = this.cloudState.selected_skin || 'dino';
            return this.isSkinPurchased(skin) ? skin : 'dino';
        }
        return this._readLocalSkins().selectedSkin;
    },

    setSelectedSkin(skinId) {
        // Выбирать можно только купленные
        if (!this.isSkinPurchased(skinId)) return false;
        if (Auth.isLoggedIn() && this.cloudState) {
            this.cloudState.selected_skin = skinId;
            this.syncToCloud();
        }
        this._writeLocalSkins(this.getPurchasedSkins(), skinId);
        return true;
    },

    // Слить облачные/локальные скины без потерь (при логине приоритет облаку, но пустое облако не затирает локал)
    _mergeSkinsCloudLocal() {
        if (!this.cloudState) return { changedCloud: false };

        const local = this._readLocalSkins();
        const cloudPurchased = this._normalizePurchasedSkins(this.cloudState.purchased_skins);
        const localPurchased = this._normalizePurchasedSkins(local.purchasedSkins);
        const mergedPurchased = [...new Set([...cloudPurchased, ...localPurchased])];

        const selected =
            (this.cloudState.selected_skin && mergedPurchased.includes(this.cloudState.selected_skin))
                ? this.cloudState.selected_skin
                : (local.selectedSkin && mergedPurchased.includes(local.selectedSkin))
                    ? local.selectedSkin
                    : 'dino';

        const changedCloud =
            JSON.stringify(cloudPurchased) !== JSON.stringify(mergedPurchased) ||
            (this.cloudState.selected_skin || 'dino') !== selected;

        this.cloudState.purchased_skins = mergedPurchased;
        this.cloudState.selected_skin = selected;
        this._writeLocalSkins(mergedPurchased, selected);

        this._log('skins merge', { cloudPurchased, localPurchased, mergedPurchased, selected, changedCloud });
        return { changedCloud };
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
                    has_mask: data.has_mask || false,
                    purchased_skins: Array.isArray(data.purchased_skins) ? data.purchased_skins : [],
                    selected_skin: data.selected_skin || 'dino'
                };
            } else {
                // Профиль не найден - создаём новый
                const defaultState = {
                    user_id: userId,
                    coins: 0,
                    high_score: 0,
                    max_jumps: 1,
                    has_mask: false,
                    purchased_skins: ['dino'],
                    selected_skin: 'dino',
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
                    has_mask: newData.has_mask || false,
                    purchased_skins: Array.isArray(newData.purchased_skins) ? newData.purchased_skins : ['dino'],
                    selected_skin: newData.selected_skin || 'dino'
                };
            }

            // Применяем/сливаем скины (и при необходимости доталкиваем в облако)
            const { changedCloud } = this._mergeSkinsCloudLocal();
            if (changedCloud) {
                await this.forceSync();
            }
        } catch (error) {
            console.error('Ошибка ensureLoaded:', error);
            this.cloudState = null;
        }
    },

    _cloudPayload(userId) {
        return {
            user_id: userId,
            coins: this.cloudState.coins,
            high_score: this.cloudState.high_score,
            max_jumps: this.cloudState.max_jumps,
            has_mask: this.cloudState.has_mask,
            purchased_skins: this._normalizePurchasedSkins(this.cloudState.purchased_skins),
            selected_skin: this.getSelectedSkin(),
            updated_at: new Date().toISOString()
        };
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
                        ...this._cloudPayload(userId)
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
            return true;
        }
        
        const userId = Auth.getUserId();
        if (!userId) return false;
        
        try {
            const { error } = await window.supabaseClient
                .from('player_state')
                .upsert({
                    ...this._cloudPayload(userId)
                }, {
                    onConflict: 'user_id'
                });
            
            if (error) {
                console.error('Ошибка forceSync:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Ошибка forceSync:', error);
            return false;
        }
    },

    // Атомарная покупка скина (coins + purchasedSkins + selectedSkin одним сохранением)
    async buySkin(skinId, price) {
        if (!skinId) return { success: false, reason: 'invalid' };
        if (this.isSkinPurchased(skinId)) {
            // Уже куплен — просто выбираем
            const ok = await this.selectSkin(skinId);
            return { success: ok, reason: ok ? 'selected' : 'sync_failed' };
        }

        const coins = this.getCoins();
        if (coins < price) return { success: false, reason: 'insufficient' };

        // Гость: просто локально
        if (!Auth.isLoggedIn() || !this.cloudState) {
            this.addCoins(-price);
            this.purchaseSkin(skinId);
            this.setSelectedSkin(skinId);
            return { success: true };
        }

        // Логин: откат при ошибке облака
        const prev = {
            coins: this.cloudState.coins,
            purchased_skins: this._normalizePurchasedSkins(this.cloudState.purchased_skins),
            selected_skin: this.cloudState.selected_skin || 'dino'
        };

        const nextPurchased = this._normalizePurchasedSkins([...prev.purchased_skins, skinId]);
        const nextSelected = skinId;

        this.cloudState.coins = prev.coins - price;
        this.cloudState.purchased_skins = nextPurchased;
        this.cloudState.selected_skin = nextSelected;
        this._writeLocalSkins(nextPurchased, nextSelected);

        const ok = await this.forceSync();
        if (!ok) {
            // rollback
            this.cloudState.coins = prev.coins;
            this.cloudState.purchased_skins = prev.purchased_skins;
            this.cloudState.selected_skin = prev.selected_skin;
            this._writeLocalSkins(prev.purchased_skins, prev.selected_skin);
            return { success: false, reason: 'sync_failed' };
        }

        return { success: true };
    },

    // Выбор скина с синком в облако (с откатом)
    async selectSkin(skinId) {
        if (!this.isSkinPurchased(skinId)) return false;

        if (!Auth.isLoggedIn() || !this.cloudState) {
            this.setSelectedSkin(skinId);
            return true;
        }

        const prev = this.cloudState.selected_skin || 'dino';
        this.cloudState.selected_skin = skinId;
        this._writeLocalSkins(this.getPurchasedSkins(), skinId);

        const ok = await this.forceSync();
        if (!ok) {
            this.cloudState.selected_skin = prev;
            this._writeLocalSkins(this.getPurchasedSkins(), prev);
            return false;
        }
        return true;
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
        const guestSkins = this._readLocalSkins();
        
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

            // Переносим/сливаем скины (без потерь)
            this.cloudState.purchased_skins = [...new Set([
                ...this._normalizePurchasedSkins(this.cloudState.purchased_skins),
                ...this._normalizePurchasedSkins(guestSkins.purchasedSkins)
            ])];
            this.cloudState.selected_skin = (guestSkins.selectedSkin && this.cloudState.purchased_skins.includes(guestSkins.selectedSkin))
                ? guestSkins.selectedSkin
                : (this.cloudState.selected_skin || 'dino');
            this._writeLocalSkins(this.cloudState.purchased_skins, this.cloudState.selected_skin);
            
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
