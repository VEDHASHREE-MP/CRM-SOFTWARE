"""
email_service.py — Email sending for Virtual Tech CRM
Uses Gmail SMTP to send invoice PDF to customer and admin.

Setup:
1. Enable 2-Step Verification on your Gmail account
2. Go to Google Account → Security → App Passwords
3. Generate an app password for "Mail"
4. Add to .env:
    GMAIL_USER=virtualtechzdevelopment@gmail.com
    GMAIL_APP_PASSWORD=your_16_char_app_password
    ADMIN_EMAIL=virtualtechzdevelopment@gmail.com
"""

import os
import smtplib
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text      import MIMEText
from email.mime.base      import MIMEBase
from email                import encoders
from dotenv               import load_dotenv

load_dotenv()

_GMAIL_USER     = os.environ.get('GMAIL_USER',         '')
_GMAIL_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')
_ADMIN_EMAIL    = os.environ.get('ADMIN_EMAIL',        '')


def _is_configured():
    return bool(_GMAIL_USER and _GMAIL_PASSWORD)


def _send_email(to_list: list, subject: str, html_body: str,
                attachment_bytes: bytes = None, attachment_name: str = None) -> bool:
    """Core send function — sends HTML email with optional PDF attachment."""
    if not _is_configured():
        print("⚠️  Email not configured — skipping")
        return False

    try:
        msg = MIMEMultipart('mixed')
        msg['From']    = f'Virtual Tech Services <{_GMAIL_USER}>'
        msg['To']      = ', '.join(to_list)
        msg['Subject'] = subject

        msg.attach(MIMEText(html_body, 'html'))

        if attachment_bytes and attachment_name:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment_bytes)
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename="{attachment_name}"')
            msg.attach(part)

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(_GMAIL_USER, _GMAIL_PASSWORD)
            server.sendmail(_GMAIL_USER, to_list, msg.as_string())

        print(f"✅ Email sent to {', '.join(to_list)}")
        return True

    except Exception:
        traceback.print_exc()
        return False


