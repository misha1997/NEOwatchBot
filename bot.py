"""NEOwatch Bot - Track asteroids and satellites
Refactored version with modular architecture
"""
import logging
from telegram import Update
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    MessageHandler, filters, ContextTypes
)

# Import configuration
from config import BOT_TOKEN

# Import database
from database import init_db

# Import handlers
from handlers import CommandHandlers, CallbackHandlers, MessageHandlers

# Import scheduler
from services.scheduler import NotificationScheduler

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


async def post_init(application: Application):
    """Run after bot initialization"""
    # Start scheduler as background task
    scheduler = NotificationScheduler()
    application.create_task(scheduler.run_scheduled_tasks())
    logger.info("Scheduler started")


def main():
    """Start the bot"""
    # Initialize database
    init_db()
    logger.info("Database initialized")
    
    # Create Application
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Add post_init handler
    application.post_init = post_init
    
    # Add handlers
    application.add_handler(CommandHandler("start", CommandHandlers.start))
    application.add_handler(CommandHandler("help", CommandHandlers.help))
    application.add_handler(CallbackQueryHandler(CallbackHandlers.handle))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, MessageHandlers.handle))
    
    # Start bot
    logger.info("Starting NEOwatch bot...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
