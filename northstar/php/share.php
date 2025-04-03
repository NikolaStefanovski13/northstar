<?php
// share.php - Handles route sharing functionality

require_once 'config.php';

// Share actions
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'getByToken':
        getRouteByToken();
        break;
    case 'resend':
        resendRouteLink();
        break;
    default:
        errorResponse('Invalid action specified', 400);
}

/**
 * Get route by share token
 */
function getRouteByToken() {
    $token = isset($_GET['token']) ? $_GET['token'] : null;
    
    if (!$token) {
        errorResponse('Share token is required', 400);
    }

    try {
        $db = getDb();
        
        // Get route
        $stmt = $db->prepare("SELECT * FROM routes WHERE share_token = :token");
        $stmt->execute([':token' => $token]);
        $route = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$route) {
            errorResponse('Route not found', 404);
        }

        // Check if route has expired
        if (strtotime($route['expiration']) < time()) {
            errorResponse('Route has expired', 410);
        }

        // Get driver
        $driver = null;
        if ($route['driver_id']) {
            $stmt = $db->prepare("SELECT id, name, phone, email FROM drivers WHERE id = :id");
            $stmt->execute([':id' => $route['driver_id']]);
            $driver = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // Get orders
        $stmt = $db->prepare("
            SELECT 
                o.id,
                o.vehicle_year,
                o.vehicle_make,
                o.vehicle_model,
                o.price,
                o.notes
            FROM orders o
            WHERE o.route_id = :route_id
        ");
        $stmt->execute([':route_id' => $route['id']]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get stops with order information
        $stmt = $db->prepare("
            SELECT 
                s.*,
                o.vehicle_year,
                o.vehicle_make,
                o.vehicle_model
            FROM stops s
            JOIN orders o ON s.order_id = o.id
            WHERE s.route_id = :route_id
            ORDER BY s.sequence_number
        ");
        $stmt->execute([':route_id' => $route['id']]);
        $stops = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format vehicles for each stop
        foreach ($stops as &$stop) {
            $vehicleModel = '';
            if ($stop['vehicle_year']) {
                $vehicleModel .= $stop['vehicle_year'] . ' ';
            }
            if ($stop['vehicle_make']) {
                $vehicleModel .= $stop['vehicle_make'] . ' ';
            }
            $vehicleModel .= $stop['vehicle_model'];
            $stop['vehicle'] = trim($vehicleModel);
        }

        // Build response data
        $result = [
            'route' => [
                'id' => $route['id'],
                'name' => $route['name'],
                'total_distance' => $route['total_distance'],
                'total_duration' => $route['total_duration'],
                'total_revenue' => $route['total_revenue'],
                'created_at' => $route['created_at'],
                'eta' => $route['eta'],
                'expiration' => $route['expiration'],
                'notes' => $route['notes']
            ],
            'driver' => $driver,
            'orders' => $orders,
            'stops' => $stops
        ];

        jsonResponse($result);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

/**
 * Resend route share link (generates a new token)
 */
function resendRouteLink() {
    // Check if request is POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }

    // Get route ID
    $routeId = isset($_GET['id']) ? intval($_GET['id']) : null