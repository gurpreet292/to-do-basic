const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'tasks.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static front-end assets

// Helper to read tasks
const readTasks = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error reading tasks file:', error);
        return [];
    }
};

// Helper to write tasks
const writeTasks = (tasks) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2));
    } catch (error) {
        console.error('Error writing tasks file:', error);
    }
};

// --- API Endpoints ---

// Get all tasks
app.get('/api/tasks', (req, res) => {
    const tasks = readTasks();
    res.json(tasks);
});

// Add a new task
app.post('/api/tasks', (req, res) => {
    const { title, category, priority } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    const tasks = readTasks();
    const newTask = {
        id: Date.now().toString(),
        title: title.trim(),
        category: category || 'personal',
        priority: priority || 'medium',
        completed: false,
        createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    writeTasks(tasks);
    res.status(201).json(newTask);
});

// Update an existing task
app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { title, category, priority, completed } = req.body;

    const tasks = readTasks();
    const taskIndex = tasks.findIndex(t => t.id === id);

    if (taskIndex === -1) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = {
        ...tasks[taskIndex],
        ...(title !== undefined && { title: title.trim() }),
        ...(category !== undefined && { category }),
        ...(priority !== undefined && { priority }),
        ...(completed !== undefined && { completed })
    };

    tasks[taskIndex] = updatedTask;
    writeTasks(tasks);
    res.json(updatedTask);
});

// Delete a task
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const tasks = readTasks();
    const taskIndex = tasks.findIndex(t => t.id === id);

    if (taskIndex === -1) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0];
    writeTasks(tasks);
    res.json({ message: 'Task deleted successfully', task: deletedTask });
});

// Clear all completed tasks
app.post('/api/tasks/clear-completed', (req, res) => {
    const tasks = readTasks();
    const activeTasks = tasks.filter(t => !t.completed);
    const clearedCount = tasks.length - activeTasks.length;

    writeTasks(activeTasks);
    res.json({ message: `Cleared ${clearedCount} completed task(s)`, clearedCount });
});

// Serve main index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
