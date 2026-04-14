const express = require('express');
const multer = require('multer');
const upload = multer({ dest: '/tmp/' }); // Папка для временного хранения загруженных песен
const Replicate = require('replicate');
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN, // Сервер сам найдет твой ключ
});
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


// --- 1. РЕАЛЬНОЕ СОЗДАНИЕ МИНУСОВКИ (AI Spleeter) ---
app.post('/api/extract-minus', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Файл не загружен' });
        }

        // 1. Превращаем песню в шифр (Base64), чтобы отправить по сети
        const fs = require('fs');
        const fileData = fs.readFileSync(req.file.path);
        const base64Audio = `data:${req.file.mimetype};base64,${fileData.toString('base64')}`;

        // 2. Отправляем песню в нейросеть Spleeter
        const output = await replicate.run(
            "cjwbw/spleeter:3a1b0213d2fbc1450a41f6a1529124ed0b2ba57b0fb8444a85ee36ba5cfdc56a", // Уникальный ID нейросети
            {
                input: {
                    audio: base64Audio
                }
            }
        );

        // 3. Удаляем файл с нашего сервера (он нам больше не нужен, бережем память)
        fs.unlinkSync(req.file.path);

        // 4. Нейросеть возвращает нам ссылки. output.accompaniment — это и есть минус!
        res.json({ 
            success: true, 
            message: 'Нейросеть успешно разделила трек!',
            fileUrl: output.accompaniment 
        });

    } catch (error) {
        console.error('❌ Ошибка ИИ:', error);
        res.status(500).json({ success: false, message: 'Ошибка при обработке ИИ' });
    }
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
