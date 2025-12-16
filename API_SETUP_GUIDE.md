# Metin2 Launcher API Setup Guide

This guide explains how to set up the launcher authentication API for **Metin2 private servers** on XAMPP (or any PHP server).

**IMPORTANT:** This API is designed to work with Metin2's EXISTING database structure. It does NOT create a new database or replace your existing account system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Testing the API](#testing-the-api)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

**Required:**
- XAMPP with MySQL 5.7 or lower (or MariaDB 10.1 or lower)
  - **Important:** Newer MySQL versions removed the PASSWORD() function
  - If using MySQL 8+, you'll need to modify the API to use a different hashing method
- PHP 7.4 or higher
- **Existing Metin2 database** with the "account" table
- Basic knowledge of PHP and MySQL

**Download XAMPP:**
- Windows: https://www.apachefriends.org/download.html
- macOS/Linux: https://www.apachefriends.org/download.html

**Recommended:** Use XAMPP with MySQL 5.7 for full Metin2 compatibility

---

## Quick Start

### 1. Install XAMPP

1. Download and install XAMPP (with MySQL 5.7 or lower recommended)
2. Start Apache and MySQL from XAMPP Control Panel

### 2. Use Your Existing Metin2 Database

**DO NOT create a new database!** You should already have Metin2's "account" database.

1. Open phpMyAdmin: http://localhost/phpmyadmin
2. You should see your existing "account" database
3. If you don't have it, create it and add the Metin2 account table structure

### 3. Import Database Schema

**This only adds the login_attempts table, it does NOT modify your existing account table.**

1. Select your existing `account` database in phpMyAdmin
2. Click "Import" tab
3. Click "Choose File" and select `database_schema.sql`
4. Click "Go" at the bottom
5. You should see "Import has been successfully finished"

**What this does:**
- Creates `login_attempts` table for rate limiting
- Creates `launcher_sessions` table for persistent logins (optional)
- Adds a test account (optional, can be removed)
- Does NOT modify your existing `account` table

### 4. Configure the API

1. Open `example_launcher_api.php` in a text editor
2. Update the configuration section:

```php
// Database Configuration
define('DB_HOST', 'localhost');        // Keep as localhost for XAMPP
define('DB_NAME', 'account');          // Your Metin2 account database name
define('DB_USER', 'root');             // Default XAMPP username
define('DB_PASS', '');                 // Default XAMPP password (empty)

// API Security
define('API_KEY', 'your_secure_api_key'); // Change this to a random string

// Enable/Disable Features
define('ENABLE_REGISTRATION', false);  // Set to true if you want to allow new accounts
```

### 5. Upload API File

1. Copy `example_launcher_api.php` to: `C:\xampp\htdocs\launcher-api.php`
   (or `/Applications/XAMPP/htdocs/launcher-api.php` on Mac)

### 6. Test the API

Open your browser and go to:
```
http://localhost/launcher-api.php
```

You should see:
```json
{"success":false,"error":"Only POST requests are allowed"}
```

This means the API is working!

### 7. Update Launcher Configuration

1. Open `app/assets/js/scripts/landing.js` in your launcher project
2. Update the configuration:

```javascript
const API_URL = 'http://localhost/launcher-api.php'
const API_KEY = 'your_secure_api_key'  // Must match API_KEY in PHP file
```

---

## Detailed Setup

### Database Structure

**Metin2's Existing Account Table** (NOT created by our schema):

**1. account** - Metin2's existing accounts table
- `id` - Unique account ID
- `login` - Username (4-16 characters in Metin2)
- `password` - Password hashed with MySQL PASSWORD() function (format: *HEX...)
- `email` - Email address
- `social_id` - Korean-style social security number (can be fake)
- `status` - Account status (OK, BLOCK, etc.)
- `create_time` - Account creation timestamp
- `last_play` - Last login timestamp
- Other Metin2-specific fields...

**New Tables Added by Our Schema:**

