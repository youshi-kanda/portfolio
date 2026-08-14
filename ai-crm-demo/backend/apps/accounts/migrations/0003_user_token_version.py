from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="token_version",
            field=models.PositiveIntegerField(default=1, verbose_name="トークンバージョン"),
        ),
    ]
