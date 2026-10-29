import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

export async function initDatabase() {
    console.log('🔄 Blueberry: Инициализация структуры базы данных...');
    try {
        await pool.query(`
      -- 1. Пользователи (Сотрудники)
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        role VARCHAR(50) NOT NULL CHECK (role IN ('sys_admin', 'director', 'admin', 'waiter', 'kitchen', 'hookah_master', 'hookah_bar')),
        full_name VARCHAR(255) NOT NULL,
        login VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- 2. Зоны
      CREATE TABLE IF NOT EXISTS zones (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- 3. Столики
        CREATE TABLE IF NOT EXISTS tables (
          id SERIAL PRIMARY KEY,
          number VARCHAR(50) NOT NULL,
          zone_id INT REFERENCES zones(id),
          capacity INT DEFAULT 4,
          status VARCHAR(50) DEFAULT 'free' CHECK (status IN ('free', 'occupied', 'reserved')),
          is_active BOOLEAN DEFAULT TRUE,
          reservation_name VARCHAR(255),
          reservation_phone VARCHAR(50),
          reservation_time TIMESTAMP,
          reservation_comment TEXT,
          created_at TIMESTAMP DEFAULT NOW()
);

      -- 4. Категории меню
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        parent_id INT REFERENCES categories(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- 5. Позиции меню
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        category_id INT REFERENCES categories(id) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        composition TEXT,
        image_url VARCHAR(500),
        is_available BOOLEAN DEFAULT TRUE,
        is_for_guests BOOLEAN DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        weight VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Авто-миграция: поле веса для старых БД, созданных до добавления weight
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS weight VARCHAR(50);

      -- 6. История цен
      CREATE TABLE IF NOT EXISTS menu_item_prices (
        id SERIAL PRIMARY KEY,
        menu_item_id INT REFERENCES menu_items(id) ON DELETE CASCADE,
        price DECIMAL(10,2) NOT NULL,
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP,
        changed_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- 7. Комбо-наборы
      CREATE TABLE IF NOT EXISTS combo_sets (
        id SERIAL PRIMARY KEY,
        category_id INT REFERENCES categories(id) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        combo_price DECIMAL(10,2) NOT NULL,
        is_available BOOLEAN DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- 8. Состав комбо-наборов
      CREATE TABLE IF NOT EXISTS combo_items (
        id SERIAL PRIMARY KEY,
        combo_id INT REFERENCES combo_sets(id) ON DELETE CASCADE,
        menu_item_id INT REFERENCES menu_items(id),
        quantity INT NOT NULL DEFAULT 1,
        component_price DECIMAL(10,2)
      );

      -- 9. Смены официантов
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        waiter_id INT REFERENCES users(id) NOT NULL,
        shift_date DATE NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
        cash_register_start DECIMAL(10,2),
        cash_register_end DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- 10. Заказы
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        shift_id INT REFERENCES shifts(id),          -- nullable: заказ можно создать без открытой смены (admin+)
        waiter_id INT REFERENCES users(id),          -- создатель/обслуживающий официант заказа
        table_id INT REFERENCES tables(id),
        status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled')),
        total_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        tip_amount DECIMAL(10,2) DEFAULT 0,
        payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'card', 'mixed')),
        comment TEXT,                                -- комментарий к заказу: персона, предпочтения гостей («убрать лук», «без сахара»)
        created_at TIMESTAMP DEFAULT NOW(),
        closed_at TIMESTAMP
      );

      -- 11. Позиции в заказе
      CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INT REFERENCES orders(id) ON DELETE CASCADE,
          menu_item_id INT REFERENCES menu_items(id),
          quantity INT,
          price_at_sale DECIMAL(10,2),
          combo_id INT REFERENCES combo_sets(id),
          combo_price DECIMAL(10,2),
          waiter_id INT REFERENCES users(id) NOT NULL,
          comment TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          CHECK (
            (menu_item_id IS NOT NULL AND combo_id IS NULL) OR
            (menu_item_id IS NULL AND combo_id IS NOT NULL)
          )
      );

      -- 12. Кальяны: вкусы (ИСПРАВЛЕНО: добавлено DEFAULT перед NOW())
      CREATE TABLE IF NOT EXISTS hookah_flavors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        is_available BOOLEAN DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- 13. Кальяны: заказы
      CREATE TABLE IF NOT EXISTS hookah_orders (
        id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders(id) ON DELETE CASCADE,
        master_id INT REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- 14. Кальяны: позиции заказа
      CREATE TABLE IF NOT EXISTS hookah_order_items (
        id SERIAL PRIMARY KEY,
        hookah_order_id INT REFERENCES hookah_orders(id) ON DELETE CASCADE,
        flavor_id INT REFERENCES hookah_flavors(id),
        quantity INT NOT NULL DEFAULT 1,
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
            -- 15. Постоянные клиенты
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) UNIQUE,
        points INT DEFAULT 0,
        visit_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- 16. Журнал изменений заказа (хронология карточек: кто и что добавил/изменил/удалил)
      CREATE TABLE IF NOT EXISTS order_history (
        id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id),
        action VARCHAR(50) NOT NULL,           -- created, taken_over, item_added, item_updated, item_removed, paid
        details TEXT,                          -- человекочитаемое описание изменения
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- 17. Журнал боя посуды
      CREATE TABLE IF NOT EXISTS breakage_logs (
        id SERIAL PRIMARY KEY,
        menu_item_id INT REFERENCES menu_items(id),
        quantity INT NOT NULL DEFAULT 1,
        reason TEXT,
        waiter_id INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- 18. Корректировки смен (штрафы/вычеты)
      CREATE TABLE IF NOT EXISTS shift_adjustments (
        id SERIAL PRIMARY KEY,
        shift_id INT REFERENCES shifts(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        reason TEXT NOT NULL,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- 19. Оповещения на дашборде (стоп-листы и т.п.)
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'stoplist')),
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

    `);
        console.log('✅ Blueberry: Таблицы успешно созданы или уже существуют.');

        // --- Лёгкие миграции для существующих БД (CREATE TABLE IF NOT EXISTS не меняет старые схемы) ---
        await pool.query(`ALTER TABLE orders ALTER COLUMN shift_id DROP NOT NULL`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_id INT REFERENCES users(id)`);
        // Backfill: определяем создавшего официанта по первой позиции заказа
        await pool.query(`
            UPDATE orders o
            SET waiter_id = sub.waiter_id
            FROM (
                SELECT DISTINCT ON (order_id) order_id, waiter_id
                FROM order_items
                ORDER BY order_id, id ASC
            ) sub
            WHERE sub.order_id = o.id AND o.waiter_id IS NULL
        `);
        // created_at у позиций — нужен для хронологии карточек в модалке заказа.
        // Без этой колонки GET /api/orders/:id падал с ошибкой «column oi.created_at
        // does not exist», а фронтенд показывал «Заказ не найден».
        await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
        console.log('✅ Blueberry: Миграции схемы заказов применены (shift_id nullable, orders.waiter_id, order_items.created_at).');

        // Состав блюда (подсказка для персонала)
        await pool.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS composition TEXT`);
        // Комментарий к заказу: персона гостей, вкусовые предпочтения («убрать лук из салата»)
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS comment TEXT`);

        // --- Гости за столом (раздельный счёт, персональные скидки) ---
        // Таблица order_guests: до 16 гостей на один заказ (стол).
        await pool.query(`
            CREATE TABLE IF NOT EXISTS order_guests (
                id SERIAL PRIMARY KEY,
                order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                name VARCHAR(100),
                discount_percent INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_guests_order ON order_guests(order_id)`);
        // Привязка позиции заказа к конкретному гостю
        await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS guest_id INT REFERENCES order_guests(id) ON DELETE SET NULL`);
        // Сумма гостя к оплате, зафиксированная в момент закрытия счёта (раздельный счёт)
        await pool.query(`ALTER TABLE order_guests ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2)`);

        // Аналитика: привязка оплаченного заказа к закрытой смене (для расчёта часов по фактическим сменам)
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id INT REFERENCES shifts(id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id)`);
        console.log('✅ Blueberry: Миграции схемы меню и заказов применены (menu_items.composition, orders.comment, order_guests, order_items.guest_id).');

        // Страховка от NULL-флагов у старых seed-строк
        await pool.query(`UPDATE categories SET is_active = TRUE WHERE is_active IS NULL`);
        await pool.query(`UPDATE menu_items SET is_available = TRUE WHERE is_available IS NULL`);
        // Позиции без действующей цены получат запись с 0, чтобы не теряться из меню
                await pool.query(`
            INSERT INTO menu_item_prices (menu_item_id, price, valid_from)
            SELECT m.id, 0, NOW()
            FROM menu_items m
            WHERE NOT EXISTS (
                SELECT 1 FROM menu_item_prices p
                WHERE p.menu_item_id = m.id AND p.valid_to IS NULL
            )
        `);


        await seedDatabase();
    } catch (error) {
        console.error('❌ Blueberry: Критическая ошибка инициализации БД:', error);
        process.exit(1);
    }
}

async function seedDatabase() {
    const { rows } = await pool.query('SELECT id FROM categories LIMIT 1');
    if (rows.length > 0) {
        console.log('ℹ️ Blueberry: База данных уже содержит данные, пропускаем сидирование.');
        return;
    }

    console.log('🌱 Blueberry: Заполнение начальными данными (seed)...');

    const sysAdminHash = await bcrypt.hash('sysadmin123', 10);
    const directorHash = await bcrypt.hash('director123', 10);
    const adminHash = await bcrypt.hash('admin123', 10);
    const waiterHash = await bcrypt.hash('waiter123', 10);
    const kitchenHash = await bcrypt.hash('kitchen123', 10);
    const hookahMasterHash = await bcrypt.hash('hookah123', 10);
    const hookahBarHash = await bcrypt.hash('bar123', 10);

    await pool.query(`
        INSERT INTO users (role, full_name, login, password_hash) VALUES
        ('sys_admin', 'Системный Администратор', 'sysadmin', $1),
        ('director', 'Директор', 'director', $2),
        ('admin', 'Администратор', 'admin', $3),
        ('waiter', 'Иван Официант', 'ivan', $4),
        ('kitchen', 'Повар', 'kitchen', $5),
        ('hookah_master', 'Ахмед Кальянщик', 'ahmed', $6),
        ('hookah_bar', 'Бар Кальянной', 'bar', $7)
    `, [sysAdminHash, directorHash, adminHash, waiterHash, kitchenHash, hookahMasterHash, hookahBarHash]);

    await pool.query(`
        INSERT INTO zones (id, name, sort_order) VALUES
        (1, 'Основной зал', 1),
        (2, 'Летняя веранда', 2);

        INSERT INTO categories (id, parent_id, name, sort_order) VALUES
        (1, NULL, 'Кухня', 1),
        (2, NULL, 'Бар', 2),
        (3, NULL, 'Бой посуды', 3),
        (4, NULL, 'Допы', 4),
        (5, NULL, 'Бизнес ланч', 5),
        (6, NULL, 'Банкет', 6),
        (7, 1, 'Пасты', 1),
        (8, 2, 'Чай', 1);

        INSERT INTO menu_items (id, category_id, name, is_for_guests, sort_order) VALUES
        (101, 7, 'Паста Карбонара', TRUE, 1),
        (102, 8, 'Чай черный', TRUE, 1),
        (103, 3, 'Тарелка (бой)', FALSE, 1),
        (104, 4, 'Сироп карамель', TRUE, 1);

        INSERT INTO menu_item_prices (menu_item_id, price, valid_from, changed_by) VALUES
        (101, 450.00, NOW(), 3),
        (102, 150.00, NOW(), 3),
        (103, 200.00, NOW(), 3),
        (104, 50.00, NOW(), 3);

        INSERT INTO tables (number, zone_id, capacity, status) VALUES
        ('1', 1, 4, 'free'),
        ('2', 1, 2, 'free');

        INSERT INTO hookah_flavors (name, description, category, sort_order) VALUES
        ('Двойное яблоко', 'Классический вкус', 'Фруктовые', 1),
        ('Мята', 'Свежий вкус', 'Ментоловые', 2),
        ('Виноград', 'Сладкий вкус', 'Ягодные', 3);

        INSERT INTO customers (name, phone, points, visit_count) VALUES
        ('Иван Петров', '+79001234567', 150, 5);
    `);

    console.log('✅ Blueberry: Начальные данные успешно добавлены.');
}