**2. login_attempts** - Rate limiting and security
- `id` - Attempt ID
- `username` - Username attempted
- `ip_address` - IP address
- `success` - Whether login succeeded (0 or 1)
- `attempt_time` - When the attempt occurred

**3. launcher_sessions** - Optional persistent login tokens
- `id` - Session ID
- `account_id` - Metin2 account ID
- `session_token` - Unique token
- `ip_address` - Client IP
- `created_at` - Session creation time
- `expires_at` - When session expires

### Understanding Metin2 Password Format

**CRITICAL:** Metin2 uses MySQL's old PASSWORD() function, NOT bcrypt or modern hashing!

**Example password hash in Metin2:**
```
Password: "password123"
Stored in DB: "*E56A114692FE0DE073F9A1DD68A00EEB9703F3F1"
```

**How it works:**
```sql
-- Creating a password (during registration)
INSERT INTO account (login, password) VALUES ('testuser', PASSWORD('password123'));

-- Verifying a password (during login)
SELECT * FROM account WHERE login = 'testuser' AND password = PASSWORD('password123');
```

The API automatically handles this using prepared statements for security.

### Test Account

The database schema includes an optional test account:
- **Username:** `testuser`
- **Password:** `password123`
- **Format:** Uses PASSWORD('password123') - Metin2 compatible

**IMPORTANT:** Delete or change this account in production!

---

## Testing the API

### Using Postman or cURL

**Test Login:**

```bash
curl -X POST http://localhost/launcher-api.php \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=login&username=testuser&password=password123&api_key=your_secure_api_key"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user_id": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

**Test Registration:**

```bash
curl -X POST http://localhost/launcher-api.php \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=register&username=newuser&email=new@example.com&password=mypassword&api_key=your_secure_api_key"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration successful! You can now login.",
  "data": {
    "user_id": 2,
    "username": "newuser"
  }
}
```

### Using Browser Console

Open your launcher and press F12, then in console:

```javascript
fetch('http://localhost/launcher-api.php', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    action: 'login',
    username: 'testuser',
    password: 'password123',
    api_key: 'your_secure_api_key'
  })
})
.then(r => r.json())
.then(console.log)
```

---

## Troubleshooting

### "Database connection failed"

**Problem:** Can't connect to MySQL

**Solutions:**
1. Make sure MySQL is running in XAMPP Control Panel
2. Check database credentials in `example_launcher_api.php`
3. Verify database `account` exists (your Metin2 database)
4. Check if MySQL port is 3306 (default)

### "Table doesn't exist"

**Problem:** Error about missing tables

**Solutions:**
1. Make sure you selected the `account` database before importing
2. Re-import `database_schema.sql` in phpMyAdmin
3. Check if `login_attempts` table was created successfully
4. Verify you're connecting to the correct database

### "PASSWORD function doesn't exist" or "FUNCTION PASSWORD does not exist"

**Problem:** MySQL 8.0+ removed the PASSWORD() function

**Solutions:**
1. **Recommended:** Downgrade to MySQL 5.7 or use MariaDB 10.1
2. **Alternative:** Modify the API to use old_password() or a different hashing method
3. **For advanced users:** Implement SHA1 hashing to match Metin2's format manually

**Note:** Metin2 was designed for older MySQL versions. Using MySQL 5.7 or MariaDB ensures full compatibility.

### "Invalid API key"

**Problem:** API key doesn't match

**Solutions:**
1. Verify `API_KEY` in `example_launcher_api.php` matches launcher config
2. Check for extra spaces or quotes in the API key
3. Make sure you're sending the API key in the request

### Account table issues

**Problem:** Can't find account table or data

**Solutions:**
1. Make sure you're using the existing Metin2 `account` database
2. Verify the `account` table exists with proper structure
3. Don't try to create a new database - use the existing one
4. Check that you have accounts in the table to test with

### "Only POST requests are allowed"

**Problem:** Trying to access API via GET (browser)

**Solutions:**
- This is normal! The API only accepts POST requests
- Use Postman, cURL, or the launcher to test
- If you see this message, your API is working!

### CORS Errors

**Problem:** "Access-Control-Allow-Origin" errors

**Solutions:**
1. Check CORS headers in `example_launcher_api.php`
2. Change `Access-Control-Allow-Origin: *` to your specific domain
3. Make sure headers are sent before any output

### Rate Limiting Issues

**Problem:** "Too many login attempts"

**Solutions:**
1. Wait 5 minutes and try again
2. Increase `MAX_LOGIN_ATTEMPTS` in the API config
3. Clear old attempts: `DELETE FROM login_attempts WHERE ip_address = 'YOUR_IP'`

---

## Security

### Production Deployment Checklist

**Before going live:**

- [ ] Change `API_KEY` to a strong random string (32+ characters)
- [ ] Set `display_errors = 0` in API file
- [ ] Delete or change test user account
- [ ] Update CORS to allow only your domain
- [ ] Use HTTPS (SSL certificate)
- [ ] Create dedicated MySQL user (don't use root)
- [ ] Set strong database password
- [ ] Enable MySQL remote access only from localhost
- [ ] Configure firewall rules
- [ ] Set up regular database backups
- [ ] Monitor `login_attempts` table for attacks
- [ ] Consider implementing 2FA
- [ ] Enable audit logging

### Generate Secure API Key

**Method 1 - PHP:**
```php
echo bin2hex(random_bytes(32));
```

**Method 2 - Online:**
Visit: https://www.grc.com/passwords.htm

**Method 3 - Command Line:**
```bash
openssl rand -hex 32
```

### Create Dedicated Database User

```sql
-- Create new user
CREATE USER 'launcher_user'@'localhost' IDENTIFIED BY 'strong_password_here';

