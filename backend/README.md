# Backend — Django REST Framework

REST API для веб-сервиса учёта посещаемости.

## Быстрый запуск

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver 127.0.0.1:8000
```

Демо-доступ:

| Логин | Пароль | Роль |
|---|---|---|
| `head` | `1234` | староста |
| `student` | `1234` | студент |
| `admin` | `1234` | администратор |

У каждого преподавателя свой логин. Формат: `фамилия.инициалы`, пароль у всех `1234`.

| Логин | Преподаватель |
|---|---|
| `astahov.rv` | Астахов Р.В. |
| `grineva.ms` | Гринёва М.С. |
| `dorofeev.iv` | Дорофеев И.В. |
| `egorov.mf` | Егоров М.Ф. |
| `ilina.na` | Ильина Н.А. |
| `kravchenko.ov` | Кравченко О.В. |
| `kulagin.da` | Кулагин Д.А. |
| `lapina.av` | Лапина А.В. |
| `malysheva.nv` | Малышева Н.В. |
| `medvedeva.tl` | Медведева Т.Л. |
| `plotnikov.aa` | Плотников А.А. |
| `provotorov.sn` | Провоторов С.Н. |
| `remizov.ei` | Ремизов Е.И. |
| `sosnin.ea` | Соснин Е.А. |
| `usova.nn` | Усова Н.Н. |
| `scherbakov.os` | Щербаков О.С. |

Логины также отдаются в `GET /api/meta/` в поле `teachers[].login`.

Swagger/OpenAPI нет — используется встроенный DRF Browsable API: `http://127.0.0.1:8000/api/lessons/`.

## Данные

`python manage.py seed_data` читает `../data/526group.json` и `../data/526sched.json`:

- 3 группы, 72 студента;
- 129 занятий, 16 преподавателей;
- 4 пары, период 02.11.2026–20.11.2026.

По умолчанию создаётся демонстрационная посещаемость для прошедших занятий, чтобы аналитика была не пустой. Отключить:

```bash
python manage.py seed_data --no-demo-attendance
```

Полностью пересоздать данные:

```bash
python manage.py seed_data --reset
```

## API

Базовый префикс — `/api/`.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health/` | Проверка сервиса |
| POST | `/api/auth/login/` | Вход, возвращает `access_token` и пользователя |
| GET | `/api/auth/me/` | Текущий пользователь |
| GET | `/api/meta/` | Группы, предметы, преподаватели, диапазон дат |
| GET | `/api/students/?group=526-1` | Студенты группы |
| GET | `/api/lessons/` | Расписание, фильтры `date_from`, `date_to`, `group`, `subject`, `teacher_id` |
| GET | `/api/lessons/{id}/` | Занятие |
| GET | `/api/lessons/{id}/students/` | Студенты занятия |
| GET | `/api/lessons/{id}/attendance/` | Сохранённые отметки |
| POST | `/api/lessons/{id}/attendance/` | Сохранить/заменить отметки занятия |
| POST | `/api/lessons/import/` | Импорт расписания из `.xlsx` |
| GET | `/api/lessons/{id}/checkin/` | Получить QR-токен занятия |
| GET | `/api/check-in/{token}/` | Данные занятия и студентов для QR-страницы |
| POST | `/api/check-in/{token}/` | Отметить студента как присутствующего |
| GET | `/api/analytics/` | Аналитика, фильтры `group`, `student_id`, `subject`, `date_from`, `date_to` |
| GET | `/api/journal/` | Журнал посещений с теми же фильтрами |
| GET | `/api/reports/analytics.xlsx` | Excel-отчёт по аналитике |
| GET | `/api/reports/analytics.pdf` | PDF-отчёт по аналитике |
| GET | `/api/reports/lessons/{id}.xlsx` | Excel-отчёт по занятию |
| GET | `/api/reports/lessons/{id}.pdf` | PDF-отчёт по занятию |

Запись посещаемости требует заголовок:

```
Authorization: Bearer <access_token>
```

Тело запроса:

```json
{
  "records": [
    { "student_id": "STU-5001", "status": "present" },
    { "student_id": "STU-5002", "status": "absent" }
  ]
}
```

Статусы: `present`, `absent`, `late`, `excused`.
Неотмеченные студенты занятия сохраняются как `absent`, чтобы журнал и аналитика были согласованы.

### Формула процента

`percent = round(100 * (present + late) / total_lessons, 1)`.

`total_lessons` — количество проведённых занятий группы (занятий, по которым есть хотя бы одна отметка), с учётом фильтров по предмету и датам.

Зоны в интерфейсе: красная — `<20%`, жёлтая — `20–69.9%`, зелёная — `>=70%`.

### Импорт расписания

`POST /api/lessons/import/`, `multipart/form-data`, поле `file` — `.xlsx`.

Ожидаемые колонки:

```text
Дата, Время, Предмет, Преподаватель, Аудитория, Группа, Тип
```

`Дата` — `ДД.ММ.ГГГГ` или `ГГГГ-ММ-ДД`. `Время` — номер пары или диапазон вроде `10:10-11:40`. Неизвестные группы создаются автоматически, преподавателю генерируется логин. Повторный импорт того же занятия не создаёт дубль.

### QR-отметка

1. `GET /api/lessons/{id}/checkin/` — получить токен занятия.
2. Frontend строит ссылку `/check-in/{token}` и показывает QR.
3. Студент открывает ссылку, выбирает себя и нажимает «Я здесь».
4. `POST /api/check-in/{token}/` ставит `present`.

Ссылка одноразовая только по смыслу — токен постоянный для занятия, повторная отметка идемпотентна.

### Отчёты

Excel и PDF формируются на backend:

- `GET /api/reports/analytics.xlsx` и `.pdf` — те же фильтры, что у `/api/analytics/`;
- `GET /api/reports/lessons/{id}.xlsx` и `.pdf` — отчёт по конкретной паре.

В Docker-образ устанавливается `fonts-dejavu-core`, поэтому PDF корректно отображает кириллицу.

## CORS

Настраивается через `CORS_ALLOWED_ORIGINS` в окружении. По умолчанию разрешены:

- `http://localhost:5173`, `http://127.0.0.1:5173`;
- `http://localhost:4173`, `http://127.0.0.1:4173`;
- `http://localhost`, `http://127.0.0.1`;
- любые порты `localhost` / `127.0.0.1` через regex.

