// Конфигурация API
const API_URL = 'api.php';

// Состояние приложения
let currentTab = 'projects';
let projects = [];
let tasks = [];
let syncSettings = {};
let autoSyncInterval;

// DOM элементы
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const syncIndicator = document.getElementById('syncIndicator');
const syncStatusText = document.getElementById('syncStatusText');
const syncIntervalInput = document.getElementById('syncInterval');
const syncNowBtn = document.getElementById('syncNowBtn');
const toggleSyncBtn = document.getElementById('toggleSyncBtn');
const projectFilter = document.getElementById('projectFilter');

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function () {
    loadAllData();
    setupEventListeners();
    setupAutoSync();
});

// Загрузка всех данных
async function loadAllData() {
    await Promise.all([
        loadProjects(),
        loadTasks(),
        loadIntegrationLogs(),
        loadSyncStatus()
    ]);
}

// Загрузка проектов
async function loadProjects() {
    try {
        const response = await fetch(`${API_URL}?endpoint=projects`);
        const result = await response.json();

        if (result.success) {
            projects = result.data;
            renderProjectsTable();
            populateProjectFilter();
            populateTaskProjectSelect();
            updateStats();
        }
    } catch (error) {
        console.error('Ошибка загрузки проектов:', error);
        showNotification('Ошибка загрузки проектов', 'error');
    }
}

// Загрузка задач
async function loadTasks(projectId = 0) {
    try {
        const url = projectId > 0
            ? `${API_URL}?endpoint=tasks&project_id=${projectId}`
            : `${API_URL}?endpoint=tasks`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            tasks = result.data;
            renderTasksTable();
            updateStats();
        }
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        showNotification('Ошибка загрузки задач', 'error');
    }
}

// Загрузка логов интеграции
async function loadIntegrationLogs() {
    try {
        const response = await fetch(`${API_URL}?endpoint=integration-logs`);
        const result = await response.json();

        if (result.success) {
            renderIntegrationLogs(result.data);
        }
    } catch (error) {
        console.error('Ошибка загрузки логов:', error);
    }
}

// Загрузка статуса синхронизации
async function loadSyncStatus() {
    try {
        const response = await fetch(`${API_URL}?endpoint=sync-status`);
        const result = await response.json();

        if (result.success) {
            syncSettings = result.data.settings;
            updateSyncUI();
            updateStats(result.data.stats);

            // Обновление интервала синхронизации
            syncIntervalInput.value = syncSettings.auto_sync_interval;
        }
    } catch (error) {
        console.error('Ошибка загрузки статуса синхронизации:', error);
    }
}

// Обновление статистики
function updateStats(stats = null) {
    const statsContainer = document.getElementById('statsContainer');

    if (!stats) {
        // Расчет статистики на основе загруженных данных
        stats = {
            projects: projects.length,
            tasks: tasks.length,
            completed_tasks: tasks.filter(task => task.status === 'completed').length,
            pending_tasks: tasks.filter(task => task.status !== 'completed').length
        };
    }

    statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${stats.projects}</div>
                    <div class="stat-label">Проектов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.tasks}</div>
                    <div class="stat-label">Всего задач</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.completed_tasks}</div>
                    <div class="stat-label">Выполнено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.pending_tasks}</div>
                    <div class="stat-label">В работе</div>
                </div>
            `;
}

// Отображение таблицы проектов
function renderProjectsTable() {
    const tableBody = document.getElementById('projectsTableBody');

    if (projects.length === 0) {
        tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                            Нет созданных проектов
                        </td>
                    </tr>
                `;
        return;
    }

    tableBody.innerHTML = projects.map(project => `
                <tr>
                    <td>${project.id}</td>
                    <td><strong>${project.name}</strong></td>
                    <td>${project.description || '—'}</td>
                    <td>
                        <span class="status-badge status-${project.status}">
                            ${getStatusText(project.status)}
                        </span>
                    </td>
                    <td>
                        <div>Начало: ${formatDate(project.start_date)}</div>
                        <div>Окончание: ${formatDate(project.end_date)}</div>
                    </td>
                    <td>
                        <button class="btn btn-sm" onclick="viewProjectTasks(${project.id})" title="Просмотр задач">
                        Просмотр
                        </button>
                        <button class="btn btn-sm btn-accent" onclick="editProject(${project.id})" title="Редактировать">
                        Редактировать
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProject(${project.id})" title="Удалить">
                        Удалить
                        </button>
                    </td>
                </tr>
            `).join('');
}

