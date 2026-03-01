from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _safe(value):
    if value is None or value == "":
        return "N/A"
    return str(value)


def _section_title(story, styles, title: str):
    story.append(Paragraph(title, styles["Heading2"]))
    story.append(Spacer(1, 6))


def _styled_two_col_table(rows: list[list[str]]):
    table = Table(rows, colWidths=[170, 350])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return table


def build_model_report_pdf(report_data: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title="Model Analysis Report")
    styles = getSampleStyleSheet()
    story = []

    model = report_data.get("model", {})
    dataset = report_data.get("dataset", {})
    metrics = report_data.get("metrics", {})
    shap_data = report_data.get("shap", {})
    governance = report_data.get("governance", {})
    ai = report_data.get("ai", {})

    story.append(Paragraph("MODEL ANALYSIS REPORT", styles["Title"]))
    story.append(Spacer(1, 10))

    _section_title(story, styles, "1. Model Information")
    model_rows = [
        ["Model Name", _safe(model.get("name"))],
        ["Model Type", _safe(model.get("type"))],
        ["Features Count", _safe(model.get("features_count"))],
    ]
    story.append(_styled_two_col_table(model_rows))
    story.append(Spacer(1, 10))

    _section_title(story, styles, "2. Dataset Analysis")
    stats = dataset.get("stats", {})
    dataset_rows = [
        ["Rows", _safe(stats.get("rows"))],
        ["Columns", _safe(stats.get("columns"))],
        ["Missing Values", _safe(stats.get("missing_values"))],
    ]
    story.append(_styled_two_col_table(dataset_rows))
    story.append(Spacer(1, 10))

    _section_title(story, styles, "3. Metrics")
    metrics_rows = [
        ["Accuracy", _safe(metrics.get("accuracy"))],
        ["Precision", _safe(metrics.get("precision"))],
        ["Recall", _safe(metrics.get("recall"))],
        ["F1 Score", _safe(metrics.get("f1_score", metrics.get("f1")))],
    ]
    story.append(_styled_two_col_table(metrics_rows))
    story.append(Spacer(1, 10))

    _section_title(story, styles, "4. SHAP Analysis")
    top_features = (
        shap_data.get("global_importance")
        or shap_data.get("feature_importance")
        or [
            {"feature": row.get("feature"), "value": row.get("mean_shap_value")}
            for row in (shap_data.get("global", {}).get("top_features_table") or [])
        ]
    )
    if top_features:
        shap_table_rows = [["Feature", "Importance"]]
        for row in top_features[:10]:
            shap_table_rows.append([_safe(row.get("feature")), _safe(row.get("value"))])
        shap_table = Table(shap_table_rows, colWidths=[300, 220])
        shap_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]
            )
        )
        story.append(shap_table)
    else:
        story.append(Paragraph("No SHAP results available.", styles["BodyText"]))
    story.append(Spacer(1, 10))

    _section_title(story, styles, "5. Governance Analysis")
    governance_rows = [
        ["Dataset Size", _safe(governance.get("dataset_size", stats.get("rows")))],
        ["Model Type", _safe(governance.get("model_type", model.get("type")))],
        ["Risk Level", _safe(governance.get("risk_classification", governance.get("risk_level")))],
    ]
    story.append(_styled_two_col_table(governance_rows))
    story.append(Spacer(1, 10))

    _section_title(story, styles, "6. AI Suggestions")
    suggestions = ai.get("suggestions") or []
    if suggestions:
        for text in suggestions[:10]:
            story.append(Paragraph(f"- {_safe(text)}", styles["BodyText"]))
    else:
        story.append(Paragraph("No suggestions available.", styles["BodyText"]))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
