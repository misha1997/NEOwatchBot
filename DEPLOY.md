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

## 8. Автозапуск через systemd

```bash
sudo nano /etc/systemd/system/neowatch.service
```

Встав:
```ini
[Unit]
Description=NEOwatch Telegram Bot
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/neowatch
Environment="PATH=/opt/neowatch/venv/bin"
ExecStart=/opt/neowatch/venv/bin/python /opt/neowatch/bot.py
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
