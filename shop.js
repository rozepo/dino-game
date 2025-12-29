// Модуль магазина
const Shop = {
    skinItems: [
        {
            id: 'dino',
            name: 'Dino',
            desc: 'Базовый скин (доступен сразу)',
            price: 0
        },
        {
            id: 'dana',
            name: 'Dana',
            desc: 'Новый скин персонажа',
            price: 1000
        }
    ],
    items: [
        {
            id: 'double_jump',
            name: 'Двойной прыжок',
            desc: 'Позволяет прыгнуть дважды в воздухе',
            price: 50,
            type: 'jump',
            value: 2
        },
        {
            id: 'triple_jump',
            name: 'Тройной прыжок',
            desc: 'Позволяет прыгнуть трижды в воздухе',
            price: 150,
            type: 'jump',
            value: 3,
            requires: 'double_jump'
        },
        {
            id: 'quad_jump',
            name: 'Четверной прыжок',
            desc: 'Позволяет прыгнуть четырежды в воздухе',
            price: 300,
            type: 'jump',
            value: 4,
            requires: 'triple_jump'
        },
        {
            id: 'mask',
            name: 'Маска',
            desc: 'Косметический предмет для динозавра',
            price: 100,
            type: 'cosmetic',
            value: true
        }
    ],

    // Инициализация магазина
    init() {
        this.render();
        this.attachEvents();
    },

    // Отрисовка товаров
    render() {
        const container = document.getElementById('shopItems');
        if (!container) return;

        container.innerHTML = '';

        // ===== СКИНЫ =====
        const skinsTitle = document.createElement('div');
        skinsTitle.className = 'shop-section-title';
        skinsTitle.textContent = 'Скины';
        container.appendChild(skinsTitle);

        const selectedSkin = Storage.getSelectedSkin();
        const coins = Storage.getCoins();
        const danaSrc = (typeof Game !== 'undefined' && Game.SKIN_ASSETS && Game.SKIN_ASSETS.dana)
            ? Game.SKIN_ASSETS.dana
            : 'dana_sprite.png?v=2';

        this.skinItems.forEach(skin => {
            const isOwned = Storage.isSkinPurchased(skin.id) || skin.id === 'dino';
            const isSelected = selectedSkin === skin.id;
            const canAfford = coins >= skin.price;

            const skinEl = document.createElement('div');
            skinEl.className = `shop-item ${isOwned ? 'owned' : ''} ${isSelected ? 'selected' : ''}`;

            let actionHtml = '';
            if (!isOwned && skin.id === 'dana') {
                if (!canAfford) {
                    actionHtml = `<button class="btn btn-small btn-primary" disabled>
                        Недостаточно монет
                    </button>`;
                } else {
                    actionHtml = `<button class="btn btn-small btn-primary" data-skin-id="${skin.id}" data-skin-action="buy">
                        Купить <span class="coin-icon coin-sm">R</span> ${skin.price}
                    </button>`;
                }
            } else {
                actionHtml = isSelected
                    ? '<button class="btn btn-small btn-secondary" disabled>Выбран</button>'
                    : `<button class="btn btn-small btn-secondary" data-skin-id="${skin.id}" data-skin-action="select">Выбрать</button>`;
            }

            const previewHtml = skin.id === 'dino'
                ? `
                    <div class="skin-preview skin-preview-dino" aria-label="Dino preview">
                        <div class="dino-mini-body"></div>
                        <div class="dino-mini-head"></div>
                        <div class="dino-mini-horn"></div>
                    </div>
                `
                : `
                    <div class="skin-preview" aria-label="Dana preview">
                        <img class="skin-preview-img" src="${danaSrc}" alt="Dana" />
                    </div>
                `;

            skinEl.innerHTML = `
                <div class="shop-item-preview">
                    ${previewHtml}
                </div>
                <div class="shop-item-info">
                    <div class="shop-item-name">
                        ${skin.name}
                        ${isSelected ? '<span class="skin-badge">Выбран</span>' : ''}
                    </div>
                    <div class="shop-item-desc">${skin.desc}</div>
                    <div class="shop-item-price">
                        <span class="coin-icon coin-sm">R</span>
                        <span>${skin.price}</span>
                    </div>
                </div>
                <div class="shop-item-action">
                    ${actionHtml}
                </div>
            `;

            container.appendChild(skinEl);
        });

        const upgradesTitle = document.createElement('div');
        upgradesTitle.className = 'shop-section-title';
        upgradesTitle.textContent = 'Улучшения';
        container.appendChild(upgradesTitle);

        // ===== УЛУЧШЕНИЯ =====
        this.items.forEach(item => {
            const isOwned = this.isOwned(item.id);
            const canAfford = Storage.getCoins() >= item.price;
            const canBuy = !isOwned && canAfford && (!item.requires || this.isOwned(item.requires));

            const itemEl = document.createElement('div');
            itemEl.className = `shop-item ${isOwned ? 'owned' : ''}`;
            
            itemEl.innerHTML = `
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-desc">${item.desc}</div>
                    <div class="shop-item-price">
                        <span class="coin-icon coin-sm">R</span>
                        <span>${item.price}</span>
                    </div>
                </div>
                <div class="shop-item-action">
                    ${isOwned 
                        ? '<button class="btn btn-small btn-secondary" disabled>Куплено</button>'
                        : `<button class="btn btn-small btn-primary" ${!canBuy ? 'disabled' : ''} data-item-id="${item.id}">
                            Купить
                        </button>`
                    }
                </div>
            `;

            container.appendChild(itemEl);
        });

        // Обновляем баланс
        const balanceEl = document.getElementById('shopBalance');
        if (balanceEl) {
            balanceEl.textContent = Storage.getCoins();
        }

        const headerCoinsEl = document.getElementById('shopHeaderCoins');
        if (headerCoinsEl) {
            headerCoinsEl.textContent = Storage.getCoins();
        }
    },

    // Проверка, куплен ли товар
    isOwned(itemId) {
        if (itemId === 'mask') {
            return Storage.hasMask();
        }
        
        const maxJumps = Storage.getMaxJumps();
        const item = this.items.find(i => i.id === itemId);
        return item && item.type === 'jump' && maxJumps >= item.value;
    },

    // Покупка товара
    async buy(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return false;

        if (this.isOwned(itemId)) {
            UI.showNotification('Уже куплено!', 'error');
            return false;
        }

        if (item.requires && !this.isOwned(item.requires)) {
            UI.showNotification('Сначала купите предыдущий апгрейд!', 'error');
            return false;
        }

        const coins = Storage.getCoins();
        if (coins < item.price) {
            UI.showNotification('Недостаточно монет!', 'error');
            return false;
        }

        // Покупаем
        Storage.addCoins(-item.price);

        if (item.type === 'jump') {
            Storage.setMaxJumps(item.value);
            UI.showNotification(`${item.name} куплено!`, 'success');
        } else if (item.id === 'mask') {
            Storage.setMask(true);
            UI.showNotification(`${item.name} куплено!`, 'success');
        }

        // Принудительная синхронизация после покупки
        await Storage.forceSync();

        this.render();
        return true;
    },

    // Привязка событий
    attachEvents() {
        document.addEventListener('click', (e) => {
            const skinBtn = e.target.closest('[data-skin-id]');
            if (skinBtn) {
                const skinId = skinBtn.dataset.skinId;
                const action = skinBtn.dataset.skinAction;
                this.handleSkinAction(action, skinId);
                return;
            }

            if (e.target.closest('[data-item-id]')) {
                const itemId = e.target.closest('[data-item-id]').dataset.itemId;
                this.buy(itemId);
            }
        });
    }
};

// ===== СКИНЫ: покупка/выбор =====
Shop.handleSkinAction = async function(action, skinId) {
    if (!skinId) return;

    if (action === 'buy') {
        const price = 1000;
        const res = await Storage.buySkin(skinId, price);
        if (!res.success) {
            if (res.reason === 'insufficient') {
                UI.showNotification('Недостаточно монет', 'error');
            } else if (res.reason === 'sync_failed') {
                UI.showNotification('Ошибка синхронизации покупки. Попробуйте ещё раз.', 'error');
            } else {
                UI.showNotification('Ошибка покупки', 'error');
            }
            return;
        }

        UI.updateCoins(Storage.getCoins());
        UI.showNotification('Скин куплен!', 'success');
        this.render();
        return;
    }

    if (action === 'select') {
        const ok = await Storage.selectSkin(skinId);
        if (!ok) {
            const hint = (typeof Storage.getLastSyncErrorHint === 'function') ? Storage.getLastSyncErrorHint() : '';
            const msg = hint || 'Ошибка синхронизации. Попробуйте ещё раз.';
            UI.showNotification(msg, 'error');
            return;
        }
        UI.showNotification('Скин выбран', 'success');
        this.render();
    }
};

