<?php
// php/config.php
// Database and application configuration

// Database configuration
define('DB_PATH', __DIR__ . '/../data/northstar.db');

// Function to get database connection
function getDb()
{
    try {
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Enable foreign key support
        $db->exec('PRAGMA foreign_keys = ON;');

        return $db;
    } catch (PDOException $e) {
        die('Database connection failed: ' . $e->getMessage());
    }
}

// Application settings
define('ROUTE_EXPIRATION_MULTIPLIER', 2); // Route expiration is 2x the ETA
define('DEFAULT_DRIVER_NAME', 'Not Assigned');

// Helper functions
function generateShareToken($length = 10)
{
    $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $token = '';
    for ($i = 0; $i < $length; $i++) {
        $token .= $characters[rand(0, strlen($characters) - 1)];
    }
    return $token;
}

// Response helper functions
function jsonResponse($data, $statusCode = 200)
{
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function errorResponse($message, $statusCode = 400)
{
    jsonResponse(['error' => $message], $statusCode);
}
