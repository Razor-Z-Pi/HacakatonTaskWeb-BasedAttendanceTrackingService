#!/bin/sh
set -e

python manage.py migrate --noinput

if [ "${SEED_DATA:-1}" = "1" ]; then
    python manage.py seed_data
fi

python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-60}"
