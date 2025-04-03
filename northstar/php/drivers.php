<?php
// drivers.php - Handles all driver-related operations

require_once 'config.php';

// Driver actions
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'create':
        createDriver();
        break;
    case 'get':
        getDriver();
        break;
    case 'list':
        listDrivers();
        break;
    case 'update':
        updateDriver();
        break;
    case 'delete':
        deleteDriver();
        break;
    default:
        errorResponse('Invalid action specified', 400);
}

/**
 * Create a new driver
 */
function createDriver()
{
    // Check if request is POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    // Get JSON data from the request
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        errorResponse('Invalid JSON data', 400);
    }

    // Validate required fields
    if (empty($data['name'])) {
        errorResponse('Driver name is required', 400);
    }

    try {
        $db = getDb();

        // Insert driver
        $stmt = $db->prepare("
            INSERT INTO drivers (
                name, 
                phone, 
                email, 
                notes
            ) VALUES (
                :name, 
                :phone, 
                :email, 
                :notes
            )
        ");

        $stmt->execute([
            ':name' => $data['name'],
            ':phone' => isset($data['phone']) ? $data['phone'] : null,
            ':email' => isset($data['email']) ? $data['email'] : null,
            ':notes' => isset($data['notes']) ? $data['notes'] : null
        ]);

        $driverId = $db->lastInsertId();

        jsonResponse([
            'status' => 'success',
            'message' => 'Driver created successfully',
            'driver_id' => $driverId
        ]);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * Get a single driver by ID
 */
function getDriver()
{
    $driverId = isset($_GET['id']) ? intval($_GET['id']) : null;

    if (!$driverId) {
        errorResponse('Driver ID is required', 400);
    }

    try {
        $db = getDb();

        $stmt = $db->prepare("SELECT * FROM drivers WHERE id = :id");
        $stmt->execute([':id' => $driverId]);

        $driver = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$driver) {
            errorResponse('Driver not found', 404);
        }

        jsonResponse(['driver' => $driver]);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * List all drivers with optional search parameter
 */
function listDrivers()
{
    $search = isset($_GET['search']) ? $_GET['search'] : '';

    try {
        $db = getDb();

        $query = "SELECT * FROM drivers";
        $params = [];

        // Add search filter
        if (!empty($search)) {
            $query .= " WHERE name LIKE :search OR phone LIKE :search OR email LIKE :search";
            $params[':search'] = '%' . $search . '%';
        }

        // Add order by
        $query .= " ORDER BY name ASC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);

        $drivers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse(['drivers' => $drivers]);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * Update an existing driver
 */
function updateDriver()
{
    // Check if request is POST or PUT
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
        errorResponse('Method not allowed', 405);
    }

    // Get JSON data from the request
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        errorResponse('Invalid JSON data', 400);
    }

    // Validate required fields
    if (empty($data['id'])) {
        errorResponse('Driver ID is required', 400);
    }

    try {
        $db = getDb();

        // Check if driver exists
        $stmt = $db->prepare("SELECT * FROM drivers WHERE id = :id");
        $stmt->execute([':id' => $data['id']]);
        $driver = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$driver) {
            errorResponse('Driver not found', 404);
        }

        // Update driver
        $stmt = $db->prepare("
            UPDATE drivers SET
                name = :name,
                phone = :phone,
                email = :email,
                notes = :notes
            WHERE id = :id
        ");

        $stmt->execute([
            ':id' => $data['id'],
            ':name' => isset($data['name']) ? $data['name'] : $driver['name'],
            ':phone' => isset($data['phone']) ? $data['phone'] : $driver['phone'],
            ':email' => isset($data['email']) ? $data['email'] : $driver['email'],
            ':notes' => isset($data['notes']) ? $data['notes'] : $driver['notes']
        ]);

        jsonResponse([
            'status' => 'success',
            'message' => 'Driver updated successfully'
        ]);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * Delete a driver
 */
function deleteDriver()
{
    $driverId = isset($_GET['id']) ? intval($_GET['id']) : null;

    if (!$driverId) {
        errorResponse('Driver ID is required', 400);
    }

    try {
        $db = getDb();

        // Check if driver exists
        $stmt = $db->prepare("SELECT * FROM drivers WHERE id = :id");
        $stmt->execute([':id' => $driverId]);
        $driver = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$driver) {
            errorResponse('Driver not found', 404);
        }

        // Check if driver is assigned to any routes
        $stmt = $db->prepare("SELECT COUNT(*) FROM routes WHERE driver_id = :driver_id");
        $stmt->execute([':driver_id' => $driverId]);
        $routeCount = $stmt->fetchColumn();

        if ($routeCount > 0) {
            errorResponse('Cannot delete driver. Driver is assigned to ' . $routeCount . ' route(s)', 409);
        }

        // Delete driver
        $stmt = $db->prepare("DELETE FROM drivers WHERE id = :id");
        $stmt->execute([':id' => $driverId]);

        jsonResponse([
            'status' => 'success',
            'message' => 'Driver deleted successfully'
        ]);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}
