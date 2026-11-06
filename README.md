# HacakatonTaskWeb-BasedAttendanceTrackingService

Хакатон, кейс «Цифровой Кампус»: веб-сервис учёта посещаемости.

## Стек

- **Frontend:** React 19, TypeScript, Vite, MUI, Recharts, PWA.
- **Backend:** Django 6.1 + Django REST Framework, SQLite, Token Authentication.
- **CORS:** `django-cors-headers`.

## Запуск

### Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver 127.0.0.1:8000
```

Демо-доступ: `sosnin.ea / 1234` (и другие преподаватели, формат `фамилия.инициалы`; полный список — в [`backend/README.md`](backend/README.md)).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend откроется на `http://localhost:5173`. Vite проксирует `/api` на `http://127.0.0.1:8000`, поэтому в dev CORS не мешает. Для отдельного backend задайте `VITE_API_URL` (см. `frontend/.env.example`).

### Docker

```bash
cp .env.example .env
# поменяйте DJANGO_SECRET_KEY в .env
docker compose up --build -d
```

Сайт: `http://localhost:8080`. Порт меняется через `WEB_PORT`. Контейнер `web` слушает только `127.0.0.1`; наружу его отдаёт host-nginx с SSL — пример конфига в `deploy/host-nginx.conf.example`.

## Что реализовано

- Вход по логину/паролю, Bearer-токен, хранение сессии после перезагрузки.
- Расписание с режимами день/неделя/месяц, загрузка из БД; преподаватель видит только свои пары.
- Отметка посещаемости группы: `present`, `absent`, `late`, `excused`, массовые кнопки и горячие клавиши.
- Сохранение посещаемости в SQLite, данные доступны после перезагрузки страницы.
- Аналитика по группе, студенту и предмету: проценты, графики, распределение статусов.
- Зоны посещаемости: красная — `<20%`, жёлтая — `20–69.9%`, зелёная — `>=70%`.
- Журнал посещений в виде календаря.
- Импорт расписания из Excel с сохранением в БД.
- QR-страница самостоятельной отметки студента.
- Excel/PDF-отчёты формируются на backend.
- CORS-политика с настраиваемыми origin'ами.
- Docker Compose + nginx + Gunicorn для развёртывания.
- Демо-данные из `data/526group.json` и `data/526sched.json`: 72 студента, 129 занятий.

Подробности по API, Docker и развёртыванию — в [`backend/README.md`](backend/README.md).

## Структура

```text
backend/        Django REST API, SQLite, тесты, seed-команда, Dockerfile
frontend/       React-приложение
deploy/         Dockerfile.web и nginx.conf для Docker Compose
data/           мок-данные студентов и расписания
image/          скриншот задания
docker-compose.yml
```

Старый `import_database.py` оставлен как референс исходной схемы; актуальная загрузка данных — `python manage.py seed_data` внутри `backend/`.
