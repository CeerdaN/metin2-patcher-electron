<?php
/**
 * Metin2 Launcher Authentication API
 *
 * This is a working example API designed specifically for Metin2 private servers.
 * It works with Metin2's EXISTING database structure and password hashing system.
 *
 * IMPORTANT FOR METIN2 SERVERS:
 * - Uses Metin2's existing "account" database and "account" table
 * - Uses MySQL's PASSWORD() function (Metin2's native password format)
 * - Does NOT create new tables or modify existing Metin2 database
 * - Password format: *E56A114692FE0DE073F9A1DD68A00EEB9703F3F1 (MySQL PASSWORD)
 *
 * FEATURES:
 * - Account login authentication (compatible with Metin2)
 * - Optional account registration (uses Metin2's PASSWORD() function)
 * - API key validation
 * - JSON responses
 * - Error handling
 * - Rate limiting for security
 * - Login attempt tracking
 *
 * REQUIREMENTS:
 * - PHP 7.4 or higher
 * - MySQL 5.7 or lower (for PASSWORD() function support)
 *   OR MariaDB 10.1 or lower
 * - PDO extension enabled
 * - Existing Metin2 database with "account" table
 *
 * SETUP INSTRUCTIONS:
 * 1. Import database_schema.sql into your "account" database (adds login_attempts table)
 * 2. Update the database configuration section below
 * 3. Update the API_KEY to match your launcher configuration
 * 4. Upload to your web server
 * 5. Test with the launcher or test_api.html
 */

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================================

// Database Configuration
define('DB_HOST', 'localhost');           // Usually 'localhost' for XAMPP
define('DB_NAME', 'account');             // Metin2's account database name
define('DB_USER', 'root');                // Your MySQL username (default: root for XAMPP)
define('DB_PASS', '');                    // Your MySQL password (default: empty for XAMPP)

// API Security
define('API_KEY', 'your_secure_api_key'); // Must match launcher config (app/assets/js/scripts/landing.js)

// Rate Limiting
define('MAX_LOGIN_ATTEMPTS', 5);          // Max login attempts per IP
define('RATE_LIMIT_WINDOW', 300);         // Time window in seconds (5 minutes)

// Enable/Disable Features
define('ENABLE_RATE_LIMITING', true);     // Enable rate limiting
define('ENABLE_LOGGING', true);           // Enable login attempt logging
define('ENABLE_REGISTRATION', false);     // Allow new account registration (disable for existing servers)

// ============================================================================
// ERROR REPORTING (Disable in production!)
// ============================================================================

error_reporting(E_ALL);
ini_set('display_errors', 1); // Set to 0 in production!

// ============================================================================
// CORS HEADERS (Allow launcher to connect)
// ============================================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Change to specific domain in production
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    sendError('Database connection failed', 500);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send JSON success response
 */
function sendSuccess($message, $data = null) {
    $response = [
        'success' => true,
        'message' => $message
    ];

    if ($data !== null) {
        $response['data'] = $data;
    }

    echo json_encode($response);
    exit();
}

/**
 * Send JSON error response
 */
function sendError($message, $code = 400) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $message
    ]);
    exit();
}

/**
 * Validate API key
 */
function validateApiKey() {
    $headers = getallheaders();
    $apiKey = $_POST['api_key'] ?? $headers['X-API-Key'] ?? null;

    if ($apiKey !== API_KEY) {
        sendError('Invalid API key', 403);
    }
}

/**
 * Get client IP address
 */
function getClientIP() {
    $ip = $_SERVER['REMOTE_ADDR'];

    // Check for proxy
    if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    } elseif (isset($_SERVER['HTTP_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_CLIENT_IP'];
    }

    return $ip;
}

/**
 * Check rate limiting
 */
function checkRateLimit($pdo, $ip) {
    if (!ENABLE_RATE_LIMITING) {
        return true;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*) as attempt_count
        FROM login_attempts
        WHERE ip_address = ?
        AND attempt_time > DATE_SUB(NOW(), INTERVAL ? SECOND)
    ");

    $stmt->execute([$ip, RATE_LIMIT_WINDOW]);
    $result = $stmt->fetch();

    if ($result['attempt_count'] >= MAX_LOGIN_ATTEMPTS) {
        sendError('Too many login attempts. Please try again later.', 429);
    }

    return true;
}

/**
 * Log login attempt
 */
function logLoginAttempt($pdo, $username, $ip, $success) {
    if (!ENABLE_LOGGING) {
        return;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO login_attempts (username, ip_address, success, attempt_time)
            VALUES (?, ?, ?, NOW())
        ");
        $stmt->execute([$username, $ip, $success ? 1 : 0]);
    } catch (PDOException $e) {
        // Don't fail if logging fails
        error_log("Failed to log login attempt: " . $e->getMessage());
    }
}

/**
 * Clean old login attempts (cleanup)
 */
