"""
Eugene Intelligence — Email briefs.

Send research briefs, debates, and simulations via email.

Environment:
  SMTP_HOST — SMTP server (default: smtp.gmail.com)
  SMTP_PORT — SMTP port (default: 587)
  SMTP_USER — SMTP username/email
  SMTP_PASS — SMTP password or app password
  SMTP_FROM — From address (defaults to SMTP_USER)
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    """Check if SMTP is configured."""
    return bool(os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASS"))


def send_brief(to_email: str, subject: str, brief: dict, brief_type: str = "research") -> dict:
    """Send a research brief, debate, or simulation via email.

    Args:
        to_email: Recipient email address
        subject: Email subject line
        brief: The brief data (dict from research/debate/simulation endpoint)
        brief_type: One of "research", "debate", "simulation"

    Returns:
        dict with status and message
    """
    if not is_configured():
        return {"error": "Email not configured. Set SMTP_USER and SMTP_PASS environment variables."}

    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ["SMTP_USER"]
    smtp_pass = os.environ["SMTP_PASS"]
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)

    html = _render_brief_html(brief, brief_type, subject)
    plain = _render_brief_text(brief, brief_type)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Eugene Intelligence <{smtp_from}>"
    msg["To"] = to_email
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        logger.info("Email sent to %s: %s", to_email, subject)
        return {"status": "sent", "to": to_email, "subject": subject}
    except Exception as e:
        logger.error("Email failed to %s: %s", to_email, e)
        return {"error": f"Failed to send email: {e}"}


def _render_brief_html(brief: dict, brief_type: str, subject: str) -> str:
    """Render a brief as HTML email."""
    date = datetime.utcnow().strftime("%B %d, %Y")

    body_sections = ""

    if brief_type == "research":
        thesis = brief.get("thesis", brief.get("summary", ""))
        body_sections += f'<div style="margin-bottom:24px;"><h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Thesis</h2><p style="color:#475569;line-height:1.6;margin:0;">{thesis}</p></div>'

        for section_name in ["key_points", "risks", "catalysts", "financials_summary"]:
            items = brief.get(section_name, [])
            if items:
                title = section_name.replace("_", " ").title()
                body_sections += f'<div style="margin-bottom:24px;"><h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">{title}</h2><ul style="color:#475569;line-height:1.8;margin:0;padding-left:20px;">'
                if isinstance(items, list):
                    for item in items:
                        body_sections += f"<li>{item}</li>"
                else:
                    body_sections += f"<li>{items}</li>"
                body_sections += "</ul></div>"

        confidence = brief.get("confidence")
        if confidence:
            body_sections += f'<div style="margin-bottom:24px;padding:12px 16px;background:#f0fdf4;border-radius:8px;"><strong style="color:#166534;">Confidence:</strong> <span style="color:#166534;">{confidence}</span></div>'

    elif brief_type == "debate":
        for side in ["bull", "bear", "synthesis"]:
            data = brief.get(side, {})
            if data:
                label = side.title()
                color = "#166534" if side == "bull" else "#991b1b" if side == "bear" else "#1e40af"
                thesis = data.get("thesis", data.get("summary", ""))
                body_sections += f'<div style="margin-bottom:24px;padding:16px;border-left:4px solid {color};background:#f8fafc;border-radius:0 8px 8px 0;">'
                body_sections += f'<h2 style="color:{color};font-size:18px;margin:0 0 8px;">{label} Case</h2>'
                body_sections += f'<p style="color:#475569;line-height:1.6;margin:0;">{thesis}</p>'
                points = data.get("key_points", [])
                if points:
                    body_sections += '<ul style="color:#475569;line-height:1.8;margin:8px 0 0;padding-left:20px;">'
                    for p in points:
                        body_sections += f"<li>{p}</li>"
                    body_sections += "</ul>"
                body_sections += "</div>"

    elif brief_type == "simulation":
        agents = brief.get("agents", brief.get("perspectives", []))
        if isinstance(agents, list):
            for agent in agents:
                name = agent.get("name", agent.get("persona", "Agent"))
                view = agent.get("view", agent.get("analysis", ""))
                body_sections += '<div style="margin-bottom:16px;padding:12px 16px;background:#f8fafc;border-radius:8px;">'
                body_sections += f'<strong style="color:#1e293b;">{name}</strong>'
                body_sections += f'<p style="color:#475569;line-height:1.6;margin:4px 0 0;">{view}</p></div>'
        consensus = brief.get("consensus", brief.get("synthesis", ""))
        if consensus:
            body_sections += f'<div style="margin-top:24px;padding:16px;background:#eff6ff;border-radius:8px;"><h2 style="color:#1e40af;font-size:18px;margin:0 0 8px;">Consensus</h2><p style="color:#475569;line-height:1.6;margin:0;">{consensus}</p></div>'

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
  <div style="border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="color:#0f172a;font-size:22px;margin:0;">{subject}</h1>
    <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">{date} &middot; Eugene Intelligence</p>
  </div>
  {body_sections}
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:32px;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">Generated by Eugene Intelligence &middot; eugeneintelligence.com</p>
    <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">Not investment advice. Data from SEC EDGAR, FRED, and public sources.</p>
  </div>
</body>
</html>"""


def _render_brief_text(brief: dict, brief_type: str) -> str:
    """Render a brief as plain text fallback."""
    lines = []

    if brief_type == "research":
        lines.append(brief.get("thesis", brief.get("summary", "")))
        lines.append("")
        for section in ["key_points", "risks", "catalysts"]:
            items = brief.get(section, [])
            if items:
                lines.append(section.replace("_", " ").upper())
                if isinstance(items, list):
                    for item in items:
                        lines.append(f"  - {item}")
                else:
                    lines.append(f"  - {items}")
                lines.append("")

    elif brief_type == "debate":
        for side in ["bull", "bear", "synthesis"]:
            data = brief.get(side, {})
            if data:
                lines.append(f"{side.upper()} CASE")
                lines.append(data.get("thesis", data.get("summary", "")))
                for p in data.get("key_points", []):
                    lines.append(f"  - {p}")
                lines.append("")

    elif brief_type == "simulation":
        for agent in brief.get("agents", brief.get("perspectives", [])):
            name = agent.get("name", agent.get("persona", ""))
            lines.append(f"{name}: {agent.get('view', agent.get('analysis', ''))}")
        consensus = brief.get("consensus", brief.get("synthesis", ""))
        if consensus:
            lines.append(f"\nCONSENSUS: {consensus}")

    lines.append("\n---\nGenerated by Eugene Intelligence\nNot investment advice.")
    return "\n".join(lines)