// Отображение таблицы задач
function renderTasksTable() {
    const tableBody = document.getElementById('tasksTableBody');

    if (tasks.length === 0) {
        tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                            Нет созданных задач
                        </td>
                    </tr>
                `;
        return;
    }

    tableBody.innerHTML = tasks.map(task => {
        const project = projects.find(p => p.id == task.project_id);
        const projectName = project ? project.name : `Проект #${task.project_id}`;

        return `
                    <tr>
                        <td>${task.id}</td>
                        <td>
                            <div><strong>${task.title}</strong></div>
                            <div style="font-size: 0.9rem; color: #666;">${task.description || '—'}</div>
                        </td>
                        <td>${projectName}</td>
                        <td class="priority-${task.priority}">
                            ${getPriorityText(task.priority)}
                        </td>
                        <td>
                            <span class="status-badge status-${task.status}">
                                ${getStatusText(task.status)}
                            </span>
                        </td>
                        <td>${task.assigned_to || '—'}</td>
                        <td>${formatDate(task.due_date)}</td>
                        <td>
                            <button class="btn btn-sm" onclick="updateTaskStatus(${task.id}, 'in_progress')" title="В работу">
                            В работу
                            </button>
                            <button class="btn btn-sm btn-success" onclick="updateTaskStatus(${task.id}, 'completed')" title="Завершить">
                            Завершить
                            </button>
                            <button class="btn btn-sm btn-accent" onclick="editTask(${task.id})" title="Редактировать">
                            Редактировать
                            </button>
                        </td>
                    </tr>
                `;
    }).join('');
}

// Отображение логов интеграции
function renderIntegrationLogs(logs) {
    const logsContainer = document.getElementById('logsContainer');

    if (logs.length === 0) {
        logsContainer.innerHTML = `
                    <div class="log-item" style="text-align: center; padding: 40px; color: #666;">
                        Нет данных о взаимодействии систем
                    </div>
                `;
        return;
    }

    logsContainer.innerHTML = logs.map(log => `
                <div class="log-item">
                    <div class="log-header">
                        <div>
                            <span class="log-source">${log.source_system}</span> → 
                            <span class="log-source">${log.target_system}</span>: 
                            <span class="log-action">${log.action}</span>
                        </div>
                        <div class="log-status-${log.status}">${getStatusText(log.status)}</div>
                    </div>
                    <div class="log-details">${log.details}</div>
                    <div class="log-time">${formatDateTime(log.created_at)}</div>
                </div>
            `).join('');
}

// Обновление UI синхронизации
function updateSyncUI() {
    if (syncSettings.sync_enabled) {
        syncIndicator.style.backgroundColor = 'var(--success-color)';
        syncStatusText.textContent = 'Синхронизация активна';
        toggleSyncBtn.innerHTML = 'Приостановить';
    } else {
        syncIndicator.style.backgroundColor = 'var(--warning-color)';
        syncStatusText.textContent = 'Синхронизация приостановлена';
        toggleSyncBtn.innerHTML = 'Возобновить';
    }
}

// Настройка автосинхронизации
function setupAutoSync() {
    // Очистка предыдущего интервала
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
    }

    // Установка нового интервала
    autoSyncInterval = setInterval(() => {
        if (syncSettings.sync_enabled) {
            performSync();
        }
    }, syncSettings.auto_sync_interval * 1000 || 300000);
}