function cleanOldAttempts($pdo) {
    try {
        $stmt = $pdo->prepare("
            DELETE FROM login_attempts
            WHERE attempt_time < DATE_SUB(NOW(), INTERVAL 1 DAY)
        ");
        $stmt->execute();
    } catch (PDOException $e) {
        // Don't fail if cleanup fails
    }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Handle login request
 */
function handleLogin($pdo) {
    // Validate required fields
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        sendError('Username and password are required');
    }

    // Sanitize username (Metin2 allows 4-16 characters)
    if (!preg_match('/^[a-zA-Z0-9_]{4,16}$/', $username)) {
        sendError('Invalid username format');
    }

    // Get client IP
    $ip = getClientIP();

    // Check rate limiting
    checkRateLimit($pdo, $ip);

    // Clean old attempts (randomly, 1% chance)
    if (rand(1, 100) === 1) {
        cleanOldAttempts($pdo);
    }

    // Find account in database using Metin2's PASSWORD() function
    try {
        // IMPORTANT: Metin2 uses MySQL's PASSWORD() function for password hashing
        // The password column stores hashes like: *E56A114692FE0DE073F9A1DD68A00EEB9703F3F1
        $stmt = $pdo->prepare("
            SELECT id, login, email, status
            FROM account
            WHERE login = ? AND password = PASSWORD(?)
            LIMIT 1
        ");
        $stmt->execute([$username, $password]);
        $account = $stmt->fetch();

        // Account not found or password incorrect
        if (!$account) {
            logLoginAttempt($pdo, $username, $ip, false);
            sendError('Invalid username or password');
        }

        // Check if banned (Metin2 uses 'status' field: OK, BLOCK, etc.)
        if ($account['status'] !== 'OK') {
            logLoginAttempt($pdo, $username, $ip, false);
            $statusMsg = ($account['status'] === 'BLOCK') ? 'banned' : 'suspended';
            sendError("Your account has been {$statusMsg}");
        }

        // Update last login (Metin2's last_play field)
        $stmt = $pdo->prepare("
            UPDATE account
            SET last_play = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$account['id']]);

        // Log successful login
        logLoginAttempt($pdo, $username, $ip, true);

        // Send success response
        sendSuccess('Login successful', [
            'account_id' => $account['id'],
            'username' => $account['login'],
            'email' => $account['email']
        ]);

    } catch (PDOException $e) {
        error_log("Login error: " . $e->getMessage());
        sendError('An error occurred during login', 500);
    }
}

/**
 * Handle registration request
 */
function handleRegister($pdo) {
    // Check if registration is enabled
    if (!ENABLE_REGISTRATION) {
        sendError('Registration is disabled. Please contact an administrator to create an account.');
    }

    // Validate required fields
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $socialId = trim($_POST['social_id'] ?? '000000-0000000'); // Metin2 requires social_id

    if (empty($username) || empty($email) || empty($password)) {
        sendError('All fields are required');
    }

    // Validate username format (Metin2 allows 4-16 characters)
    if (!preg_match('/^[a-zA-Z0-9_]{4,16}$/', $username)) {
        sendError('Username must be 4-16 characters (letters, numbers, underscore only)');
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendError('Invalid email format');
    }

    // Validate password strength
    if (strlen($password) < 4) {
        sendError('Password must be at least 4 characters');
    }

    try {
        // Check if username exists
        $stmt = $pdo->prepare("SELECT id FROM account WHERE login = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            sendError('Username already exists');
        }

        // Check if email exists
        $stmt = $pdo->prepare("SELECT id FROM account WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            sendError('Email already registered');
        }

        // Insert account using Metin2's PASSWORD() function
        // IMPORTANT: We use PASSWORD(?) to hash the password in Metin2 format
        $stmt = $pdo->prepare("
            INSERT INTO account (login, password, email, social_id, create_time)
            VALUES (?, PASSWORD(?), ?, ?, NOW())
        ");
        $stmt->execute([$username, $password, $email, $socialId]);

        $accountId = $pdo->lastInsertId();

        // Send success response
        sendSuccess('Registration successful! You can now login.', [
            'account_id' => $accountId,
            'username' => $username
        ]);

    } catch (PDOException $e) {
        error_log("Registration error: " . $e->getMessage());
        sendError('An error occurred during registration', 500);
    }
}

/**
 * Handle account info request
 */
function handleUserInfo($pdo) {
    $accountId = intval($_POST['account_id'] ?? $_POST['user_id'] ?? 0);

    if ($accountId <= 0) {
        sendError('Invalid account ID');
    }

    try {
        $stmt = $pdo->prepare("
            SELECT id, login, email, create_time, last_play, status
            FROM account
            WHERE id = ?
        ");
        $stmt->execute([$accountId]);
        $account = $stmt->fetch();

        if (!$account) {
            sendError('Account not found');
        }

        // Return account info (without sensitive data)
        sendSuccess('Account info retrieved', [
            'id' => $account['id'],
            'username' => $account['login'],
            'email' => $account['email'],
            'created_at' => $account['create_time'],
            'last_login' => $account['last_play'],
            'status' => $account['status']
        ]);

    } catch (PDOException $e) {
        error_log("Account info error: " . $e->getMessage());
        sendError('An error occurred', 500);
    }
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Only POST requests are allowed', 405);
}

// Validate API key
validateApiKey();

// Get action
$action = $_POST['action'] ?? '';

// Route to appropriate handler
switch ($action) {
    case 'login':
        handleLogin($pdo);
        break;

    case 'register':
        handleRegister($pdo);
        break;

    case 'user_info':
        handleUserInfo($pdo);
        break;

    default:
        sendError('Invalid action');
}

// ============================================================================
// END OF API
// ============================================================================
?>
