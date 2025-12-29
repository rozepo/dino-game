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
        this.skinItems.forEach(skin => {
            const isOwned = Storage.isSkinPurchased(skin.id) || skin.id === 'dino';
            const isSelected = selectedSkin === skin.id;

            const skinEl = document.createElement('div');
            skinEl.className = `shop-item ${isOwned ? 'owned' : ''}`;

            let actionHtml = '';
            if (!isOwned && skin.id === 'dana') {
                actionHtml = `<button class="btn btn-small btn-primary" data-skin-id="${skin.id}" data-skin-action="buy">
                    Купить за ${skin.price}
                </button>`;
            } else {
                actionHtml = isSelected
                    ? '<button class="btn btn-small btn-secondary" disabled>Выбран</button>'
                    : `<button class="btn btn-small btn-secondary" data-skin-id="${skin.id}" data-skin-action="select">Выбрать</button>`;
            }

            skinEl.innerHTML = `
                <div class="shop-item-info">
                    <div class="shop-item-name">
                        ${skin.name}
                        ${isSelected ? '<span class="skin-badge">Выбран</span>' : ''}
                    </div>
                    <div class="shop-item-desc">${skin.desc}</div>
                    <div class="shop-item-price">
                        <span>🪙</span>
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
                        <span>🪙</span>
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
        const coins = Storage.getCoins();
        if (coins < price) {
            UI.showNotification('Недостаточно монет', 'error');
            return;
        }

        // Покупаем: coins -= 1000
        Storage.addCoins(-price);
        Storage.purchaseSkin(skinId);
        Storage.setSelectedSkin(skinId);

        UI.updateCoins(Storage.getCoins());
        UI.showNotification('Скин куплен!', 'success');
        await Storage.forceSync();
        this.render();
        return;
    }

    if (action === 'select') {
        const ok = Storage.setSelectedSkin(skinId);
        if (ok) {
            UI.showNotification('Скин выбран', 'success');
            this.render();
        }
    }
};

