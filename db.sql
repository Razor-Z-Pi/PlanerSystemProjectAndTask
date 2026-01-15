-- Создание базы данных
CREATE DATABASE IF NOT EXISTS project_task_integration;
USE project_task_integration;

-- Таблица проектов (система управления проектами)
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('active', 'completed', 'on_hold') DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица задач (система управления задачами)
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('pending', 'in_progress', 'completed', 'blocked') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    assigned_to VARCHAR(100),
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Таблица интеграционных логов
CREATE TABLE IF NOT EXISTS integration_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_system VARCHAR(50) NOT NULL,
    target_system VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    status ENUM('success', 'error', 'pending') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица синхронизации
CREATE TABLE IF NOT EXISTS sync_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sync_enabled BOOLEAN DEFAULT TRUE,
    auto_sync_interval INT DEFAULT 300, -- в секундах
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вставка тестовых данных
INSERT INTO projects (name, description, status, start_date, end_date) VALUES
('Разработка веб-приложения', 'Создание нового веб-приложения для клиента', 'active', '2026-01-15', '2026-06-30'),
('Мобильное приложение', 'Разработка мобильного приложения для iOS и Android', 'active', '2026-02-01', '2026-08-31'),
('Обслуживание инфраструктуры', 'Поддержка и обновление IT-инфраструктуры', 'active', '2026-03-01', '2026-12-31');

INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date) VALUES
(1, 'Проектирование архитектуры', 'Спроектировать архитектуру веб-приложения', 'completed', 'high', 'Алексей Петров', '2026-01-31'),
(1, 'Фронтенд разработка', 'Создание пользовательского интерфейса', 'in_progress', 'high', 'Мария Сидорова', '2026-03-15'),
(1, 'Бэкенд разработка', 'Разработка серверной части приложения', 'in_progress', 'high', 'Иван Иванов', '2026-04-30'),
(2, 'Дизайн интерфейса', 'Создание дизайна мобильного приложения', 'pending', 'medium', 'Ольга Козлова', '2026-02-28'),
(2, 'Разработка API', 'Создание API для мобильного приложения', 'pending', 'high', 'Сергей Смирнов', '2026-03-31'),
(3, 'Обновление серверов', 'Обновление ПО на серверах', 'completed', 'medium', 'Дмитрий Федоров', '2026-01-20');

INSERT INTO sync_settings (sync_enabled, auto_sync_interval, last_sync) VALUES
(TRUE, 300, NOW());