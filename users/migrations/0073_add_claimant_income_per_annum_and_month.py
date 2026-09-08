from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0072_create_log_archive_tables'),
    ]

    operations = [
        migrations.AddField(
            model_name='caseverification',
            name='income_per_annum',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Claimant income per annum',
                max_digits=15,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='caseverification',
            name='income_per_month',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Claimant income per month',
                max_digits=15,
                null=True,
            ),
        ),
        migrations.RunSQL(
            sql="""
            ALTER TABLE claimant_checks ADD COLUMN IF NOT EXISTS income_per_annum NUMERIC(15,2);
            ALTER TABLE claimant_checks ADD COLUMN IF NOT EXISTS income_per_month NUMERIC(15,2);

            UPDATE claimant_checks
            SET income_per_annum = claimant_income,
                income_per_month = ROUND(claimant_income / 12.0, 2)
            WHERE claimant_income IS NOT NULL AND income_per_annum IS NULL;

            UPDATE case_verification
            SET income_per_annum = income,
                income_per_month = ROUND(income / 12.0, 2)
            WHERE income IS NOT NULL AND income_per_annum IS NULL;
            """,
            reverse_sql="""
            ALTER TABLE claimant_checks DROP COLUMN IF EXISTS income_per_annum;
            ALTER TABLE claimant_checks DROP COLUMN IF EXISTS income_per_month;
            """
        ),
    ]