-- Grant only necessary permissions
GRANT SELECT, INSERT, UPDATE ON metin2_launcher.* TO 'launcher_user'@'localhost';

-- Refresh privileges
FLUSH PRIVILEGES;
```

Then update API config:
```php
define('DB_USER', 'launcher_user');
define('DB_PASS', 'strong_password_here');
```

---

## Advanced Configuration

### Enable SSL/HTTPS

1. Get SSL certificate (Let's Encrypt is free)
2. Configure Apache to use SSL
3. Update launcher API URL to `https://yoursite.com/launcher-api.php`

### Custom Password Requirements

Edit the `handleRegister` function:

```php
// Require uppercase, lowercase, number, special char
if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/', $password)) {
    sendError('Password must be 8+ chars with uppercase, lowercase, number, and special character');
}
```

### Email Verification

To implement email verification:

1. Set `REQUIRE_EMAIL_VERIFICATION = true`
2. Install a mail library like PHPMailer
3. Send verification email on registration
4. Create verification endpoint
5. Update `is_verified` when user clicks link

### Session Management

To implement persistent login:

1. Generate session token on login:
```php
$token = bin2hex(random_bytes(64));
$stmt = $pdo->prepare("
    INSERT INTO sessions (user_id, session_token, ip_address, created_at, expires_at, last_activity)
    VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())
");
$stmt->execute([$userId, $token, $ip]);
```

2. Return token to launcher
3. Store token in launcher
4. Validate token on subsequent requests

### Rate Limiting Customization

Adjust rate limiting in config:

```php
define('MAX_LOGIN_ATTEMPTS', 10);    // Allow 10 attempts
define('RATE_LIMIT_WINDOW', 600);    // Per 10 minutes
```

Or disable entirely:
```php
define('ENABLE_RATE_LIMITING', false);
```

### IP Whitelist

Add IP whitelist for testing:

```php
$whitelistedIPs = ['127.0.0.1', '::1'];

if (!in_array(getClientIP(), $whitelistedIPs)) {
    // Apply rate limiting
}
```

### Logging

Enable detailed logging:

```php
function logToFile($message) {
    $logFile = 'launcher_api.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}
```

---

## API Endpoints Reference

### POST /launcher-api.php?action=login

**Parameters:**
- `username` (required) - Metin2 username (4-16 characters)
- `password` (required) - Account password (plaintext - will be hashed with PASSWORD())
- `api_key` (required) - API authentication key

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "account_id": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

