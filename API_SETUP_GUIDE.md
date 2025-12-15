# Launcher API Setup Guide

This guide explains how to set up the launcher authentication API on XAMPP (or any PHP server).

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
- XAMPP (or any web server with PHP 7.4+ and MySQL)
- Basic knowledge of PHP and MySQL

**Download XAMPP:**
- Windows: https://www.apachefriends.org/download.html
- macOS/Linux: https://www.apachefriends.org/download.html

---

## Quick Start

### 1. Install XAMPP

1. Download and install XAMPP
2. Start Apache and MySQL from XAMPP Control Panel

### 2. Create Database

1. Open phpMyAdmin: http://localhost/phpmyadmin
2. Click "New" to create a database
3. Name it: `metin2_launcher`
4. Click "Create"

### 3. Import Database Schema

1. Select your `metin2_launcher` database
2. Click "Import" tab
3. Click "Choose File" and select `database_schema.sql`
4. Click "Go" at the bottom
5. You should see "Import has been successfully finished"

### 4. Configure the API

1. Open `example_launcher_api.php` in a text editor
2. Update the configuration section:

```php
// Database Configuration
define('DB_HOST', 'localhost');        // Keep as localhost for XAMPP
define('DB_NAME', 'metin2_launcher');  // Keep as metin2_launcher
define('DB_USER', 'root');             // Default XAMPP username
define('DB_PASS', '');                 // Default XAMPP password (empty)

// API Security
define('API_KEY', 'your_secure_api_key'); // Change this to a random string
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

The database schema creates 3 tables:

**1. users** - Stores user accounts
- `id` - Unique user ID
- `username` - Username (3-20 characters)
- `email` - Email address
- `password_hash` - Bcrypt hashed password
- `created_at` - Account creation date
- `last_login` - Last login timestamp
- `last_ip` - Last IP address
- `is_banned` - Ban status (0 or 1)
- `is_verified` - Email verification status

**2. login_attempts** - Rate limiting and security
- `id` - Attempt ID
- `username` - Username attempted
- `ip_address` - IP address
- `success` - Whether login succeeded (0 or 1)
- `attempt_time` - When the attempt occurred

**3. sessions** - Optional persistent login tokens
- `id` - Session ID
- `user_id` - User ID
- `session_token` - Unique token
- `ip_address` - Client IP
- `created_at` - Session creation time
- `expires_at` - When session expires

### Test User Account

The database includes a test account:
- **Username:** `testuser`
- **Password:** `password123`
- **Email:** `test@example.com`

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
3. Verify database `metin2_launcher` exists
4. Check if MySQL port is 3306 (default)

### "Invalid API key"

**Problem:** API key doesn't match

**Solutions:**
1. Verify `API_KEY` in `example_launcher_api.php` matches launcher config
2. Check for extra spaces or quotes in the API key
3. Make sure you're sending the API key in the request

### "Table doesn't exist"

**Problem:** Database tables not created

**Solutions:**
1. Re-import `database_schema.sql` in phpMyAdmin
2. Check if you selected the correct database before importing
3. Verify no errors during import

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
- `username` (required) - Username or email
- `password` (required) - User password
- `api_key` (required) - API authentication key

**Success Response:**
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

**Error Responses:**
- `Invalid username or password` (400)
- `Your account has been banned` (400)
- `Too many login attempts` (429)

### POST /launcher-api.php?action=register

**Parameters:**
- `username` (required) - 3-20 characters, alphanumeric + underscore
- `email` (required) - Valid email address
- `password` (required) - Minimum 6 characters
- `api_key` (required) - API authentication key

**Success Response:**
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

**Error Responses:**
- `Username already exists` (400)
- `Email already registered` (400)
- `Invalid email format` (400)
- `Password must be at least 6 characters` (400)

### POST /launcher-api.php?action=user_info

**Parameters:**
- `user_id` (required) - User ID
- `api_key` (required) - API authentication key

**Success Response:**
```json
{
  "success": true,
  "message": "User info retrieved",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "created_at": "2025-01-15 10:30:00",
    "last_login": "2025-01-15 14:20:00"
  }
}
```

---

## Database Maintenance

### Backup Database

**Via phpMyAdmin:**
1. Select `metin2_launcher` database
2. Click "Export" tab
3. Choose "Quick" export method
4. Click "Go"
5. Save the `.sql` file

**Via Command Line:**
```bash
mysqldump -u root -p metin2_launcher > backup_$(date +%Y%m%d).sql
```

### Clean Old Login Attempts

```sql
DELETE FROM login_attempts
WHERE attempt_time < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### Optimize Tables

```sql
OPTIMIZE TABLE users;
OPTIMIZE TABLE login_attempts;
OPTIMIZE TABLE sessions;
```

### View Statistics

```sql
-- Total users
SELECT COUNT(*) as total_users FROM users;

-- Users registered today
SELECT COUNT(*) as new_users_today
FROM users
WHERE DATE(created_at) = CURDATE();

-- Failed login attempts in last hour
SELECT COUNT(*) as failed_attempts
FROM login_attempts
WHERE success = 0
AND attempt_time > DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Most active users
SELECT u.username, COUNT(*) as login_count
FROM login_attempts la
JOIN users u ON la.username = u.username
WHERE la.success = 1
AND la.attempt_time > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY u.username
ORDER BY login_count DESC
LIMIT 10;
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
