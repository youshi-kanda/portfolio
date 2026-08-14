from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("stores", "0003_storecollaborator"),
    ]

    operations = [
        migrations.AddField(
            model_name="storecollaborator",
            name="can_approve_contents",
            field=models.BooleanField(default=False, verbose_name="文案承認権限"),
        ),
    ]
