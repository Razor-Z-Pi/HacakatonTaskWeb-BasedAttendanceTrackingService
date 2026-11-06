import uuid

from django.db import migrations, models


def populate_tokens(apps, schema_editor):
    Lesson = apps.get_model("api", "Lesson")
    for lesson in Lesson.objects.all().iterator():
        lesson.checkin_token = uuid.uuid4()
        lesson.save(update_fields=["checkin_token"])


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_teacher_login"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="checkin_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, null=True),
        ),
        migrations.RunPython(populate_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="lesson",
            name="checkin_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