def _generate_invoice_pdf(invoice: dict, items: list, payments: list) -> bytes:
    """Generate full-width A4 invoice PDF using reportlab."""
    try:
        from reportlab.lib.pagesizes  import A4
        from reportlab.lib            import colors
        from reportlab.lib.styles     import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units      import mm
        from reportlab.platypus       import (SimpleDocTemplate, Table, TableStyle,
                                              Paragraph, Spacer, HRFlowable)
        from reportlab.lib.enums      import TA_RIGHT, TA_CENTER, TA_LEFT
        import io
    except ImportError:
        print("⚠️  reportlab not installed — run: pip install reportlab")
        return None

    buf = io.BytesIO()

    # A4 = 210mm wide. Left+Right margins = 15mm each → usable = 180mm
    LEFT_MARGIN  = 15 * mm
    RIGHT_MARGIN = 15 * mm
    FULL_W       = 210 * mm - LEFT_MARGIN - RIGHT_MARGIN  # 180mm

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=15 * mm, bottomMargin=15 * mm
    )

    styles = getSampleStyleSheet()
    story  = []

    # ── Colour palette ──────────────────────────────────────────────────────
    BLUE   = colors.HexColor('#2563eb')
    DBLUE  = colors.HexColor('#1e40af')
    LGRAY  = colors.HexColor('#f8fafc')
    MGRAY  = colors.HexColor('#e2e8f0')
    WHITE  = colors.white
    LGREEN = colors.HexColor('#dcfce7')
    LRED   = colors.HexColor('#fee2e2')

    def fmt(n):
        return f'Rs.{float(n):,.2f}'

    from datetime import datetime
    try:
        date_str = datetime.fromisoformat(str(invoice.get('created_at', ''))).strftime('%d %B %Y')
    except Exception:
        date_str = str(invoice.get('created_at', ''))[:10]

    def para(text, size=10, color=colors.black, bold=False, align=TA_LEFT):
        weight = 'b' if bold else 'font'
        hex_c  = color.hexval() if hasattr(color, 'hexval') else '#000000'
        markup = f'<{weight}><font size="{size}" color="{hex_c}">{text}</font></{weight}>'
        return Paragraph(markup, ParagraphStyle('p', parent=styles['Normal'], alignment=align))

    def wpara(text, size=10, bold=False, align=TA_LEFT):
        weight = 'b' if bold else 'font'
        markup = f'<{weight}><font size="{size}" color="white">{text}</font></{weight}>'
        return Paragraph(markup, ParagraphStyle('p', parent=styles['Normal'], alignment=align))

    # ── HEADER (full width) ─────────────────────────────────────────────────
    half = FULL_W / 2
    header_data = [[
        wpara('Virtual Tech Services', size=18, bold=True) ,
        wpara(f'INVOICE\n{invoice.get("invoice_number","")}', size=14, bold=True, align=TA_RIGHT),
    ]]
    header_tbl = Table(header_data, colWidths=[half, half])
    header_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), BLUE),
        ('TOPPADDING',   (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 16),
        ('LEFTPADDING',  (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(header_tbl)

    # Thin colour bar under header
    bar_data = [['']]
    bar_tbl  = Table(bar_data, colWidths=[FULL_W], rowHeights=[3])
    bar_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), DBLUE),
        ('TOPPADDING',   (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
    ]))
    story.append(bar_tbl)
    story.append(Spacer(1, 5 * mm))

    # ── BILL TO + DATE + STATUS (full width) ────────────────────────────────
    col1 = FULL_W * 0.55
    col2 = FULL_W * 0.45
    bill_data = [[
        Paragraph(
            f'<font size="8" color="#94a3b8"><b>BILL TO</b></font><br/>'
            f'<font size="15" color="#1e293b"><b>{invoice.get("customer_name","")}</b></font><br/>'
            f'<font size="10" color="#64748b">{invoice.get("phone","")}</font>',
            styles['Normal']
        ),
        Paragraph(
            f'<font size="8" color="#94a3b8"><b>DATE</b></font><br/>'
            f'<font size="10" color="#1e293b"><b>{date_str}</b></font><br/><br/>'
            f'<font size="8" color="#94a3b8"><b>STATUS</b></font><br/>'
            f'<font size="11" color="#1e293b"><b>{invoice.get("status","")}</b></font>',
            ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)
        ),
    ]]
    bill_tbl = Table(bill_data, colWidths=[col1, col2])
    bill_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), LGRAY),
        ('BOX',          (0, 0), (-1, -1), 0.5, MGRAY),
        ('TOPPADDING',   (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 12),
        ('LEFTPADDING',  (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('VALIGN',       (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(bill_tbl)
    story.append(Spacer(1, 5 * mm))

    # ── ITEMS TABLE (full width) ─────────────────────────────────────────────
    # Columns: Description | Qty | Unit Price | Amount
    desc_w  = FULL_W * 0.48
    qty_w   = FULL_W * 0.10
    price_w = FULL_W * 0.22
    amt_w   = FULL_W * 0.20

    def th(text, align=TA_LEFT):
        return Paragraph(
            f'<b><font size="9" color="white">{text}</font></b>',
            ParagraphStyle('h', parent=styles['Normal'], alignment=align)
        )

    def td(text, size=10, align=TA_LEFT, bold=False):
        w = 'b' if bold else 'font'
        return Paragraph(
            f'<{w}><font size="{size}" color="#334155">{text}</font></{w}>',
            ParagraphStyle('d', parent=styles['Normal'], alignment=align)
        )

    item_rows = [[
        th('DESCRIPTION'),
        th('QTY',        align=TA_CENTER),
        th('UNIT PRICE', align=TA_RIGHT),
        th('AMOUNT',     align=TA_RIGHT),
    ]]

    for item in items:
        item_rows.append([
            td(item.get('description', '')),
            td(str(item.get('quantity', '')),           align=TA_CENTER),
            td(fmt(item.get('unit_price', 0)),          align=TA_RIGHT),
            td(fmt(item.get('amount', 0)),              align=TA_RIGHT, bold=True),
        ])

    row_bg = [DBLUE] + [WHITE if i % 2 == 0 else LGRAY for i in range(len(items))]

    items_tbl = Table(item_rows, colWidths=[desc_w, qty_w, price_w, amt_w])
    items_tbl.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), row_bg),
        ('BOX',           (0, 0), (-1, -1), 0.5, MGRAY),
        ('LINEBELOW',     (0, 0), (-1, 0),  0.5, DBLUE),
        ('GRID',          (0, 1), (-1, -1), 0.5, MGRAY),
        ('TOPPADDING',    (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
        ('LEFTPADDING',   (0, 0), (-1, -1), 10),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(items_tbl)
    story.append(Spacer(1, 5 * mm))

    # ── TOTALS (right-aligned block, spans full width layout) ───────────────
    subtotal = float(invoice.get('subtotal',      0))
    discount = float(invoice.get('discount',      0))
    gst_rate = float(invoice.get('gst_rate',      0))
    gst_amt  = float(invoice.get('gst_amount',    0))
    total    = float(invoice.get('total_amount',  0))
    paid     = float(invoice.get('paid_amount',   0))
    due      = float(invoice.get('due_amount',    0))

    # Left spacer col + right totals col
    spacer_w  = FULL_W * 0.50
    totals_w  = FULL_W * 0.50
    label_w   = totals_w * 0.55
    value_w   = totals_w * 0.45

    def trow(label, value, bg, label_color='#64748b', value_color='#1e293b',
             label_size=10, value_size=10, bold=False):
        lw = 'b' if bold else 'font'
        return [
            Paragraph(
                f'<{lw}><font size="{label_size}" color="{label_color}">{label}</font></{lw}>',
                styles['Normal']
            ),
            Paragraph(
                f'<{lw}><font size="{value_size}" color="{value_color}">{value}</font></{lw}>',
                ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)
            ),
        ]

    totals_inner_rows = [trow('Subtotal', fmt(subtotal), LGRAY)]
    if discount > 0:
        totals_inner_rows.append(
            trow('Discount', f'- {fmt(discount)}', WHITE, value_color='#16a34a')
        )
    if gst_rate > 0:
        totals_inner_rows.append(
            trow(f'GST ({gst_rate}%)', fmt(gst_amt), LGRAY)
        )

    # TOTAL row (blue background — needs special styling)
    total_row = [
        Paragraph('<b><font size="12" color="white">TOTAL</font></b>', styles['Normal']),
        Paragraph(f'<b><font size="14" color="white">{fmt(total)}</font></b>',
                  ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)),
    ]
    totals_inner_rows.append(total_row)

    total_row_idx = len(totals_inner_rows) - 1

    if paid > 0:
        totals_inner_rows.append(
            trow('Paid', fmt(paid), LGREEN, label_color='#15803d', value_color='#15803d', bold=True)
        )
    if due > 0:
        totals_inner_rows.append(
            trow('Balance Due', fmt(due), LRED,
                 label_color='#b91c1c', value_color='#b91c1c',
                 label_size=11, value_size=12, bold=True)
        )

    totals_inner = Table(totals_inner_rows, colWidths=[label_w, value_w])

    ts = [
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (-1, -1), 12),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 12),
        ('BOX',           (0, 0), (-1, -1), 0.5, MGRAY),
        ('LINEABOVE',     (0, 0), (-1, 0),  0.5, MGRAY),
        # alternating rows before total
        *[('BACKGROUND', (0, i), (-1, i), LGRAY if i % 2 == 0 else WHITE)
          for i in range(total_row_idx)],
        ('BACKGROUND', (0, total_row_idx), (-1, total_row_idx), DBLUE),
    ]
    if paid > 0:
        ts.append(('BACKGROUND', (0, total_row_idx + 1), (-1, total_row_idx + 1), LGREEN))
    if due > 0:
        ts.append(('BACKGROUND', (0, len(totals_inner_rows) - 1), (-1, -1), LRED))

    totals_inner.setStyle(TableStyle(ts))

    # Wrap in full-width outer table (spacer | totals)
    outer_totals = Table([[Paragraph(''), totals_inner]], colWidths=[spacer_w, totals_w])
    outer_totals.setStyle(TableStyle([
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(outer_totals)

    # ── PAYMENT HISTORY ──────────────────────────────────────────────────────
    if payments:
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph(
            '<font size="9" color="#64748b"><b>PAYMENT HISTORY</b></font>',
            styles['Normal']
        ))
        story.append(Spacer(1, 2 * mm))

        date_w = FULL_W * 0.18
        mode_w = FULL_W * 0.18
        ref_w  = FULL_W * 0.44
        pamt_w = FULL_W * 0.20

        pay_rows = [[
            Paragraph('<b><font size="9" color="#15803d">Date</font></b>',      styles['Normal']),
            Paragraph('<b><font size="9" color="#15803d">Mode</font></b>',      styles['Normal']),
            Paragraph('<b><font size="9" color="#15803d">Reference</font></b>', styles['Normal']),
            Paragraph('<b><font size="9" color="#15803d">Amount</font></b>',
                      ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)),
        ]]
        for p in payments:
            pay_rows.append([
                Paragraph(f'<font size="9">{p.get("payment_date","")}</font>', styles['Normal']),
                Paragraph(f'<font size="9">{p.get("payment_mode","")}</font>', styles['Normal']),
                Paragraph(f'<font size="9">{p.get("notes","") or "—"}</font>', styles['Normal']),
                Paragraph(
                    f'<font size="9" color="#15803d"><b>{fmt(p.get("amount",0))}</b></font>',
                    ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)
                ),
            ])

        pay_tbl = Table(pay_rows, colWidths=[date_w, mode_w, ref_w, pamt_w])
        pay_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0),  colors.HexColor('#dcfce7')),
            ('ROWBACKGROUNDS',(0, 1), (-1, -1), [WHITE, LGRAY]),
            ('BOX',           (0, 0), (-1, -1), 0.5, colors.HexColor('#d1fae5')),
            ('GRID',          (0, 0), (-1, -1), 0.5, colors.HexColor('#d1fae5')),
            ('TOPPADDING',    (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING',   (0, 0), (-1, -1), 10),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
        ]))
        story.append(pay_tbl)

    # ── FOOTER (full width) ──────────────────────────────────────────────────
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width='100%', thickness=0.5,
                             color=colors.HexColor('#e2e8f0'), dash=(4, 4)))
    story.append(Spacer(1, 4 * mm))

    f1 = FULL_W * 0.38
    f2 = FULL_W * 0.38
    f3 = FULL_W * 0.24

    footer_data = [[
        Paragraph(
            '<font size="11" color="#2563eb"><b>Virtual Tech Services</b></font><br/>'
            '<font size="8" color="#94a3b8">CRM Billing System</font>',
            styles['Normal']
        ),
        Paragraph(
            '<font size="11" color="#334155"><b>Thank you for your business!</b></font><br/>'
            '<font size="8" color="#94a3b8">Generated by Virtual Tech CRM</font>',
            ParagraphStyle('c', parent=styles['Normal'], alignment=TA_CENTER)
        ),
        Paragraph(
            f'<font size="8" color="#94a3b8">Invoice No.</font><br/>'
            f'<font size="11" color="#334155"><b>{invoice.get("invoice_number","")}</b></font>',
            ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)
        ),
    ]]
    footer_tbl = Table(footer_data, colWidths=[f1, f2, f3])
    footer_tbl.setStyle(TableStyle([
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(footer_tbl)

    doc.build(story)
    return buf.getvalue()


# ── Email HTML templates (table-based, email-client safe) ────────────────────

def _row(label: str, value: str, value_color: str = '#1e293b') -> str:
    """Single label/value row using a table — works in all email clients."""
    return f'''
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#64748b;width:45%;vertical-align:top;">{label}</td>
      <td style="padding:6px 0;font-size:13px;font-weight:700;color:{value_color};
                 width:55%;text-align:right;vertical-align:top;">{value}</td>
    </tr>'''


def _invoice_email_html(invoice: dict) -> str:
    total = float(invoice.get('total_amount', 0))
    paid  = float(invoice.get('paid_amount',  0))
    due   = float(invoice.get('due_amount',   0))

    rows  = _row('Invoice Number', invoice.get('invoice_number', ''))
    rows += _row('Total Amount',   f'&#8377;{total:,.2f}')
    rows += _row('Amount Paid',    f'&#8377;{paid:,.2f}',  '#16a34a')
    rows += f'''
    <tr><td colspan="2" style="padding:0;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td colspan="2" style="padding:8px 0 0;border-top:1px solid #e2e8f0;"></td></tr>
      {_row('Balance Due', f'&#8377;{due:,.2f}', '#b91c1c')}
    </table></td></tr>'''

    return f'''
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
                background:#f8fafc;padding:20px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;
                  box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);
                       padding:28px 32px;">
              <div style="font-size:22px;font-weight:900;color:#ffffff;">
                Virtual Tech Services
              </div>
              <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">
                Invoice {invoice.get("invoice_number","")}
              </div>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:28px 32px;">
              <p style="font-size:15px;color:#334155;margin:0 0 8px;">
                Dear <strong>{invoice.get("customer_name","")}</strong>,
              </p>
              <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
                Please find your invoice attached. Here&rsquo;s a summary:
              </p>

              <!-- Summary box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f1f5f9;border-radius:10px;
                            padding:4px 0;">
                <tr><td style="padding:0 22px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    {rows}
                  </table>
                </td></tr>
              </table>

              <p style="font-size:13px;color:#94a3b8;margin:20px 0 0;">
                If you have any questions, please contact us.
              </p>
              <p style="font-size:14px;font-weight:600;color:#2563eb;margin:16px 0 0;">
                Thank you for your business! &#x1F64F;
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;
                       border-top:1px solid #e2e8f0;text-align:center;">
              <span style="font-size:12px;color:#94a3b8;">
                Virtual Tech Services &middot; CRM Billing System
              </span>
            </td>
          </tr>
        </table>

      </div>
    </div>'''


def _admin_email_html(invoice: dict) -> str:
    total = float(invoice.get('total_amount', 0))
    due   = float(invoice.get('due_amount',   0))

    rows  = _row('Customer',       invoice.get('customer_name', ''))
    rows += _row('Phone',          invoice.get('phone', ''))
    rows += _row('Invoice',        invoice.get('invoice_number', ''))
    rows += _row('Total',          f'&#8377;{total:,.2f}')
    rows += _row('Balance Due',    f'&#8377;{due:,.2f}', '#b91c1c')

    return f'''
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
                background:#f8fafc;padding:20px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;
                  box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#10b981);
                       padding:28px 32px;">
              <div style="font-size:22px;font-weight:900;color:#ffffff;">
                Virtual Tech CRM
              </div>
              <div style="font-size:13px;color:#a7f3d0;margin-top:4px;">
                Invoice Sent &mdash; {invoice.get("invoice_number","")}
              </div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:28px 32px;">
              <p style="font-size:15px;color:#334155;margin:0 0 20px;">
                Invoice sent to customer successfully.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f1f5f9;border-radius:10px;">
                <tr><td style="padding:4px 22px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    {rows}
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;
                       border-top:1px solid #e2e8f0;text-align:center;">
              <span style="font-size:12px;color:#94a3b8;">Virtual Tech CRM</span>
            </td>
          </tr>
        </table>

      </div>
    </div>'''


def _session_email_html(session: dict) -> str:
    from datetime import datetime

    try:
        date_obj = datetime.strptime(str(session.get('session_date', '')), '%Y-%m-%d')
        date_str = date_obj.strftime('%A, %d %B %Y')
    except Exception:
        date_str = str(session.get('session_date', ''))

    time_str = session.get('session_time', '')
    try:
        h, m  = time_str.split(':')
        hour  = int(h)
        time_str = f"{hour % 12 or 12}:{m} {'AM' if hour < 12 else 'PM'}"
    except Exception:
        pass

    mode      = session.get('mode', 'offline')
    loc_link  = session.get('location_or_link') or ('Online Session' if mode == 'online' else 'Our Office')
    loc_label = 'Meeting Link' if mode == 'online' else 'Location'
    mode_text = '&#x1F4BB; Online' if mode == 'online' else '&#x1F3E2; Offline'
    staff     = session.get('staff_name') or 'To be assigned'
    notes     = session.get('notes') or ''

    rows  = _row('Service',   session.get('service', ''))
    rows += _row('Date',      date_str)
    rows += _row('Time',      time_str)
    rows += _row('Duration',  session.get('duration', ''))
    rows += _row('Mode',      mode_text)
    rows += _row(loc_label,   loc_link, '#2563eb')
    rows += _row('Staff',     staff)
    if notes:
        rows += _row('Notes', notes)

    return f'''
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
                background:#f8fafc;padding:20px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;
                  box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);
                       padding:28px 32px;">
              <div style="font-size:22px;font-weight:900;color:#ffffff;">
                Virtual Tech Services
              </div>
              <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">
                Session Confirmation
              </div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:28px 32px;">
              <p style="font-size:15px;color:#334155;margin:0 0 8px;">
                Dear <strong>{session.get("customer_name","")}</strong>,
              </p>
              <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
                Your session has been confirmed. Here are the details:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f1f5f9;border-radius:10px;">
                <tr><td style="padding:4px 22px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    {rows}
                  </table>
                </td></tr>
              </table>

              <p style="font-size:13px;color:#94a3b8;margin:20px 0 0;">
                If you need to reschedule or have questions, please contact us.
              </p>
              <p style="font-size:14px;font-weight:600;color:#2563eb;margin:16px 0 0;">
                Looking forward to seeing you! &#x1F64F;
              </p>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;
                       border-top:1px solid #e2e8f0;text-align:center;">
              <span style="font-size:12px;color:#94a3b8;">
                Virtual Tech Services &middot; CRM System
              </span>
            </td>
          </tr>
        </table>

      </div>
    </div>'''


def _admin_session_email_html(session: dict, customer_email: str) -> str:
    rows  = _row('Customer',     session.get('customer_name', ''))
    rows += _row('Email Sent To', customer_email, '#2563eb')
    rows += _row('Service',      session.get('service', ''))
    rows += _row('Date',         str(session.get('session_date', '')))
    rows += _row('Time',         str(session.get('session_time', '')))

    return f'''
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
                background:#f8fafc;padding:20px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;
                  box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#10b981);
                       padding:28px 32px;">
              <div style="font-size:22px;font-weight:900;color:#ffffff;">
                Virtual Tech CRM
              </div>
              <div style="font-size:13px;color:#a7f3d0;margin-top:4px;">
                Session Confirmation Sent
              </div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:28px 32px;">
              <p style="font-size:15px;color:#334155;margin:0 0 20px;">
                Session confirmation sent to customer successfully.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f1f5f9;border-radius:10px;">
                <tr><td style="padding:4px 22px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    {rows}
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;
                       border-top:1px solid #e2e8f0;text-align:center;">
              <span style="font-size:12px;color:#94a3b8;">Virtual Tech CRM</span>
            </td>
          </tr>
        </table>

      </div>
    </div>'''


def send_session_email(session: dict, customer_email: str) -> dict:
    """Send session confirmation email to customer and notify admin."""
    customer_ok = _send_email(
        to_list   = [customer_email],
        subject   = f'Session Confirmation — {session.get("service","")} | Virtual Tech Services',
        html_body = _session_email_html(session),
    )
    admin_ok = False
    if _ADMIN_EMAIL:
        admin_ok = _send_email(
            to_list   = [_ADMIN_EMAIL],
            subject   = f'[CRM] Session confirmation sent to {session.get("customer_name","")}',
            html_body = _admin_session_email_html(session, customer_email),
        )
    return {'customer': customer_ok, 'admin': admin_ok}


def send_invoice_email(invoice: dict, items: list, payments: list,
                       customer_email: str) -> dict:
    """Send invoice PDF to customer and notify admin."""
    pdf_bytes  = _generate_invoice_pdf(invoice, items, payments)
    inv_number = invoice.get('invoice_number', 'Invoice')
    filename   = f'{inv_number}.pdf'

    customer_ok = _send_email(
        to_list          = [customer_email],
        subject          = f'Your Invoice {inv_number} — Virtual Tech Services',
        html_body        = _invoice_email_html(invoice),
        attachment_bytes = pdf_bytes,
        attachment_name  = filename,
    )
    admin_ok = False
    if _ADMIN_EMAIL:
        admin_ok = _send_email(
            to_list          = [_ADMIN_EMAIL],
            subject          = f'[CRM] Invoice {inv_number} sent to {invoice.get("customer_name","")}',
            html_body        = _admin_email_html(invoice),
            attachment_bytes = pdf_bytes,
            attachment_name  = filename,
        )
    return {'customer': customer_ok, 'admin': admin_ok}