-- Migration script for NEOwatch Bot
-- Run this in MySQL to add new columns

USE neowatch;

-- Add new subscription columns to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscribed_neo BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS subscribed_news BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS subscribed_meteors BOOLEAN DEFAULT TRUE;

-- Create new tables for notification tracking

-- Launch notifications
CREATE TABLE IF NOT EXISTS launch_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    launch_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_launch_notification (launch_id, notification_type),
    INDEX idx_notified_at (notified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hazardous asteroid notifications
CREATE TABLE IF NOT EXISTS neo_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asteroid_id VARCHAR(255) NOT NULL,
    approach_date DATE NOT NULL,
    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_asteroid_date (asteroid_id, approach_date),
    INDEX idx_notified_at (notified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- News notifications
CREATE TABLE IF NOT EXISTS news_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    article_url VARCHAR(500) NOT NULL,
    article_title VARCHAR(500) NOT NULL,
    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_article_url (article_url),
    INDEX idx_notified_at (notified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meteor shower notifications
CREATE TABLE IF NOT EXISTS meteor_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shower_name VARCHAR(100) NOT NULL,
    peak_date DATE NOT NULL,
    notification_type VARCHAR(20) NOT NULL,
    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_shower_notification (shower_name, peak_date, notification_type),
    INDEX idx_notified_at (notified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add indexes for new columns
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_subscribed_neo (subscribed_neo);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_subscribed_news (subscribed_news);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_subscribed_meteors (subscribed_meteors);

-- Verify changes
DESCRIBE users;
SHOW TABLES;
