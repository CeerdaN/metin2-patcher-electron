<?php
/**
 * Example Launcher API
 *
 * This is a working example of a launcher authentication API.
 * You can run this on XAMPP or any PHP server with MySQL.
 *
 * FEATURES:
 * - User login authentication
 * - Secure password hashing (bcrypt)
 * - API key validation
 * - JSON responses
 * - Error handling
 * - Basic rate limiting
 *
 * REQUIREMENTS:
 * - PHP 7.4 or higher
 * - MySQL database
 * - PDO extension enabled
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a MySQL database (see schema below)
 * 2. Update the database configuration section
 * 3. Update the API_KEY to match your launcher configuration
 * 4. Upload to your web server
 * 5. Test with the launcher
 */

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================================

// Database Configuration
define('DB_HOST', 'localhost');           // Usually 'localhost' for XAMPP
define('DB_NAME', 'metin2_launcher');     // Your database name
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
define('REQUIRE_EMAIL_VERIFICATION', false); // Require email verification (implement separately)

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

    // Sanitize username
    if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
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

    // Find user in database
    try {
        $stmt = $pdo->prepare("
            SELECT id, username, password_hash, email, is_banned, is_verified
            FROM users
            WHERE username = ? OR email = ?
            LIMIT 1
        ");
        $stmt->execute([$username, $username]);
        $user = $stmt->fetch();

        // User not found
        if (!$user) {
            logLoginAttempt($pdo, $username, $ip, false);
            sendError('Invalid username or password');
        }

        // Check if banned
        if ($user['is_banned']) {
            logLoginAttempt($pdo, $username, $ip, false);
            sendError('Your account has been banned');
        }

        // Check if email verified (if enabled)
        if (REQUIRE_EMAIL_VERIFICATION && !$user['is_verified']) {
            logLoginAttempt($pdo, $username, $ip, false);
            sendError('Please verify your email address first');
        }

        // Verify password
        if (!password_verify($password, $user['password_hash'])) {
            logLoginAttempt($pdo, $username, $ip, false);
            sendError('Invalid username or password');
        }

        // Update last login
        $stmt = $pdo->prepare("
            UPDATE users
            SET last_login = NOW(),
                last_ip = ?
            WHERE id = ?
        ");
        $stmt->execute([$ip, $user['id']]);

        // Log successful login
        logLoginAttempt($pdo, $username, $ip, true);

        // Send success response
        sendSuccess('Login successful', [
            'user_id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email']
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
    // Validate required fields
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($email) || empty($password)) {
        sendError('All fields are required');
    }

    // Validate username format
    if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
        sendError('Username must be 3-20 characters (letters, numbers, underscore only)');
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendError('Invalid email format');
    }

    // Validate password strength
    if (strlen($password) < 6) {
        sendError('Password must be at least 6 characters');
    }

    try {
        // Check if username exists
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            sendError('Username already exists');
        }

        // Check if email exists
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            sendError('Email already registered');
        }

        // Hash password
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        // Insert user
        $stmt = $pdo->prepare("
            INSERT INTO users (username, email, password_hash, created_at, last_ip)
            VALUES (?, ?, ?, NOW(), ?)
        ");
        $stmt->execute([$username, $email, $passwordHash, getClientIP()]);

        $userId = $pdo->lastInsertId();

        // Send success response
        sendSuccess('Registration successful! You can now login.', [
            'user_id' => $userId,
            'username' => $username
        ]);

    } catch (PDOException $e) {
        error_log("Registration error: " . $e->getMessage());
        sendError('An error occurred during registration', 500);
    }
}

/**
 * Handle user info request
 */
function handleUserInfo($pdo) {
    $userId = intval($_POST['user_id'] ?? 0);

    if ($userId <= 0) {
        sendError('Invalid user ID');
    }

    try {
        $stmt = $pdo->prepare("
            SELECT id, username, email, created_at, last_login
            FROM users
            WHERE id = ?
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            sendError('User not found');
        }

        sendSuccess('User info retrieved', $user);

    } catch (PDOException $e) {
        error_log("User info error: " . $e->getMessage());
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
