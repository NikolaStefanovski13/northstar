<?php
// routes.php - Handles all route-related operations

require_once 'config.php';

// Route actions
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'create':
        createRoute();
        break;
    case 'get':
        getRoute();
        break;
    case 'list':
        listRoutes();
        break;
    case 'update':
        updateRoute();
        break;
    case 'delete':
        deleteRoute();
        break;
    default:
        errorResponse('Invalid action specified', 400);
}

/**
 * Create a new route
 */
function createRoute()
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
        errorResponse('Route name is required', 400);
    }

    try {
        $db = getDb();
        $db->beginTransaction();

        // Generate a unique share token
        $shareToken = generateShareToken();

        // Calculate expiration time based on ETA
        $etaMinutes = isset($data['total_duration']) ? intval($data['total_duration']) : 0;
        $etaTime = date('Y-m-d H:i:s', strtotime("+{$etaMinutes} minutes"));
        $expirationTime = date('Y-m-d H:i:s', strtotime("+" . ($etaMinutes * ROUTE_EXPIRATION_MULTIPLIER) . " minutes"));

        // Insert route
        $stmt = $db->prepare("
            INSERT INTO routes (
                name, 
                driver_id, 
                total_distance, 
                total_duration, 
                total_revenue, 
                eta, 
                expiration, 
                share_token, 
                notes
            ) VALUES (
                :name, 
                :driver_id, 
                :total_distance, 
                :total_duration, 
                :total_revenue, 
                :eta, 
                :expiration, 
                :share_token, 
                :notes
            )
        ");

        $stmt->execute([
            ':name' => $data['name'],
            ':driver_id' => isset($data['driver_id']) ? $data['driver_id'] : null,
            ':total_distance' => isset($data['total_distance']) ? $data['total_distance'] : 0,
            ':total_duration' => isset($data['total_duration']) ? $data['total_duration'] : 0,
            ':total_revenue' => isset($data['total_revenue']) ? $data['total_revenue'] : 0,
            ':eta' => $etaTime,
            ':expiration' => $expirationTime,
            ':share_token' => $shareToken,
            ':notes' => isset($data['notes']) ? $data['notes'] : null
        ]);

        $routeId = $db->lastInsertId();

        // Process orders and stops
        if (isset($data['orders']) && is_array($data['orders'])) {
            foreach ($data['orders'] as $order) {
                // Extract vehicle information
                $vehicleParts = isset($order['vehicle_model']) ? explode(' ', $order['vehicle_model'], 2) : ['', ''];
                $vehicleYear = is_numeric($vehicleParts[0]) ? intval($vehicleParts[0]) : null;
                $vehicleModel = isset($vehicleParts[1]) ? $vehicleParts[1] : $order['vehicle_model'];

                // Insert order
                $stmt = $db->prepare("
                    INSERT INTO orders (
                        route_id, 
                        vehicle_year, 
                        vehicle_make, 
                        vehicle_model, 
                        price, 
                        notes
                    ) VALUES (
                        :route_id, 
                        :vehicle_year, 
                        :vehicle_make, 
                        :vehicle_model, 
                        :price, 
                        :notes
                    )
                ");

                $stmt->execute([
                    ':route_id' => $routeId,
                    ':vehicle_year' => $vehicleYear,
                    ':vehicle_make' => isset($order['vehicle_make']) ? $order['vehicle_make'] : null,
                    ':vehicle_model' => $vehicleModel,
                    ':price' => isset($order['price']) ? $order['price'] : 0,
                    ':notes' => isset($order['notes']) ? $order['notes'] : null
                ]);

                $orderId = $db->lastInsertId();

                // Process pickup stops
                if (isset($order['pickups']) && is_array($order['pickups'])) {
                    foreach ($order['pickups'] as $index => $pickup) {
                        addStop($db, $routeId, $orderId, $pickup, 'pickup', $index);
                    }
                }

                // Process delivery stops
                if (isset($order['deliveries']) && is_array($order['deliveries'])) {
                    foreach ($order['deliveries'] as $index => $delivery) {
                        addStop($db, $routeId, $orderId, $delivery, 'delivery', $index);
                    }
                }
            }
        }

        $db->commit();

        // Return the created route with share link
        $shareUrl = getShareUrl($shareToken);

        jsonResponse([
            'status' => 'success',
            'message' => 'Route created successfully',
            'route_id' => $routeId,
            'share_token' => $shareToken,
            'share_url' => $shareUrl,
            'expiration' => $expirationTime
        ]);
    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * Add a stop to the database
 */
function addStop($db, $routeId, $orderId, $stopData, $type, $sequence)
{
    $stmt = $db->prepare("
        INSERT INTO stops (
            route_id, 
            order_id, 
            address, 
            latitude, 
            longitude, 
            stop_type, 
            sequence_number, 
            notes
        ) VALUES (
            :route_id, 
            :order_id, 
            :address, 
            :latitude, 
            :longitude, 
            :stop_type, 
            :sequence_number, 
            :notes
        )
    ");

    $stmt->execute([
        ':route_id' => $routeId,
        ':order_id' => $orderId,
        ':address' => $stopData['address'],
        ':latitude' => isset($stopData['lat']) ? $stopData['lat'] : null,
        ':longitude' => isset($stopData['lng']) ? $stopData['lng'] : null,
        ':stop_type' => $type,
        ':sequence_number' => $sequence,
        ':notes' => isset($stopData['notes']) ? $stopData['notes'] : null
    ]);
}

/**
 * Get a single route by ID or share token
 */
function getRoute()
{
    $routeId = isset($_GET['id']) ? intval($_GET['id']) : null;
    $shareToken = isset($_GET['token']) ? $_GET['token'] : null;

    if (!$routeId && !$shareToken) {
        errorResponse('Route ID or share token is required', 400);
    }

    try {
        $db = getDb();

        if ($routeId) {
            $stmt = $db->prepare("SELECT * FROM routes WHERE id = :id");
            $stmt->execute([':id' => $routeId]);
        } else {
            $stmt = $db->prepare("SELECT * FROM routes WHERE share_token = :token");
            $stmt->execute([':token' => $shareToken]);
        }

        $route = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$route) {
            errorResponse('Route not found', 404);
        }

        // Check if route has expired
        if (strtotime($route['expiration']) < time()) {
            errorResponse('Route has expired', 410);
        }

        // Get orders
        $stmt = $db->prepare("SELECT * FROM orders WHERE route_id = :route_id");
        $stmt->execute([':route_id' => $route['id']]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get stops
        $stmt = $db->prepare("SELECT * FROM stops WHERE route_id = :route_id ORDER BY sequence_number");
        $stmt->execute([':route_id' => $route['id']]);
        $stops = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get driver info if driver_id is set
        $driver = null;
        if ($route['driver_id']) {
            $stmt = $db->prepare("SELECT * FROM drivers WHERE id = :id");
            $stmt->execute([':id' => $route['driver_id']]);
            $driver = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // Build response data
        $result = [
            'route' => $route,
            'orders' => $orders,
            'stops' => $stops,
            'driver' => $driver
        ];

        jsonResponse($result);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * List all routes with filtering options
 */
function listRoutes()
{
    $status = isset($_GET['status']) ? $_GET['status'] : 'all';
    $search = isset($_GET['search']) ? $_GET['search'] : '';

    try {
        $db = getDb();

        $query = "SELECT r.*, 
                  (SELECT COUNT(*) FROM orders WHERE route_id = r.id) as vehicle_count, 
                  d.name as driver_name 
                  FROM routes r 
                  LEFT JOIN drivers d ON r.driver_id = d.id";

        $params = [];
        $conditions = [];

        // Add status filter
        if ($status === 'active') {
            $conditions[] = "r.expiration > :now";
            $params[':now'] = date('Y-m-d H:i:s');
        } elseif ($status === 'expired') {
            $conditions[] = "r.expiration <= :now";
            $params[':now'] = date('Y-m-d H:i:s');
        }

        // Add search filter
        if (!empty($search)) {
            $conditions[] = "(r.name LIKE :search OR d.name LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }

        // Add WHERE clause if there are conditions
        if (!empty($conditions)) {
            $query .= " WHERE " . implode(" AND ", $conditions);
        }

        // Add order by
        $query .= " ORDER BY r.created_at DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);

        $routes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse(['routes' => $routes]);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * Update an existing route
 */
function updateRoute()
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
        errorResponse('Route ID is required', 400);
    }

    try {
        $db = getDb();
        $db->beginTransaction();

        // Check if route exists
        $stmt = $db->prepare("SELECT * FROM routes WHERE id = :id");
        $stmt->execute([':id' => $data['id']]);
        $route = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$route) {
            errorResponse('Route not found', 404);
        }

        // Update route
        $stmt = $db->prepare("
            UPDATE routes SET
                name = :name,
                driver_id = :driver_id,
                total_distance = :total_distance,
                total_duration = :total_duration,
                total_revenue = :total_revenue,
                notes = :notes
            WHERE id = :id
        ");

        $stmt->execute([
            ':id' => $data['id'],
            ':name' => isset($data['name']) ? $data['name'] : $route['name'],
            ':driver_id' => isset($data['driver_id']) ? $data['driver_id'] : $route['driver_id'],
            ':total_distance' => isset($data['total_distance']) ? $data['total_distance'] : $route['total_distance'],
            ':total_duration' => isset($data['total_duration']) ? $data['total_duration'] : $route['total_duration'],
            ':total_revenue' => isset($data['total_revenue']) ? $data['total_revenue'] : $route['total_revenue'],
            ':notes' => isset($data['notes']) ? $data['notes'] : $route['notes']
        ]);

        // If orders are provided, delete existing orders and stops, then add new ones
        if (isset($data['orders']) && is_array($data['orders'])) {
            // Delete existing orders and stops (cascading delete will remove stops)
            $stmt = $db->prepare("DELETE FROM orders WHERE route_id = :route_id");
            $stmt->execute([':route_id' => $data['id']]);

            // Add new orders and stops
            foreach ($data['orders'] as $order) {
                // Extract vehicle information
                $vehicleParts = isset($order['vehicle_model']) ? explode(' ', $order['vehicle_model'], 2) : ['', ''];
                $vehicleYear = is_numeric($vehicleParts[0]) ? intval($vehicleParts[0]) : null;
                $vehicleModel = isset($vehicleParts[1]) ? $vehicleParts[1] : $order['vehicle_model'];

                // Insert order
                $stmt = $db->prepare("
                    INSERT INTO orders (
                        route_id, 
                        vehicle_year, 
                        vehicle_make, 
                        vehicle_model, 
                        price, 
                        notes
                    ) VALUES (
                        :route_id, 
                        :vehicle_year, 
                        :vehicle_make, 
                        :vehicle_model, 
                        :price, 
                        :notes
                    )
                ");

                $stmt->execute([
                    ':route_id' => $data['id'],
                    ':vehicle_year' => $vehicleYear,
                    ':vehicle_make' => isset($order['vehicle_make']) ? $order['vehicle_make'] : null,
                    ':vehicle_model' => $vehicleModel,
                    ':price' => isset($order['price']) ? $order['price'] : 0,
                    ':notes' => isset($order['notes']) ? $order['notes'] : null
                ]);

                $orderId = $db->lastInsertId();

                // Process pickup stops
                if (isset($order['pickups']) && is_array($order['pickups'])) {
                    foreach ($order['pickups'] as $index => $pickup) {
                        addStop($db, $data['id'], $orderId, $pickup, 'pickup', $index);
                    }
                }

                // Process delivery stops
                if (isset($order['deliveries']) && is_array($order['deliveries'])) {
                    foreach ($order['deliveries'] as $index => $delivery) {
                        addStop($db, $data['id'], $orderId, $delivery, 'delivery', $index);
                    }
                }
            }
        }

        $db->commit();

        jsonResponse([
            'status' => 'success',
            'message' => 'Route updated successfully',
            'route_id' => $data['id']
        ]);
    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * Delete a route
 */
function deleteRoute()
{
    $routeId = isset($_GET['id']) ? intval($_GET['id']) : null;

    if (!$routeId) {
        errorResponse('Route ID is required', 400);
    }

    try {
        $db = getDb();

        // Check if route exists
        $stmt = $db->prepare("SELECT * FROM routes WHERE id = :id");
        $stmt->execute([':id' => $routeId]);
        $route = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$route) {
            errorResponse('Route not found', 404);
        }

        // Delete route (cascading delete will remove orders and stops)
        $stmt = $db->prepare("DELETE FROM routes WHERE id = :id");
        $stmt->execute([':id' => $routeId]);

        jsonResponse([
            'status' => 'success',
            'message' => 'Route deleted successfully'
        ]);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * Helper function to create share URL
 */
function getShareUrl($token)
{
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    return "$protocol://$host/driver-view.html?token=$token";
}
