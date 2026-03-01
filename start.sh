#!/bin/bash
# Start NEOwatch Bot

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Створюю віртуальне середовище..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Встановлюю залежності..."
pip install -q -r requirements.txt

# Run bot
echo "Запускаю NEOwatch bot..."
echo "Підписки зберігаються в subscriptions.json"
echo "Бот перевірятиме проходження МКС кожні 5 хвилин"
python3 bot.py