Для отдельного домена добавьте его в `CORS_ALLOWED_ORIGINS`.
При использовании nginx, который проксирует `/api/` на Django, frontend и API находятся на одном origin, и CORS фактически не срабатывает.

## Тесты

```bash
cd backend
python manage.py test
```

Тесты проверяют:

- вход и токен;
- сохранение посещаемости и повторное чтение после «перезагрузки»;
- неотмеченные = `absent`;
- проценты аналитики на фиксированном наборе;
- фильтры по группе и предмету;
- журнал;
- импорт расписания из `.xlsx`;
- QR check-in;
- Excel/PDF-отчёты;
- обязательную авторизацию записи;
- CORS preflight.

## Docker

Рекомендуемый вариант для локального сервера. Из корня проекта:

```bash
cp .env.example .env
# обязательно поменяйте DJANGO_SECRET_KEY
docker compose up --build -d
```

Сайт: `http://localhost:8080`. Порт задаётся переменной `WEB_PORT`.

Что поднимается:

- `backend` — Django + Gunicorn, SQLite в named volume `db_data`;
- `web` — nginx, раздаёт `frontend/dist` и проксирует `/api/` и `/admin/`;
- `static_data` — общий volume для `collectstatic`.

При старте backend автоматически выполняет `migrate`, `seed_data` и `collectstatic`. Отключить seed: `SEED_DATA=0`.

Если на хосте уже занят порт 80, оставьте `WEB_PORT=8080` и проксируйте на него существующим nginx, либо остановите host-nginx и поставьте `WEB_PORT=80`.

Полезные команды:

```bash
docker compose logs -f backend
docker compose exec backend python manage.py seed_data
docker compose down
docker compose down -v   # удалить БД и static volume
```

## Развёртывание без Docker

1. Собрать frontend:
   ```bash
   cd frontend
   npm ci
   npm run build
   ```
   В production `VITE_API_URL` можно не задавать — по умолчанию используется `/api`, а nginx проксирует этот путь на Django.

2. На backend:
   ```bash
   cd backend
   pip install -r requirements.txt
   export DJANGO_DEBUG=false
   export DJANGO_SECRET_KEY='...'
   export DJANGO_ALLOWED_HOSTS='attendance.example.com,192.168.1.10'
   python manage.py migrate
   python manage.py seed_data
   python manage.py collectstatic --noinput
   gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
   ```

3. Пример nginx:
   ```nginx
   server {
       listen 80;
       server_name _;

       root /var/www/attendance/frontend/dist;
       index index.html;

       location /api/ {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /admin/ {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /static/ {
           alias /var/www/attendance/backend/staticfiles/;
       }

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

Если nginx работает на другом порту/хосте, чем frontend, добавьте origin frontend в `CORS_ALLOWED_ORIGINS`.

## Переменные окружения

Смотрите `.env.example`. Скопируйте его в `backend/.env` и заполните значения — Django загружает `.env` автоматически. В systemd/Docker также можно передавать переменные напрямую.
