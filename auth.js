// Модуль авторизации через Supabase
window.Auth = {
    // Колбэки для изменения состояния авторизации
    _onChangeCallbacks: [],
    
    // Подписаться на изменения авторизации
    onChange(callback) {
        this._onChangeCallbacks.push(callback);
    },
    
    // Вызвать все колбэки
    _notifyChange() {
        this._onChangeCallbacks.forEach(cb => {
            try {
                cb();
            } catch (e) {
                console.error('Ошибка в колбэке onChange:', e);
            }
        });
    },
    
    // Инициализация (получить сессию и подписаться на изменения)
    async bootstrap() {
        try {
            // Получаем текущую сессию
            const session = await this._updateSessionCache();
            
            if (session) {
                console.log('Найдена сессия:', session.user.email);
            }
            
            // Подписываемся на изменения авторизации
            window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
                console.log('Auth state changed:', event, session?.user?.email);
                this._cachedSession = session;
                this._notifyChange();
            });
            
            return { session };
        } catch (error) {
            console.error('Ошибка инициализации Auth:', error);
            this._cachedSession = null;
            return { session: null };
        }
    },
    
    // Регистрация
    async signUp(email, password) {
        try {
            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password
            });
            
            if (error) {
                throw error;
            }
            
            // Если требуется подтверждение email
            if (data.user && !data.session) {
                this._cachedSession = null;
                return {
                    success: true,
                    requiresConfirmation: true,
                    message: 'Проверь почту для подтверждения регистрации'
                };
            }
            
            this._cachedSession = data.session;
            this._notifyChange();
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Вход
    async signIn(email, password) {
        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) {
                throw error;
            }
            
            this._cachedSession = data.session;
            this._notifyChange();
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Ошибка входа:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Выход
    async signOut() {
        try {
            const { error } = await window.supabaseClient.auth.signOut();
            
            if (error) {
                throw error;
            }
            
            this._cachedSession = null;
            this._notifyChange();
            return { success: true };
        } catch (error) {
            console.error('Ошибка выхода:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Кэш сессии
    _cachedSession: null,
    
    // Обновить кэш сессии
    async _updateSessionCache() {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            this._cachedSession = session;
            return session;
        } catch (error) {
            this._cachedSession = null;
            return null;
        }
    },
    
    // Проверка, залогинен ли пользователь
    isLoggedIn() {
        // Используем кэш сессии
        return !!this._cachedSession;
    },
    
    // Получить email текущего пользователя
    getEmail() {
        if (this._cachedSession?.user?.email) {
            return this._cachedSession.user.email;
        }
        return null;
    },
    
    // Получить user_id текущего пользователя
    getUserId() {
        if (this._cachedSession?.user?.id) {
            return this._cachedSession.user.id;
        }
        return null;
    },
    
    // Получить текущую сессию (async)
    async getSession() {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            return session;
        } catch (error) {
            return null;
        }
    }
};

