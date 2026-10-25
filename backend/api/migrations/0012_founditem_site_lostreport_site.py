from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_notification_hidden'),
    ]

    operations = [
        migrations.AddField(
            model_name='founditem',
            name='site',
            field=models.CharField(default='stony-brook', max_length=40),
        ),
        migrations.AddField(
            model_name='lostreport',
            name='site',
            field=models.CharField(default='stony-brook', max_length=40),
        ),
    ]
