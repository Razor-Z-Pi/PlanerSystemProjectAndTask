<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';

$response = ['success' => false, 'message' => 'Неизвестная конечная точка', 'data' => null];

// Обработка запросов API
switch($endpoint) {
    case 'projects':
        if ($method === 'GET') {
            // Получение списка проектов
            $conn = getDBConnection();
            $result = $conn -> query("SELECT * FROM projects ORDER BY created_at DESC");
            $projects = [];
            
            while($row = $result -> fetch_assoc()) {
                $projects[] = $row;
            }
            
            $response = ['success' => true, 'data' => $projects];
            $conn -> close();
            
            // Логирование
            logIntegrationEvent('API', 'Project System', 'get_projects', 'Получен список проектов', 'success');
        } elseif ($method === 'POST') {
            // Создание нового проекта
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (isset($data['name'])) {
                $conn = getDBConnection();
                $stmt = $conn -> prepare("INSERT INTO projects (name, description, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)");
                $stmt -> bind_param("sssss", 
                    $data['name'],
                    $data['description'] ?? '',
                    $data['status'] ?? 'active',
                    $data['start_date'] ?? null,
                    $data['end_date'] ?? null
                );
                
                if ($stmt -> execute()) {
                    $projectId = $conn -> insert_id;
                    $response = ['success' => true, 'message' => 'Проект создан', 'project_id' => $projectId];
                    
                    // Логирование
                    logIntegrationEvent('Project System', 'API', 'create_project', "Создан проект: {$data['name']}", 'success');
                } else {
                    $response = ['success' => false, 'message' => 'Ошибка создания проекта'];
                }
                
                $stmt -> close();
                $conn -> close();
            }
        }
        break;
        
    case 'tasks':
        if ($method === 'GET') {
            // Получение списка задач
            $project_id = isset($_GET['project_id']) ? intval($_GET['project_id']) : 0;
            $conn = getDBConnection();
            
            if ($project_id > 0) {
                $stmt = $conn -> prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY due_date ASC");
                $stmt -> bind_param("i", $project_id);
                $stmt -> execute();
                $result = $stmt -> get_result();
            } else {
                $result = $conn -> query("SELECT * FROM tasks ORDER BY due_date ASC");
            }
            
            $tasks = [];
            while($row = $result -> fetch_assoc()) {
                $tasks[] = $row;
            }
            
            $response = ['success' => true, 'data' => $tasks];
            $conn -> close();
            
            // Логирование
            logIntegrationEvent('API', 'Task System', 'get_tasks', 'Получен список задач', 'success');
        } elseif ($method === 'POST') {
            // Создание новой задачи
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (isset($data['title']) && isset($data['project_id'])) {
                $conn = getDBConnection();
                $stmt = $conn -> prepare("INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt -> bind_param("issssss", 
                    $data['project_id'],
                    $data['title'],
                    $data['description'] ?? '',
                    $data['status'] ?? 'pending',
                    $data['priority'] ?? 'medium',
                    $data['assigned_to'] ?? '',
                    $data['due_date'] ?? null
                );
                
                if ($stmt -> execute()) {
                    $taskId = $conn -> insert_id;
                    $response = ['success' => true, 'message' => 'Задача создана', 'task_id' => $taskId];
                    
                    // Логирование
                    logIntegrationEvent('Task System', 'API', 'create_task', "Создана задача: {$data['title']}", 'success');
                    
                    // Синхронизация: обновление статуса проекта при добавлении задач
                    syncProjectStatus($data['project_id']);
                } else {
                    $response = ['success' => false, 'message' => 'Ошибка создания задачи'];
                }
                
                $stmt -> close();
                $conn -> close();
            }
        } elseif ($method === 'PUT') {
            // Обновление задачи
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (isset($data['id'])) {
                $conn = getDBConnection();
                
                // Получение текущей задачи
                $stmt = $conn -> prepare("SELECT project_id FROM tasks WHERE id = ?");
                $stmt -> bind_param("i", $data['id']);
                $stmt -> execute();
                $result = $stmt -> get_result();
                $task = $result -> fetch_assoc();
                $project_id = $task['project_id'];
                $stmt -> close();
                
                // Обновление задачи
                $fields = [];
                $values = [];
                $types = '';
                
                $updateFields = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date'];
                foreach ($updateFields as $field) {
                    if (isset($data[$field])) {
                        $fields[] = "$field = ?";
                        $values[] = $data[$field];
                        $types .= 's';
                    }
                }
                
                if (!empty($fields)) {
                    $values[] = $data['id'];
                    $types .= 'i';
                    
                    $sql = "UPDATE tasks SET " . implode(', ', $fields) . " WHERE id = ?";
                    $stmt = $conn -> prepare($sql);
                    $stmt -> bind_param($types, ...$values);
                    
                    if ($stmt -> execute()) {
                        $response = ['success' => true, 'message' => 'Задача обновлена'];
                        
                        // Логирование
                        logIntegrationEvent('Task System', 'API', 'update_task', "Обновлена задача ID: {$data['id']}", 'success');
                        
                        // Синхронизация: обновление статуса проекта при изменении задач
                        syncProjectStatus($project_id);
                    } else {
                        $response = ['success' => false, 'message' => 'Ошибка обновления задачи'];
                    }
                    
                    $stmt -> close();
                }
                
                $conn -> close();
            }
        }
        break;
        
    case 'integration-logs':
        // Получение логов интеграции
        if ($method === 'GET') {
            $conn = getDBConnection();
            $result = $conn -> query("SELECT * FROM integration_logs ORDER BY created_at DESC LIMIT 50");
            $logs = [];
            
            while($row = $result -> fetch_assoc()) {
                $logs[] = $row;
            }
            
            $response = ['success' => true, 'data' => $logs];
            $conn -> close();
        }
        break;
        
    case 'sync-status':
        // Получение статуса синхронизации
        if ($method === 'GET') {
            $conn = getDBConnection();
            $result = $conn -> query("SELECT * FROM sync_settings LIMIT 1");
            $settings = $result -> fetch_assoc();
            
            // Получение статистики
            $statsResult = $conn -> query("SELECT COUNT(*) as total_projects FROM projects");
            $projectsCount = $statsResult -> fetch_assoc()['total_projects'];
            
            $statsResult = $conn -> query("SELECT COUNT(*) as total_tasks FROM tasks");
            $tasksCount = $statsResult -> fetch_assoc()['total_tasks'];
            
            $statsResult = $conn -> query("SELECT 
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as pending_tasks
                FROM tasks");
            $taskStats = $statsResult -> fetch_assoc();
            
            $response = [
                'success' => true, 
                'data' => [
                    'settings' => $settings,
                    'stats' => [
                        'projects' => $projectsCount,
                        'tasks' => $tasksCount,
                        'completed_tasks' => $taskStats['completed_tasks'],
                        'pending_tasks' => $taskStats['pending_tasks']
                    ]
                ]
            ];
            $conn -> close();
        } elseif ($method === 'POST') {
            // Обновление настроек синхронизации
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (isset($data['sync_enabled']) || isset($data['auto_sync_interval'])) {
                $conn = getDBConnection();
                
                $fields = [];
                $values = [];
                $types = '';
                
                if (isset($data['sync_enabled'])) {
                    $fields[] = "sync_enabled = ?";
                    $values[] = $data['sync_enabled'];
                    $types .= 'i';
                }
                
                if (isset($data['auto_sync_interval'])) {
                    $fields[] = "auto_sync_interval = ?";
                    $values[] = $data['auto_sync_interval'];
                    $types .= 'i';
                }
                
                if (!empty($fields)) {
                    $sql = "UPDATE sync_settings SET " . implode(', ', $fields) . " WHERE id = 1";
                    $stmt = $conn -> prepare($sql);
                    $stmt -> bind_param($types, ...$values);
                    
                    if ($stmt -> execute()) {
                        $response = ['success' => true, 'message' => 'Настройки синхронизации обновлены'];
                        logIntegrationEvent('API', 'Sync System', 'update_settings', 'Обновлены настройки синхронизации', 'success');
                    } else {
                        $response = ['success' => false, 'message' => 'Ошибка обновления настроек'];
                    }
                    
                    $stmt -> close();
                }
                
                $conn -> close();
            }
        }
        break;
        
    case 'sync-now':
        if ($method === 'POST') {
            $conn = getDBConnection();
            
            $stmt = $conn -> prepare("UPDATE sync_settings SET last_sync = NOW() WHERE id = 1");
            $stmt -> execute();
            $stmt -> close();
            
            $result = $conn -> query("SELECT id FROM projects");
            while($row = $result -> fetch_assoc()) {
                syncProjectStatus($row['id']);
            }
            
            $response = ['success' => true, 'message' => 'Синхронизация выполнена'];
            logIntegrationEvent('API', 'Sync System', 'manual_sync', 'Выполнена ручная синхронизация', 'success');
            
            $conn -> close();
        }
        break;
}

// Функция синхронизации статуса проекта на основе задач
function syncProjectStatus($project_id) {
    $conn = getDBConnection();
    
    // Получение статистики задач проекта
    $stmt = $conn -> prepare("SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
        FROM tasks WHERE project_id = ?");
    $stmt -> bind_param("i", $project_id);
    $stmt -> execute();
    $result = $stmt -> get_result();
    $stats = $result -> fetch_assoc();
    $stmt -> close();
    
    // Определение статуса проекта на основе задач
    $new_status = 'active';
    if ($stats['total_tasks'] > 0 && $stats['completed_tasks'] == $stats['total_tasks']) {
        $new_status = 'completed';
    }
    
    // Обновление статуса проекта
    $stmt = $conn -> prepare("UPDATE projects SET status = ? WHERE id = ?");
    $stmt -> bind_param("si", $new_status, $project_id);
    $stmt -> execute();
    $stmt -> close();
    
    // Логирование синхронизации
    logIntegrationEvent('Task System', 'Project System', 'sync_project_status', 
        "Синхронизирован статус проекта ID: $project_id. Новый статус: $new_status", 'success');
    
    $conn -> close();
}

echo json_encode($response);
?>