// Выполнение синхронизации
async function performSync() {
    try {
        const response = await fetch(`${API_URL}?endpoint=sync-now`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            // Обновление данных после синхронизации
            loadAllData();

            // Обновление времени последней синхронизации
            syncSettings.last_sync = new Date().toISOString();

            // Показ уведомления
            showNotification('Синхронизация выполнена успешно', 'success');
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        showNotification('Ошибка синхронизации', 'error');
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Форма создания проекта
    document.getElementById('showAddProjectFormBtn').addEventListener('click', function () {
        document.getElementById('addProjectForm').style.display = 'block';
        this.style.display = 'none';
    });

    document.getElementById('cancelProjectBtn').addEventListener('click', function () {
        document.getElementById('addProjectForm').style.display = 'none';
        document.getElementById('showAddProjectFormBtn').style.display = 'inline-block';
        document.getElementById('projectForm').reset();
    });

    document.getElementById('projectForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const projectData = {
            name: document.getElementById('projectName').value,
            description: document.getElementById('projectDescription').value,
            start_date: document.getElementById('projectStartDate').value || null,
            end_date: document.getElementById('projectEndDate').value || null
        };

        try {
            const response = await fetch(`${API_URL}?endpoint=projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });

            const result = await response.json();

            if (result.success) {
                showNotification('Проект успешно создан', 'success');
                document.getElementById('projectForm').reset();
                document.getElementById('addProjectForm').style.display = 'none';
                document.getElementById('showAddProjectFormBtn').style.display = 'inline-block';

                // Перезагрузка данных
                await loadAllData();

                // Переключение на вкладку проектов
                switchTab('projects');
            } else {
                showNotification('Ошибка создания проекта: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Ошибка создания проекта:', error);
            showNotification('Ошибка создания проекта', 'error');
        }
    });

    // Форма создания задачи
    document.getElementById('showAddTaskFormBtn').addEventListener('click', function () {
        document.getElementById('addTaskForm').style.display = 'block';
        this.style.display = 'none';
    });

    document.getElementById('cancelTaskBtn').addEventListener('click', function () {
        document.getElementById('addTaskForm').style.display = 'none';
        document.getElementById('showAddTaskFormBtn').style.display = 'inline-block';
        document.getElementById('taskForm').reset();
    });

    document.getElementById('taskForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const taskData = {
            project_id: parseInt(document.getElementById('taskProject').value),
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            assigned_to: document.getElementById('taskAssignee').value || null,
            due_date: document.getElementById('taskDueDate').value || null
        };

        try {
            const response = await fetch(`${API_URL}?endpoint=tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });

            const result = await response.json();

            if (result.success) {
                showNotification('Задача успешно создана', 'success');
                document.getElementById('taskForm').reset();
                document.getElementById('addTaskForm').style.display = 'none';
                document.getElementById('showAddTaskFormBtn').style.display = 'inline-block';

                // Перезагрузка данных
                await loadAllData();

                // Переключение на вкладку задач
                switchTab('tasks');
            } else {
                showNotification('Ошибка создания задачи: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Ошибка создания задачи:', error);
            showNotification('Ошибка создания задачи', 'error');
        }
    });

    // Кнопки быстрых действий
    document.getElementById('addProjectBtn').addEventListener('click', function () {
        switchTab('projects');
        document.getElementById('showAddProjectFormBtn').click();
    });

    document.getElementById('addTaskBtn').addEventListener('click', function () {
        switchTab('tasks');
        document.getElementById('showAddTaskFormBtn').click();
    });

    // Синхронизация
    syncNowBtn.addEventListener('click', async function () {
        await performSync();
    });

    toggleSyncBtn.addEventListener('click', async function () {
        const newSyncEnabled = !syncSettings.sync_enabled;

        try {
            const response = await fetch(`${API_URL}?endpoint=sync-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sync_enabled: newSyncEnabled })
            });

            const result = await response.json();

            if (result.success) {
                syncSettings.sync_enabled = newSyncEnabled;
                updateSyncUI();

                if (newSyncEnabled) {
                    showNotification('Синхронизация возобновлена', 'success');
                    setupAutoSync();
                } else {
                    showNotification('Синхронизация приостановлена', 'warning');
                }
            }
        } catch (error) {
            console.error('Ошибка обновления настроек синхронизации:', error);
            showNotification('Ошибка обновления настроек синхронизации', 'error');
        }
    });

    syncIntervalInput.addEventListener('change', async function () {
        const newInterval = parseInt(this.value);

        if (newInterval >= 60) {
            try {
                const response = await fetch(`${API_URL}?endpoint=sync-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ auto_sync_interval: newInterval })
                });

                const result = await response.json();

                if (result.success) {
                    syncSettings.auto_sync_interval = newInterval;
                    setupAutoSync();
                    showNotification('Интервал синхронизации обновлен', 'success');
                }
            } catch (error) {
                console.error('Ошибка обновления интервала синхронизации:', error);
                showNotification('Ошибка обновления интервала синхронизации', 'error');
            }
        } else {
            showNotification('Интервал должен быть не менее 60 секунд', 'error');
            this.value = syncSettings.auto_sync_interval;
        }
    });

    // Фильтр задач по проекту
    projectFilter.addEventListener('change', function () {
        const projectId = parseInt(this.value);
        loadTasks(projectId);
    });
}

// Доп. функции

function switchTab(tabId) {
    // Обновление активной кнопки вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });

    // Показ активной вкладки
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId + 'Tab') {
            content.classList.add('active');
        }
    });

    currentTab = tabId;

    // Загрузка данных для активной вкладки
    if (tabId === 'integration') {
        loadIntegrationLogs();
    }
}

function populateProjectFilter() {
    projectFilter.innerHTML = '<option value="0">Все проекты</option>' +
        projects.map(project => `
                    <option value="${project.id}">${project.name}</option>
                `).join('');
}

function populateTaskProjectSelect() {
    const taskProjectSelect = document.getElementById('taskProject');
    taskProjectSelect.innerHTML = '<option value="">Выберите проект</option>' +
        projects.filter(p => p.status === 'active').map(project => `
                    <option value="${project.id}">${project.name}</option>
                `).join('');
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Активный',
        'completed': 'Завершен',
        'on_hold': 'На паузе',
        'pending': 'Ожидание',
        'in_progress': 'В работе',
        'blocked': 'Заблокирован',
        'success': 'Успешно',
        'error': 'Ошибка'
    };

    return statusMap[status] || status;
}

