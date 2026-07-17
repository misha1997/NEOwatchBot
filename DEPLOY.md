# NEOwatch Bot - Інструкція по деплою

## Вимоги
- Python 3.10+
- VPS сервер з Ubuntu/Debian
- MySQL 8.0+
- SSH доступ
- API ключі (NASA, N2YO, Telegram)

## 1. Підготовка сервера

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv git -y
```

## 2. Встановлення MySQL

```bash
sudo apt install mysql-server -y
sudo systemctl enable mysql
sudo systemctl start mysql

# Налаштування безпеки (опціонально)
sudo mysql_secure_installation
```

## 3. Налаштування бази даних

```bash
# Увійти в MySQL
sudo mysql -u root -p
```

Виконати SQL:
```sql
CREATE DATABASE neowatch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'neowatch'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON neowatch.* TO 'neowatch'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Або використати скрипт:
```bash
# Зміни пароль в setup_mysql.sql!
mysql -u root -p < setup_mysql.sql
```

## 4. Копіюємо файли бота

```bash
# На локальній машині
scp -r ~/.openclaw/workspace/projects/NEOwatchBot user@your-server:/opt/neowatch

# На сервері
cd /opt/neowatch
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 5. Конфігурація

```bash
nano .env
```

Заповни:
```env
# API Keys
NASA_API_KEY=your_nasa_key
N2YO_API_KEY=your_n2yo_key
BOT_TOKEN=your_telegram_token
# Mars rover photos (Perseverance/Curiosity). Free key — signup at
# https://marsvista.dev/signin. Optional: without it the 🚀 Марсоходи button
# shows a "key not configured" hint instead of photos.
MARS_VISTA_API_KEY=your_marsvista_key

# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=neowatch
DB_USER=neowatch
DB_PASSWORD=your_secure_password
```

## 6. Міграція даних (якщо є SQLite)

```bash
# Скопіюй старий neowatch.db в папку бота
cp /path/to/neowatch.db .

# Запусти міграцію
source venv/bin/activate
python3 migrate_to_mysql.py
```

## 7. Тестовий запуск

```bash
source venv/bin/activate
python3 bot.py
```

Перевір що нема помилок, тоді Ctrl+C і налаштовуй systemd.

### 7a. Кеш ефемерид skyfield (одноразово)

Функції «🪐 Планети» та «🌌 Календар тижня» раховують ефемериду через
`skyfield`. Першим запуском бот тягне JPL-ефемериду `de440s.bsp` (~32 МБ)
у `data/` (плюс `finals.all` для високосних секунд). Це відбувається
автоматично при першому зверненні до планет/календаря, але потрібен інтернет
і права на запис у `/opt/neowatch/data`.

Щоб перший користувач не чекав на завантаження — передзавантаж вручну:

```bash
cd /opt/neowatch
source venv/bin/activate
python3 -c "from skyfield.api import Loader; load=Loader('data'); load('de440s.bsp'); load.timescale()"
```

Під systemd з `User=neowatch` переконайся, що папка належить цьому юзеру:

```bash
mkdir -p /opt/neowatch/data
chown -R neowatch:neowatch /opt/neowatch/data
```

`data/` вже в `.gitignore`.

### 7b. Мультимовне SEO: білд React-фронтенду

Сайт — React SPA (`my-app/`), обслуговується FastAPI з мовними префіксами
`/ua/...` та `/en/...` (slug'и перекладено). Перед кожним деплоєм фронтенду:

```bash
cd /opt/neowatch/my-app
npm ci
npm run build
```

Білд кладеться у `my-app/build/` — FastAPI читає `index.html` щого запиту й
інжектує per-route meta (див. `web/seo.py`). Без білду сайт не підніметься
(`RuntimeError`).

### 7c. Prerendering для ботів (необовʼязково, за замовч. вимкнено)

SPA рендерить тіло JS-ом; `web/seo.py` вже дає ботам коректний `<head>`
(title/canonical/hreflang/OG/JSON-LD). Щоб Bing/FB/TG-скрапери бачили й тіло
сторінки, увімкни headless-Chrome prerendering:

```bash
source venv/bin/activate
pip install playwright
playwright install chromium
# у .env / systemd Environment= додай:
#   PRERENDER_ENABLED=1
#   PORT=8000
sudo systemctl restart neowatch
```

Кеш рендерів — у `data/prerender/<lang>/<slug>.html` (TTL 24 год, див.
`PRERENDER_TTL`). За відсутності Chromium або таймауту — автоматичний фолбек
на meta-інʼєкційний shell. Альтернатива без локального Chromium:
`PRERENDER_PROVIDER=prerenderio` + `PRERENDER_IO_TOKEN` (проксі через
Prerender.io; не реалізовано повністю — допиши у `web/prerender.py` за потреби).

### 7d. Стиснення (Brotli/gzip) + кеш статики через nginx

uvicorn не стискає; реверс-проксі nginx має робити це для `/static` та HTML:

```nginx
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
brotli on;  # якщо встановлено ngx_brotli
brotli_types text/css application/javascript application/json image/svg+xml;

# CRA-білд: хешовані імена файлів у /static — кешуй назавжди
location /static/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

## 8. Автозапуск через systemd

Сайт і бот тепер живуть в одному процесі (FastAPI + uvicorn піднімає і
Telegram-бота, і веб-дашборд через один event-loop). Раніше `ExecStart` був
`python bot.py` — заміни його на uvicorn, як нижче.

```bash
sudo nano /etc/systemd/system/neowatch.service
```

Встав:
```ini
[Unit]
Description=NEOwatch (Telegram bot + website)
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/neowatch
Environment="PATH=/opt/neowatch/venv/bin"
ExecStart=/opt/neowatch/venv/bin/python -m uvicorn web.app:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Запуск:
```bash
sudo systemctl daemon-reload
sudo systemctl enable neowatch
sudo systemctl start neowatch
```

Сайт буде доступний на `http://<server>:8000/`, API — на `/api/*`.
Щоб пускати лише бота без сайту (як раніше), можна окремо запускати
`python bot.py` — але тоді веб-дашборд працювати не буде.

## 9. Перевірка

```bash
# Статус сервісу
sudo systemctl status neowatch

# Логи
sudo journalctl -u neowatch -f

# База даних
mysql -u neowatch -p neowatch -e "SELECT COUNT(*) FROM users;"
```

## Корисні команди

```bash
# Бот
sudo systemctl restart neowatch
sudo systemctl stop neowatch
sudo systemctl status neowatch

# MySQL
sudo systemctl status mysql
mysql -u neowatch -p neowatch

# Логи
sudo journalctl -u neowatch -f --since "1 hour ago"
tail -f /var/log/mysql/error.log
```

## Оновлення

```bash
cd /opt/neowatch
sudo systemctl stop neowatch
git pull  # або scp нові файли
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl start neowatch
```

## Резервне копіювання

```bash
# Backup MySQL
mysqldump -u neowatch -p neowatch > neowatch_backup_$(date +%Y%m%d).sql
```

## Відкат на SQLite (якщо треба)

Є бекап `database_sqlite.py` - просто заміни `database.py`.
