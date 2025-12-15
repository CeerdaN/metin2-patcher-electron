-- ============================================================================
-- Metin2 Launcher Database Schema
-- ============================================================================
--
-- This SQL file creates the necessary database tables for the launcher API
--
-- INSTALLATION INSTRUCTIONS:
-- 1. Open phpMyAdmin (http://localhost/phpmyadmin)
-- 2. Create a new database called 'metin2_launcher'
-- 3. Select the database
-- 4. Click 'Import' tab
-- 5. Choose this file and click 'Go'
--
-- OR use command line:
-- mysql -u root -p metin2_launcher < database_schema.sql
--
-- ============================================================================

-- Create database (if not exists)
CREATE DATABASE IF NOT EXISTS metin2_launcher CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE metin2_launcher;

-- ============================================================================
-- Table: users
-- Stores user account information
-- ============================================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL,
  `last_login` DATETIME DEFAULT NULL,
  `last_ip` VARCHAR(45) DEFAULT NULL,
  `is_banned` TINYINT(1) NOT NULL DEFAULT 0,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `verification_token` VARCHAR(64) DEFAULT NULL,
  `reset_token` VARCHAR(64) DEFAULT NULL,
  `reset_token_expires` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: login_attempts
-- Tracks login attempts for rate limiting and security
-- ============================================================================

CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(20) DEFAULT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `attempt_time` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ip_time` (`ip_address`, `attempt_time`),
  KEY `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: sessions (Optional - for persistent login tokens)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) UNSIGNED NOT NULL,
  `session_token` VARCHAR(128) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `last_activity` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_expires` (`expires_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Insert sample test user
-- Username: testuser
-- Password: password123
-- ============================================================================

-- Note: This is the bcrypt hash of 'password123'
INSERT INTO `users` (
  `username`,
  `email`,
  `password_hash`,
  `created_at`,
  `is_verified`
) VALUES (
  'testuser',
  'test@example.com',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password123
  NOW(),
  1
);

-- ============================================================================
-- Indexes for better performance
-- ============================================================================

-- Add composite index for faster rate limiting queries
ALTER TABLE `login_attempts`
ADD INDEX `idx_ip_time_success` (`ip_address`, `attempt_time`, `success`);

-- Add index for faster session lookups
ALTER TABLE `sessions`
ADD INDEX `idx_token_expires` (`session_token`, `expires_at`);

-- ============================================================================
-- Optional: Create stored procedure for cleanup
-- ============================================================================

DELIMITER $$

CREATE PROCEDURE `cleanup_old_data`()
BEGIN
    -- Delete login attempts older than 7 days
    DELETE FROM `login_attempts`
    WHERE `attempt_time` < DATE_SUB(NOW(), INTERVAL 7 DAY);

    -- Delete expired sessions
    DELETE FROM `sessions`
    WHERE `expires_at` < NOW();
END$$

DELIMITER ;

-- ============================================================================
-- Optional: Create event for automatic cleanup (requires event scheduler)
-- ============================================================================

-- Enable event scheduler (add this to my.cnf if not enabled)
-- SET GLOBAL event_scheduler = ON;

CREATE EVENT IF NOT EXISTS `daily_cleanup`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
CALL cleanup_old_data();

-- ============================================================================
-- Sample queries for testing
-- ============================================================================

-- Check if user exists
-- SELECT * FROM users WHERE username = 'testuser';

-- Check recent login attempts
-- SELECT * FROM login_attempts ORDER BY attempt_time DESC LIMIT 10;

-- Check failed login attempts in last hour
-- SELECT COUNT(*) FROM login_attempts
-- WHERE success = 0
-- AND attempt_time > DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Get active sessions
-- SELECT s.*, u.username
-- FROM sessions s
-- JOIN users u ON s.user_id = u.id
-- WHERE s.expires_at > NOW();

-- ============================================================================
-- Additional Notes
-- ============================================================================

/*
SECURITY RECOMMENDATIONS:

1. Change the default test user password immediately
2. Use strong, unique passwords for all accounts
3. Enable SSL/TLS for your database connection
4. Regularly backup your database
5. Set up proper database user permissions (don't use root!)
6. Monitor login_attempts table for suspicious activity
7. Consider implementing two-factor authentication
8. Use prepared statements (already done in the API)
9. Keep your PHP and MySQL versions updated
10. Set display_errors = 0 in production

PERFORMANCE TIPS:

1. Add indexes based on your query patterns
2. Archive old login_attempts data regularly
3. Use connection pooling if possible
4. Monitor slow query log
5. Optimize table periodically: OPTIMIZE TABLE users;

BACKUP COMMANDS:

-- Backup entire database:
mysqldump -u root -p metin2_launcher > backup.sql

-- Backup only structure (no data):
mysqldump -u root -p --no-data metin2_launcher > structure.sql

-- Restore from backup:
mysql -u root -p metin2_launcher < backup.sql
*/
