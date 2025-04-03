<?php
// php/db-init.php
// Initialize the SQLite database

// Database connection function
function getDbConnection()
{
    $dbFile = __DIR__ . '/../data/northstar.db';

    try {
        // Create SQLite database connection
        $db = new PDO('sqlite:' . $dbFile);

        // Set error mode to exceptions
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        return $db;
    } catch (PDOException $e) {
        die('Database connection failed: ' . $e->getMessage());
    }
}

// Create tables if they don't exist
function initializeTables()
{
    $db = getDbConnection();

    // Routes table
    $db->exec("CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        driver_id INTEGER,
        total_distance REAL DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        total_revenue REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        eta DATETIME,
        expiration DATETIME,
        share_token TEXT UNIQUE,
        notes TEXT
    )");

    // Orders table
    $db->exec("CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER NOT NULL,
        vehicle_year INTEGER,
        vehicle_make TEXT,
        vehicle_model TEXT,
        price REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
    )");

    // Stops table
    $db->exec("CREATE TABLE IF NOT EXISTS stops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        stop_type TEXT CHECK(stop_type IN ('pickup', 'delivery')),
        sequence_number INTEGER NOT NULL,
        notes TEXT,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )");

    // Drivers table
    $db->exec("CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    echo "Database tables initialized successfully.";
}

// Only run initialization if this script is called directly
if (basename($_SERVER['PHP_SELF']) == basename(__FILE__)) {
    initializeTables();
}