**Error Responses:**
- `Invalid username or password` (400)
- `Your account has been banned` (400) - when status is BLOCK
- `Too many login attempts` (429)

**Note:** Password is sent as plaintext over POST but should use HTTPS in production. The API converts it using MySQL's PASSWORD() function to match Metin2's format.

### POST /launcher-api.php?action=register

**Parameters:**
- `username` (required) - 4-16 characters, alphanumeric + underscore (Metin2 format)
- `email` (required) - Valid email address
- `password` (required) - Minimum 4 characters
- `social_id` (optional) - Default: "000000-0000000"
- `api_key` (required) - API authentication key

**Success Response:**
```json
{
  "success": true,
  "message": "Registration successful! You can now login.",
  "data": {
    "account_id": 2,
    "username": "newuser"
  }
}
```

**Error Responses:**
- `Registration is disabled` (400) - if ENABLE_REGISTRATION is false
- `Username already exists` (400)
- `Email already registered` (400)
- `Invalid email format` (400)
- `Password must be at least 4 characters` (400)

**Note:** Passwords are hashed using MySQL's PASSWORD() function to match Metin2's format.

### POST /launcher-api.php?action=user_info

**Parameters:**
- `account_id` (required) - Metin2 account ID
- `user_id` (alternative) - Also accepts user_id for compatibility
- `api_key` (required) - API authentication key

**Success Response:**
```json
{
  "success": true,
  "message": "Account info retrieved",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "created_at": "2025-01-15 10:30:00",
    "last_login": "2025-01-15 14:20:00",
    "status": "OK"
  }
}
```

---

## Database Maintenance

### Backup Database

**IMPORTANT:** Always backup your Metin2 account database regularly!

**Via phpMyAdmin:**
1. Select `account` database
2. Click "Export" tab
3. Choose "Quick" export method (or "Custom" for more options)
4. Click "Go"
5. Save the `.sql` file securely

**Via Command Line:**
```bash
# Backup entire account database
mysqldump -u root -p account > backup_account_$(date +%Y%m%d).sql

# Backup only launcher-related tables
mysqldump -u root -p account login_attempts launcher_sessions > backup_launcher_$(date +%Y%m%d).sql
```

### Clean Old Login Attempts

Run this query periodically to keep the database clean:

```sql
DELETE FROM login_attempts
WHERE attempt_time < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

Or use the stored procedure (if you imported the full schema):
```sql
CALL cleanup_launcher_data();
```

### Optimize Tables

```sql
OPTIMIZE TABLE account;
OPTIMIZE TABLE login_attempts;
OPTIMIZE TABLE launcher_sessions;
```

### View Statistics

```sql
-- Total accounts
SELECT COUNT(*) as total_accounts FROM account;

-- Accounts created today
SELECT COUNT(*) as new_accounts_today
FROM account
WHERE DATE(create_time) = CURDATE();

-- Failed login attempts in last hour
SELECT COUNT(*) as failed_attempts
FROM login_attempts
WHERE success = 0
AND attempt_time > DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Most active accounts (by successful logins)
SELECT a.login, COUNT(*) as login_count
FROM login_attempts la
JOIN account a ON la.username = a.login
WHERE la.success = 1
AND la.attempt_time > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY a.login
ORDER BY login_count DESC
LIMIT 10;

-- Accounts by status
SELECT status, COUNT(*) as count
FROM account
GROUP BY status;

-- Check password format for debugging
SELECT id, login, LEFT(password, 10) as password_preview
FROM account
LIMIT 5;
-- Should show passwords starting with * like: *E56A11469...
```

---

## Support

If you encounter issues:

1. Check XAMPP error logs: `C:\xampp\apache\logs\error.log`
2. Check PHP error logs: Look in XAMPP control panel
3. Enable error reporting in PHP file (development only!)
4. Check browser console for errors
5. Verify all file permissions are correct

---

## License

This example API is provided as-is for the Metin2 private server community.
Feel free to modify and use it for your own server.
