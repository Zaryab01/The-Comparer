from django.contrib.postgres.indexes import GinIndex
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="note",
            index=GinIndex(
                fields=["name"],
                name="catalog_note_name_gin",
                opclasses=["gin_trgm_ops"],
            ),
        ),
    ]
