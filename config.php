<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'project_task_integration');

define('API_ENABLED', true);

function getDBConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn -> connect_error) {
        die("Ошибка подключения к базе данных: " . $conn->connect_error);
    }
    
    $conn -> set_charset("utf8");
    return $conn;
}

// Логирование интеграционных событий
function logIntegrationEvent($source, $target, $action, $details, $status = 'pending') {
    $conn = getDBConnection();
    $stmt = $conn->prepare("INSERT INTO integration_logs (source_system, target_system, action, details, status) VALUES (?, ?, ?, ?, ?)");
    $stmt -> bind_param("sssss", $source, $target, $action, $details, $status);
    $result = $stmt->execute();
    $stmt -> close();
    $conn -> close();
    return $result;
}
?>