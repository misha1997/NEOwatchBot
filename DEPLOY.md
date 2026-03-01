# NEOwatch Bot - Інструкція по деплою

## Вимоги
- Python 3.9+
- VPS сервер з Ubuntu/Debian
- SSH доступ
- API ключі (NASA, N2YO, Telegram)

## 1. Підготовка сервера

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv git -y
```

## 2. Копіюємо файли бота

```bash
# На локальній машині
scp -r ~/.openclaw/workspace/projects/NEOwatchBot user@your-server:/opt/neowatch

# На сервері
cd /opt/neowatch
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 3. Конфігурація

```bash
nano config.py
```

Заповни API ключі:
```python
TELEGRAM_BOT_TOKEN = "твій_токен"
NASA_API_KEY = "твій_key"
N2YO_API_KEY = "твій_key"
```

## 4. Автозапуск через systemd

```bash
sudo nano /etc/systemd/system/neowatch.service
```

Встав:
```ini
[Unit]
Description=NEOwatch Telegram Bot
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/neowatch
ExecStart=/opt/neowatch/venv/bin/python bot.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Запуск:
```bash
sudo systemctl daemon-reload
sudo systemctl enable neowatch
sudo systemctl start neowatch
```

## 5. Перевірка

```bash
sudo journalctl -u neowatch -f
```

## Корисні команди

```bash
sudo systemctl restart neowatch   # перезапуск
sudo systemctl stop neowatch      # зупинка
sudo systemctl status neowatch    # статус
```

## Оновлення

```bash
cd /opt/neowatch
sudo systemctl stop neowatch
git pull  # або scp нові файли
sudo systemctl start neowatch
```