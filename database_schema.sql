-- ============================================================================
-- Metin2 Launcher Database Schema - For Metin2 Private Servers
-- ============================================================================
--
-- IMPORTANT: This file is designed to work with Metin2's EXISTING database!
-- Metin2 already has a database called "account" with a table "account"
--
-- This schema file creates ONLY the additional tables needed for launcher
-- features like login attempt tracking. It does NOT create or modify the
-- existing Metin2 account table.
--
-- INSTALLATION INSTRUCTIONS:
-- 1. Open phpMyAdmin (http://localhost/phpmyadmin)
-- 2. Select your EXISTING "account" database (not a new one!)
-- 3. Click 'Import' tab
-- 4. Choose this file and click 'Go'
--
-- OR use command line:
-- mysql -u root -p account < database_schema.sql
--
-- ============================================================================

-- Switch to your existing Metin2 account database
USE account;

-- ============================================================================
-- METIN2 ACCOUNT TABLE REFERENCE
-- ============================================================================
--
-- Metin2's existing 'account' table structure (DO NOT RUN - ALREADY EXISTS):
--
-- CREATE TABLE IF NOT EXISTS `account` (
--   `id` int(11) NOT NULL AUTO_INCREMENT,
--   `login` varchar(16) NOT NULL DEFAULT '',
--   `password` varchar(45) NOT NULL DEFAULT '',  -- MySQL PASSWORD() format: *HEX...
--   `social_id` varchar(13) NOT NULL DEFAULT '',
--   `email` varchar(64) NOT NULL DEFAULT '',
--   `status` varchar(8) NOT NULL DEFAULT 'OK',
--   `availDt` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
--   `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   `last_play` datetime DEFAULT NULL,
--   PRIMARY KEY (`id`),
--   UNIQUE KEY `login` (`login`),
--   KEY `social_id` (`social_id`)
-- ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
--
-- Password format: MySQL's old PASSWORD() function (e.g., *E56A114692FE0DE073F9A1DD68A00EEB9703F3F1)
-- ============================================================================

-- ============================================================================
-- Table: login_attempts
-- Tracks login attempts for rate limiting and security
-- NEW TABLE - This will be created
-- ============================================================================

CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(16) DEFAULT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `attempt_time` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ip_time` (`ip_address`, `attempt_time`),
  KEY `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: launcher_sessions (Optional - for persistent login tokens)
-- NEW TABLE - This will be created
-- ============================================================================

CREATE TABLE IF NOT EXISTS `launcher_sessions` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` INT(11) NOT NULL,
  `session_token` VARCHAR(128) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `last_activity` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  KEY `idx_account_id` (`account_id`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Insert sample test account (OPTIONAL - for testing)
-- Username: testuser
-- Password: password123
-- ============================================================================

-- ONLY USE THIS IF YOU WANT A TEST ACCOUNT!
-- The password is hashed using MySQL's old PASSWORD() function
-- This matches Metin2's password format

INSERT IGNORE INTO `account` (
  `login`,
  `password`,
  `social_id`,
  `email`,
  `create_time`
) VALUES (
  'testuser',
  PASSWORD('password123'),  -- This creates the *HEX format that Metin2 uses
  '000000-0000000',
  'test@example.com',
  NOW()
);

-- Note: PASSWORD() function creates hashes like: *E56A114692FE0DE073F9A1DD68A00EEB9703F3F1
-- This is the same format Metin2 uses natively

-- ============================================================================
-- Indexes for better performance
-- ============================================================================

-- Add composite index for faster rate limiting queries
ALTER TABLE `login_attempts`
ADD INDEX `idx_ip_time_success` (`ip_address`, `attempt_time`, `success`);

-- ============================================================================
-- Optional: Create stored procedure for cleanup
-- ============================================================================

DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS `cleanup_launcher_data`()
BEGIN
    -- Delete login attempts older than 7 days
    DELETE FROM `login_attempts`
    WHERE `attempt_time` < DATE_SUB(NOW(), INTERVAL 7 DAY);

    -- Delete expired sessions
    DELETE FROM `launcher_sessions`
    WHERE `expires_at` < NOW();
END$$

DELIMITER ;

-- ============================================================================
-- Optional: Create event for automatic cleanup (requires event scheduler)
-- ============================================================================

-- Enable event scheduler (add this to my.cnf if not enabled)
-- SET GLOBAL event_scheduler = ON;

CREATE EVENT IF NOT EXISTS `daily_launcher_cleanup`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
CALL cleanup_launcher_data();

-- ============================================================================
-- Sample queries for testing
-- ============================================================================

-- Check if account exists
-- SELECT * FROM account WHERE login = 'testuser';

-- Test password verification (replace 'password123' with actual password)
-- SELECT * FROM account WHERE login = 'testuser' AND password = PASSWORD('password123');

-- Check recent login attempts
-- SELECT * FROM login_attempts ORDER BY attempt_time DESC LIMIT 10;

-- Check failed login attempts in last hour
-- SELECT COUNT(*) FROM login_attempts
-- WHERE success = 0
-- AND attempt_time > DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Get active sessions
-- SELECT s.*, a.login
-- FROM launcher_sessions s
-- JOIN account a ON s.account_id = a.id
-- WHERE s.expires_at > NOW();

-- Check all accounts
-- SELECT id, login, email, create_time, last_play FROM account;

-- ============================================================================
-- Additional Notes
-- ============================================================================

/*
IMPORTANT FOR METIN2 SERVERS:

This schema is designed to work WITH your existing Metin2 database, NOT replace it.
It only adds two new tables:
1. login_attempts - For rate limiting and security
2. launcher_sessions - For persistent login tokens (optional)

Your existing 'account' table is NOT modified and will continue to work with your
Metin2 game server as normal.

PASSWORD FORMAT:
Metin2 uses MySQL's old PASSWORD() function which creates hashes like:
*E56A114692FE0DE073F9A1DD68A00EEB9703F3F1

To verify a password in your code:
SELECT * FROM account WHERE login = 'username' AND password = PASSWORD('user_input_password');

Or in PHP (recommended for the API):
$stmt = $pdo->prepare("SELECT * FROM account WHERE login = ? AND password = PASSWORD(?)");

SECURITY RECOMMENDATIONS:

1. Change the default test user password immediately
2. Use strong, unique passwords for all accounts
3. Enable SSL/TLS for your database connection
4. Regularly backup your database
5. Set up proper database user permissions (don't use root!)
6. Monitor login_attempts table for suspicious activity
7. Use prepared statements (already done in the API)
8. Keep your PHP and MySQL versions updated
9. Set display_errors = 0 in production
10. Consider using a firewall to restrict database access

PERFORMANCE TIPS:

1. Add indexes based on your query patterns
2. Archive old login_attempts data regularly
3. Use connection pooling if possible
4. Monitor slow query log
5. Optimize tables periodically: OPTIMIZE TABLE account;

BACKUP COMMANDS:

-- Backup entire account database:
mysqldump -u root -p account > backup_account.sql

-- Backup only structure (no data):
mysqldump -u root -p --no-data account > structure_account.sql

-- Restore from backup:
mysql -u root -p account < backup_account.sql

-- Backup only launcher tables:
mysqldump -u root -p account login_attempts launcher_sessions > backup_launcher_tables.sql
*/
