const express = require('express');
const cors = require('cors');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs'); // Добавили модуль для работы с файлами!

const app = express();
const PORT = 3000;

// Путь к нашему файлу-базе данных
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public'))); 

// --- НАША БАЗА ДАННЫХ (Чтение и Запись) ---
function getUsers() {
    // Если файла еще нет, возвращаем пустой список
    if (!fs.existsSync(USERS_FILE)) return [];
    // Если есть - читаем и превращаем в массив
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
}

function saveUsers(users) {
    // Красиво записываем массив обратно в файл
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- НОВЫЕ РОУТЫ ДЛЯ АВТОРИЗАЦИИ ---

// РЕГИСТРАЦИЯ
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    const users = getUsers();

    // Проверяем, нет ли уже такого email
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: 'Этот Email уже занят!' });
    }

    // Создаем нового пользователя и сохраняем
    users.push({ email, password });
    saveUsers(users);

    res.json({ success: true, message: '🎉 Регистрация успешна! Теперь вы можете войти.' });
});

// ВХОД (ЛОГИН)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const users = getUsers();

    // Ищем пользователя с таким email и паролем
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        res.json({ success: true, message: `✅ Добро пожаловать, ${email}!` });
    } else {
        res.status(401).json({ success: false, message: '❌ Неверный email или пароль' });
    }
});


// 1. Извлечение минусовки (Заглушка для AI)
app.post('/api/extract-minus', (req, res) => {
    setTimeout(() => {
        res.json({ 
            success: true, 
            message: 'Минусовка успешно извлечена!',
            fileUrl: '/minus_result.mp3' // <-- НОВАЯ СТРОЧКА: указываем путь к файлу
        });
    }, 4000); 
});

// --- 4. МУЗЫКА (Только звук) ---
// Эндпоинт генерации ссылки для аудио
app.post('/api/download-audio', (req, res) => {
    const { url } = req.body;
    res.json({ 
        success: true, 
        message: 'Извлекаем аудиодорожку...', 
        fileUrl: `/api/stream-audio?url=${encodeURIComponent(url)}` 
    });
});

// Стриминг чистого аудио
app.get('/api/stream-audio', (req, res) => {
    const videoUrl = req.query.url;
    
    // Формат m4a/mp3 - стандарт для музыки
    res.header('Content-Disposition', 'attachment; filename="music_track.m4a"');
    
    const subprocess = youtubedl.exec(videoUrl, {
        output: '-',
        format: 'bestaudio[ext=m4a]/bestaudio' // Просим отдать ТОЛЬКО лучший звук
    });

    subprocess.stdout.pipe(res);

    subprocess.on('error', (err) => {
        console.error('❌ Ошибка скачивания аудио:', err.message);
        if (!res.headersSent) res.status(500).end();
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен! Открой: http://localhost:${PORT}`);
});
