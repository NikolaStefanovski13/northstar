<?php
// cleanup.php - Cleans up expired routes to optimize storage
// This script should be run as a cron job daily

require_once 'config.php';

// Check if this is being run from the command line or through a web request
$isCommandLine = (php_sapi_name() === 'cli');

// If running through web, require a secret key for security
if (!$isCommandLine) {
    $secretKey = isset($_GET['key']) ? $_GET['key'] : '';
    $configKey = 'your-secret-cleanup-key'; // For security, this should be moved to a proper config file

    if ($secretKey !== $configKey) {
        die('Unauthorized access');
    }
}

try {
    $db = getDb();

    // Log start time
    $startTime = microtime(true);
    $log = "Route cleanup started at " . date('Y-m-d H:i:s') . "\n";

    // Get current time
    $now = date('Y-m-d H:i:s');

    // Identify expired routes
    $stmt = $db->prepare("SELECT id, name, expiration FROM routes WHERE expiration <= :now");
    $stmt->execute([':now' => $now]);
    $expiredRoutes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $expiredCount = count($expiredRoutes);
    $log .= "Found $expiredCount expired routes\n";

    if ($expiredCount > 0) {
        // Delete expired routes (cascade will delete orders and stops)
        $stmt = $db->prepare("DELETE FROM routes WHERE expiration <= :now");
        $stmt->execute([':now' => $now]);

        $log .= "Deleted routes:\n";
        foreach ($expiredRoutes as $route) {
            $log .= "- ID: {$route['id']}, Name: {$route['name']}, Expired: {$route['expiration']}\n";
        }
    } else {
        $log .= "No expired routes found\n";
    }

    // Calculate execution time
    $executionTime = microtime(true) - $startTime;
    $log .= "Cleanup completed in " . number_format($executionTime, 4) . " seconds\n";

    // Log to file
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }

    $logFile = $logDir . '/cleanup_' . date('Y-m-d') . '.log';
    file_put_contents($logFile, $log, FILE_APPEND);

    // Output result
    if ($isCommandLine) {
        echo $log;
    } else {
        echo "<pre>$log</pre>";
    }
} catch (PDOException $e) {
    $error = "Database error: " . $e->getMessage();

    if ($isCommandLine) {
        echo $error . "\n";
    } else {
        echo "<p>$error</p>";
    }

    exit(1);
}

exit(0);
