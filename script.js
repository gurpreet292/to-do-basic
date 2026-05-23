// State Management
let tasks = [];
let activeFilter = 'all';

// DOM Elements
const todoForm = document.getElementById('todoForm');
const taskInput = document.getElementById('taskInput');
const taskCategory = document.getElementById('taskCategory');
const taskPriority = document.getElementById('taskPriority');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const currentDateEl = document.getElementById('currentDate');
const greetingTextEl = document.getElementById('greetingText');
const progressCircle = document.getElementById('progressCircle');
const progressPercentage = document.getElementById('progressPercentage');
const totalTasksCount = document.getElementById('totalTasksCount');
const completedTasksCount = document.getElementById('completedTasksCount');
const pendingTasksCount = document.getElementById('pendingTasksCount');
const filterTabs = document.querySelectorAll('.filter-tab');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const toastContainer = document.getElementById('toastContainer');

// Circumference of the SVG Progress circle (r = 24)
const CIRCUMFERENCE = 2 * Math.PI * 24;

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    initDateAndGreeting();
    await loadTasks();
    setupEventListeners();
});

// Set date and custom greeting
function initDateAndGreeting() {
    // Current Date formatting
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const today = new Date();
    currentDateEl.textContent = today.toLocaleDateString('en-US', options);

    // Dynamic greeting based on current time
    const hour = today.getHours();
    let greeting = 'Hello, Explorer!';
    if (hour < 12) {
        greeting = 'Good morning!';
    } else if (hour < 18) {
        greeting = 'Good afternoon!';
    } else {
        greeting = 'Good evening!';
    }
    greetingTextEl.textContent = greeting;
}

// Setup Event Listeners
function setupEventListeners() {
    // Add Task Form Submit
    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask();
    });

    // Filter Navigation Tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            filterTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            activeFilter = tab.dataset.filter;
            renderTasks();
        });
    });

    // Clear Completed Button
    clearCompletedBtn.addEventListener('click', clearCompletedTasks);
}

// Fetch tasks from the backend
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            tasks = await response.json();
        } else {
            throw new Error('Server returned error status');
        }
    } catch (error) {
        console.error('Error fetching tasks from server:', error);
        showToast('Offline mode: Using local storage.', 'info');
        tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    }
    renderTasks();
}

// Render Tasks based on state and filters
function renderTasks() {
    // Filter tasks
    const filteredTasks = tasks.filter(task => {
        if (activeFilter === 'pending') return !task.completed;
        if (activeFilter === 'completed') return task.completed;
        return true;
    });

    // Sort: Pending tasks first, then completed. Within those, sort high to low priority.
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    filteredTasks.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

    // Clear current DOM elements
    taskList.innerHTML = '';

    if (filteredTasks.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';

        filteredTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
            taskItem.dataset.id = task.id;

            taskItem.innerHTML = `
                <div class="task-item-left">
                    <label class="checkbox-container" aria-label="Toggle completed state">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTaskComplete('${task.id}')">
                        <span class="checkmark"></span>
                    </label>
                    <div class="task-info-block">
                        <span class="task-title" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</span>
                        <div class="task-meta">
                            <span class="badge badge-${task.category}">${task.category}</span>
                            <span class="priority-indicator">
                                <span class="priority-dot ${task.priority}"></span>
                                ${capitalizeFirstLetter(task.priority)}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-action btn-edit" onclick="editTask('${task.id}')" title="Edit Task" aria-label="Edit Task">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteTask('${task.id}')" title="Delete Task" aria-label="Delete Task">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            `;
            taskList.appendChild(taskItem);
        });
    }

    updateStats();
}

// Add Task
async function addTask() {
    const title = taskInput.value.trim();
    if (!title) return;

    const payload = {
        title: title,
        category: taskCategory.value,
        priority: taskPriority.value
    };

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to save task to server');
        const newTask = await response.json();
        tasks.unshift(newTask);
        saveToLocalStorage();
        renderTasks();

        // Reset Form Input
        taskInput.value = '';
        taskInput.focus();

        showToast('Task added successfully!', 'success');
    } catch (error) {
        console.error(error);
        showToast('Failed to add task to server.', 'danger');
    }
}

// Toggle Completed State
window.toggleTaskComplete = async function(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newCompletedState = !task.completed;

    try {
        const response = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed: newCompletedState })
        });

        if (!response.ok) throw new Error('Failed to update task');
        const updatedTask = await response.json();
        task.completed = updatedTask.completed;
        saveToLocalStorage();
        renderTasks();

        if (task.completed) {
            showToast('Task marked as completed!', 'success');
        } else {
            showToast('Task marked as active.', 'info');
        }
    } catch (error) {
        console.error(error);
        showToast('Failed to update task on server.', 'danger');
        renderTasks(); // Revert checkmark state in view
    }
};

// Edit Task Title
window.editTask = async function(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const currentTitle = task.title;
    const newTitle = prompt('Edit your task:', currentTitle);
    
    if (newTitle === null) return; // Cancelled
    
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
        showToast('Task title cannot be empty!', 'danger');
        return;
    }

    try {
        const response = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: trimmedTitle })
        });

        if (!response.ok) throw new Error('Failed to edit task');
        const updatedTask = await response.json();
        task.title = updatedTask.title;
        saveToLocalStorage();
        renderTasks();
        showToast('Task updated successfully!', 'success');
    } catch (error) {
        console.error(error);
        showToast('Failed to edit task on server.', 'danger');
    }
};

// Delete Task
window.deleteTask = async function(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const taskElement = document.querySelector(`[data-id="${id}"]`);
    
    const performDelete = async () => {
        try {
            const response = await fetch(`/api/tasks/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete task');
            tasks.splice(taskIndex, 1);
            saveToLocalStorage();
            renderTasks();
            showToast('Task deleted.', 'danger');
        } catch (error) {
            console.error(error);
            showToast('Failed to delete task from server.', 'danger');
        }
    };

    if (taskElement) {
        taskElement.classList.add('removing');
        // Wait for the exit transition to finish before removing from DOM/state
        setTimeout(performDelete, 300);
    } else {
        await performDelete();
    }
};

// Clear all completed tasks
async function clearCompletedTasks() {
    const completedCount = tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
        showToast('No completed tasks to clear.', 'info');
        return;
    }

    try {
        const response = await fetch('/api/tasks/clear-completed', {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Failed to clear tasks');
        tasks = tasks.filter(t => !t.completed);
        saveToLocalStorage();
        renderTasks();
        showToast(`Cleared ${completedCount} completed task(s).`, 'danger');
    } catch (error) {
        console.error(error);
        showToast('Failed to clear completed tasks from server.', 'danger');
    }
}

// Update App Stats (Numbers & Circular Progress Ring)
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    // Numerical Stats
    totalTasksCount.textContent = total;
    completedTasksCount.textContent = completed;
    pendingTasksCount.textContent = pending;

    // Progress percentage
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressPercentage.textContent = `${percent}%`;

    // Circular ring stroke offset update
    const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
    progressCircle.style.strokeDashoffset = offset;
}

// Utility: Save tasks state to localStorage (offline sync)
function saveToLocalStorage() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Utility: Toast Alerts
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'danger') iconClass = 'fa-circle-exclamation';
    if (type === 'info') iconClass = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 3s
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Utility: Helper function to escape HTML string
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Utility: Capitalize first letter of strings
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
