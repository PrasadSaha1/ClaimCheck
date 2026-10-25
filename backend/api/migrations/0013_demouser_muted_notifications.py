from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_founditem_site_lostreport_site'),
    ]

    operations = [
        migrations.AddField(
            model_name='demouser',
            name='muted_notifications',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