function getPriorityText(priority) {
    const priorityMap = {
        'low': 'Низкий',
        'medium': 'Средний',
        'high': 'Высокий',
        'critical': 'Критический'
    };

    return priorityMap[priority] || priority;
}

function formatDate(dateString) {
    if (!dateString) return '—';

    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '—';

    const date = new Date(dateTimeString);
    return date.toLocaleString('ru-RU');
}

function showNotification(message, type = 'info') {
    notificationText.textContent = message;

    // Установка класса в зависимости от типа
    notification.className = 'notification';
    notification.classList.add(`notification-${type}`);

    // Показ уведомления
    notification.classList.add('show');

    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Функции для кнопок действий

window.viewProjectTasks = function (projectId) {
    switchTab('tasks');
    projectFilter.value = projectId;
    loadTasks(projectId);
};

window.editProject = function (projectId) {
    const project = projects.find(p => p.id == projectId);

    if (project) {
        document.getElementById('projectName').value = project.name;
        document.getElementById('projectDescription').value = project.description || '';
        document.getElementById('projectStartDate').value = project.start_date || '';
        document.getElementById('projectEndDate').value = project.end_date || '';

        document.getElementById('addProjectForm').style.display = 'block';
        document.getElementById('showAddProjectFormBtn').style.display = 'none';

        // Прокрутка к форме
        document.getElementById('addProjectForm').scrollIntoView({ behavior: 'smooth' });

        // Изменение заголовка формы
        document.querySelector('#addProjectForm h3').textContent = 'Редактирование проекта';

        // Изменение обработчика формы
        const form = document.getElementById('projectForm');
        const oldSubmitHandler = form.onsubmit;

        form.onsubmit = async function (e) {
            e.preventDefault();

            const projectData = {
                id: projectId,
                name: document.getElementById('projectName').value,
                description: document.getElementById('projectDescription').value,
                start_date: document.getElementById('projectStartDate').value || null,
                end_date: document.getElementById('projectEndDate').value || null
            };
           
            showNotification('Редактирование проекта временно недоступно', 'warning');

            // Восстановление оригинального обработчика
            form.onsubmit = oldSubmitHandler;
        };
    }
};

window.deleteProject = async function (projectId) {
    if (confirm('Вы уверены, что хотите удалить этот проект? Все связанные задачи также будут удалены.')) {
        showNotification('Удаление проекта временно недоступно', 'warning');
    }
};

window.updateTaskStatus = async function (taskId, newStatus) {
    try {
        const response = await fetch(`${API_URL}?endpoint=tasks`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: taskId,
                status: newStatus
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Статус задачи обновлен', 'success');
            await loadAllData();
        } else {
            showNotification('Ошибка обновления задачи', 'error');
        }
    } catch (error) {
        console.error('Ошибка обновления задачи:', error);
        showNotification('Ошибка обновления задачи', 'error');
    }
};

window.editTask = function (taskId) {
    const task = tasks.find(t => t.id == taskId);

    if (task) {
        document.getElementById('taskProject').value = task.project_id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskAssignee').value = task.assigned_to || '';
        document.getElementById('taskDueDate').value = task.due_date || '';

        document.getElementById('addTaskForm').style.display = 'block';
        document.getElementById('showAddTaskFormBtn').style.display = 'none';

        // Прокрутка к форме
        document.getElementById('addTaskForm').scrollIntoView({ behavior: 'smooth' });

        // Изменение заголовка формы
        document.querySelector('#addTaskForm h3').textContent = 'Редактирование задачи';

        // Изменение обработчика формы
        const form = document.getElementById('taskForm');
        const oldSubmitHandler = form.onsubmit;

        form.onsubmit = async function (e) {
            e.preventDefault();

            const taskData = {
                id: taskId,
                project_id: parseInt(document.getElementById('taskProject').value),
                title: document.getElementById('taskTitle').value,
                description: document.getElementById('taskDescription').value,
                priority: document.getElementById('taskPriority').value,
                status: document.getElementById('taskStatus').value,
                assigned_to: document.getElementById('taskAssignee').value || null,
                due_date: document.getElementById('taskDueDate').value || null
            };

            try {
                const response = await fetch(`${API_URL}?endpoint=tasks`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(taskData)
                });

                const result = await response.json();

                if (result.success) {
                    showNotification('Задача успешно обновлена', 'success');
                    document.getElementById('taskForm').reset();
                    document.getElementById('addTaskForm').style.display = 'none';
                    document.getElementById('showAddTaskFormBtn').style.display = 'inline-block';

                    // Перезагрузка данных
                    await loadAllData();

                    // Восстановление оригинального обработчика
                    form.onsubmit = oldSubmitHandler;
                } else {
                    showNotification('Ошибка обновления задачи: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Ошибка обновления задачи:', error);
                showNotification('Ошибка обновления задачи', 'error');
            }
        };
    }
};