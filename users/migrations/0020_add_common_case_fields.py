"""
Add common case fields to InsuranceCase model:
  client_name, case_receipt_date, receipt_month, completion_date,
  completion_month, case_due_date, tat_days, sla_status, case_type,
  investigation_report_status, full_case_status, scope_of_work
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0019_remove_old_verification_columns"),
    ]

    operations = [
        migrations.AddField(
            model_name="insurancecase",
            name="client_name",
            field=models.CharField(
                blank=True, help_text="Client / Insurance company name", max_length=500, default=""
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="case_receipt_date",
            field=models.DateField(
                blank=True, help_text="Date case was received", null=True
            ),
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="receipt_month",
            field=models.CharField(
                blank=True, help_text="Month of receipt", max_length=20, default=""
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="completion_date",
            field=models.DateField(
                blank=True, help_text="Date case was completed", null=True
            ),
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="completion_month",
            field=models.CharField(
                blank=True, help_text="Month of completion", max_length=20, default=""
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="case_due_date",
            field=models.DateField(
                blank=True, help_text="Due date for the case", null=True
            ),
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="tat_days",
            field=models.IntegerField(
                blank=True, help_text="Turn Around Time in days", null=True
            ),
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="sla_status",
            field=models.CharField(
                blank=True,
                choices=[("AT", "AT (Achieved TAT)"), ("WT", "WT (Within TAT)")],
                help_text="SLA status - AT or WT",
                max_length=10,
                default=""
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="case_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("Full Case", "Full Case"),
                    ("Partial Case", "Partial Case"),
                    ("Reassessment", "Reassessment"),
                    ("Connected Case", "Connected Case"),
                ],
                help_text="Full Case / Partial / Reassessment / Connected",
                max_length=50,
                default=""
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="investigation_report_status",
            field=models.CharField(
                choices=[
                    ("Open", "Open"),
                    ("Approval", "Approval"),
                    ("Stop", "Stop"),
                    ("QC", "QC"),
                    ("Dispatch", "Dispatch"),
                ],
                default="Open",
                help_text="Investigation report status",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="full_case_status",
            field=models.CharField(
                choices=[
                    ("WIP", "WIP"),
                    ("Pending CS", "Pending CS"),
                    ("Completed", "Completed"),
                    ("IR-Writing", "IR-Writing"),
                    ("NI", "NI"),
                    ("Withdraw", "Withdraw"),
                    ("QC-1", "QC-1"),
                    ("Pending Additional Docs", "Pending Additional Docs"),
                    ("Connected Pending", "Connected Pending"),
                    ("RCU Pending", "RCU Pending"),
                    ("Portal Upload", "Portal Upload"),
                ],
                default="WIP",
                help_text="Detailed case status",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="insurancecase",
            name="scope_of_work",
            field=models.TextField(blank=True, help_text="Scope of work for this case", default=""),
            preserve_default=False,
        ),
    ]
