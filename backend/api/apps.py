from django.apps import AppConfig
from django.db.backends.signals import connection_created


def configure_sqlite(sender, connection, **kwargs):
    if connection.vendor != "sqlite":
        return
    with connection.cursor() as cursor:
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA busy_timeout=5000;")


class ApiConfig(AppConfig):
    name = "api"

    def ready(self):
        connection_created.connect(configure_sqlite)
