import os
import shutil

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Flowable,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS = r"C:\Users\kfrem\Downloads"
SITE_DOWNLOADS = os.path.join(ROOT, "assets", "downloads")

CLIENT_PDF = os.path.join(SITE_DOWNLOADS, "sarmad-global-mtd-client-guide.pdf")
WHITE_LABEL_PDF = os.path.join(SITE_DOWNLOADS, "mtd-client-guide-for-practices-white-label.pdf")
PRACTICE_PDF = os.path.join(SITE_DOWNLOADS, "sarmad-global-mtd-practice-implementation-guide.pdf")
LEGACY_PRACTICE_PDF = os.path.join(SITE_DOWNLOADS, "sarmad-global-mtd-practice-guide.pdf")

NAVY = colors.HexColor("#0D131A")
INK = colors.HexColor("#1D2533")
MUTED = colors.HexColor("#5E6C86")
GOLD = colors.HexColor("#D4AF37")
LIGHT = colors.HexColor("#F4F6FA")
GREEN = colors.HexColor("#16A765")
RED = colors.HexColor("#C0392B")
WHITE = colors.white


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        parent=styles["Title"],
        fontName="Times-Bold",
        fontSize=31,
        leading=37,
        textColor=WHITE,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="SectionTitle",
        parent=styles["Heading1"],
        fontName="Times-Bold",
        fontSize=22,
        leading=27,
        textColor=NAVY,
        spaceBefore=6,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        name="SubTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=NAVY,
        spaceBefore=8,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.1,
        leading=15.2,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=10.8,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        name="Callout",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=11.1,
        leading=15,
        textColor=NAVY,
    )
)
styles.add(
    ParagraphStyle(
        name="TableHead",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9.3,
        leading=11.5,
        textColor=WHITE,
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="TableCell",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=INK,
    )
)


def P(text, style="Body"):
    return Paragraph(text, styles[style])


class CoverBlock(Flowable):
    def __init__(self, width, height, label, title, subtitle, audience):
        super().__init__()
        self.width = width
        self.height = height
        self.label = label
        self.title = title
        self.subtitle = subtitle
        self.audience = audience

    def draw(self):
        c = self.canv
        c.setFillColor(NAVY)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        c.setStrokeColor(GOLD)
        c.setLineWidth(2)
        c.line(0, self.height - 12 * mm, self.width, self.height - 12 * mm)
        c.setFillColor(GOLD)
        c.roundRect(18 * mm, self.height - 34 * mm, 46 * mm, 9 * mm, 2 * mm, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(41 * mm, self.height - 31 * mm, self.label)
        c.setFillColor(WHITE)
        c.setFont("Times-Bold", 28)
        for line_no, line in enumerate(self.title.split("\n")):
            c.drawCentredString(self.width / 2, self.height - (58 + line_no * 12) * mm, line)
        c.setFillColor(colors.HexColor("#DDE3EA"))
        c.setFont("Helvetica", 11)
        c.drawCentredString(self.width / 2, self.height - 88 * mm, self.subtitle)
        c.setFillColor(GOLD)
        c.circle(self.width / 2, self.height - 106 * mm, 2.5 * mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(self.width / 2, 47 * mm, self.audience)
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.HexColor("#C8D0DA"))
        c.drawCentredString(self.width / 2, 37 * mm, "Sarmad Global | Bookkeeping | MTD Readiness | Practice Systems")
        c.drawCentredString(self.width / 2, 27 * mm, "Prepared May 2026")


class FlowChart(Flowable):
    def __init__(self, steps, width=165 * mm, box_height=18 * mm, accent=GOLD):
        super().__init__()
        self.steps = steps
        self.width = width
        self.box_height = box_height
        self.accent = accent
        self.gap = 7 * mm
        self.height = len(steps) * box_height + (len(steps) - 1) * self.gap

    def draw(self):
        c = self.canv
        y = self.height - self.box_height
        for i, (title, body) in enumerate(self.steps):
            c.setFillColor(WHITE)
            c.setStrokeColor(self.accent)
            c.setLineWidth(1.2)
            c.roundRect(0, y, self.width, self.box_height, 3 * mm, fill=1, stroke=1)
            c.setFillColor(self.accent)
            c.circle(7 * mm, y + self.box_height / 2, 3.8 * mm, fill=1, stroke=0)
            c.setFillColor(NAVY)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(7 * mm, y + self.box_height / 2 - 2.2, str(i + 1))
            c.setFillColor(NAVY)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(15 * mm, y + self.box_height - 7 * mm, title)
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 8.4)
            c.drawString(15 * mm, y + 5 * mm, body[:112])
            if i < len(self.steps) - 1:
                x = self.width / 2
                c.setStrokeColor(self.accent)
                c.setLineWidth(1.2)
                c.line(x, y - 1 * mm, x, y - self.gap + 1.2 * mm)
                c.line(x, y - self.gap + 1.2 * mm, x - 1.8 * mm, y - self.gap + 4 * mm)
                c.line(x, y - self.gap + 1.2 * mm, x + 1.8 * mm, y - self.gap + 4 * mm)
            y -= self.box_height + self.gap


class FirmDetailsForm(Flowable):
    def __init__(self, prefix):
        super().__init__()
        self.prefix = prefix
        self.width = 165 * mm
        self.height = 74 * mm

    def draw(self):
        c = self.canv
        fields = [
            ("Firm name", "firm_name"),
            ("Contact name", "contact_name"),
            ("Telephone", "telephone"),
            ("Email", "email"),
            ("Website", "website"),
            ("Practice notes for clients", "notes"),
        ]
        y = self.height - 10 * mm
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(0, y + 5 * mm, "Optional practice details")
        for label, key in fields:
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(0, y, label)
            field_height = 7 * mm if key != "notes" else 16 * mm
            abs_x, abs_y = c.absolutePosition(43 * mm, y - field_height - 1.5 * mm)
            c.acroForm.textfield(
                name=f"{self.prefix}_{key}",
                tooltip=label,
                x=abs_x,
                y=abs_y,
                width=120 * mm,
                height=field_height,
                borderWidth=0.6,
                borderColor=colors.HexColor("#B8C2D0"),
                fillColor=colors.HexColor("#F8FAFC"),
                textColor=INK,
                forceBorder=True,
            )
            y -= 10 * mm if key != "notes" else 20 * mm


def bullet_list(items, color=GOLD):
    return ListFlowable(
        [ListItem(P(item), leftIndent=3 * mm) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=8 * mm,
        bulletFontName="Helvetica",
        bulletFontSize=7,
        bulletColor=color,
    )


def info_table(data, col_widths):
    table = Table(data, colWidths=col_widths, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D7DEE8")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFFFF"), LIGHT]),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def callout(text, color=GOLD):
    table = Table([[P(text, "Callout")]], colWidths=[165 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF9E6")),
                ("BOX", (0, 0), (-1, -1), 0.9, color),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D9DEE7"))
    canvas.setLineWidth(0.4)
    canvas.line(doc.leftMargin, 15 * mm, A4[0] - doc.rightMargin, 15 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 9 * mm, doc.title[:70])
    canvas.drawRightString(A4[0] - doc.rightMargin, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def sources_table(sources):
    rows = [[P("HMRC/GOV.UK page", "TableHead"), P("Link", "TableHead")]]
    for title, url in sources:
        rows.append([P(title, "TableCell"), P(url, "TableCell")])
    return info_table(rows, [72 * mm, 93 * mm])


COMMON_SOURCES = [
    ("Making Tax Digital for Income Tax", "https://www.gov.uk/government/publications/making-tax-digital"),
    ("Use Making Tax Digital for Income Tax", "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax"),
    ("Send quarterly updates", "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates"),
    ("Create digital records", "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/keep-digital-records"),
    ("Choose MTD software", "https://www.gov.uk/guidance/choose-the-right-software-for-making-tax-digital-for-income-tax"),
    ("MTD penalties", "https://www.gov.uk/guidance/penalties-for-making-tax-digital-for-income-tax"),
]


AGENT_SOURCES = COMMON_SOURCES + [
    ("HMRC agent toolkit", "https://www.gov.uk/guidance/get-ready-for-mtd-an-agent-toolkit"),
    ("Agent toolkit: planning", "https://www.gov.uk/guidance/get-ready-for-mtd-an-agent-toolkit/planning"),
    ("Agent toolkit: preparing your practice", "https://www.gov.uk/guidance/get-ready-for-mtd-an-agent-toolkit/preparing-your-practice"),
    ("Agent toolkit: preparing your clients", "https://www.gov.uk/guidance/get-ready-for-mtd-an-agent-toolkit/preparing-your-clients"),
    ("Add client authorisations", "https://www.gov.uk/guidance/add-your-client-authorisations-for-making-tax-digital-for-income-tax"),
    ("Sign up your client", "https://www.gov.uk/guidance/sign-up-your-client-for-making-tax-digital-for-income-tax/"),
    ("Access MTD after sign-up", "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/access-your-new-making-tax-digital-for-income-tax-service-after-you-sign-up"),
]


def public_client_story():
    story = [
        CoverBlock(A4[0] - 52 * mm, A4[1] - 48 * mm, "CLIENT GUIDE", "Making Tax Digital\nfor Income Tax", "A plain-English guide for sole traders and landlords", "Sarmad Global public and client edition"),
        PageBreak(),
        P("Making Tax Digital: the simple client guide", "SectionTitle"),
        P("Making Tax Digital for Income Tax is HMRC's move from once-a-year reporting to digital record keeping and regular updates through compatible software. This guide explains what changes, what records you need, and how to avoid last-minute pressure."),
        callout("Need help turning messy records into clean MTD-ready data? Contact Sarmad Global. Our specialist bookkeeping team can organise your records, prepare your quarterly information and support your filing process regardless of the software you currently use."),
        Spacer(1, 5 * mm),
        P("Who is affected and when?", "SubTitle"),
        info_table(
            [
                [P("Start date", "TableHead"), P("Who HMRC says is brought in", "TableHead"), P("What this means", "TableHead")],
                [P("6 April 2026", "TableCell"), P("Sole traders and landlords with qualifying self-employment and property income over GBP50,000.", "TableCell"), P("Digital records and quarterly updates are required using compatible software.", "TableCell")],
                [P("6 April 2027", "TableCell"), P("Income over GBP30,000.", "TableCell"), P("More clients join the system.", "TableCell")],
                [P("6 April 2028", "TableCell"), P("Income over GBP20,000.", "TableCell"), P("A wider group of small businesses and landlords join.", "TableCell")],
            ],
            [31 * mm, 73 * mm, 61 * mm],
        ),
        PageBreak(),
        P("The new routine", "SubTitle"),
        FlowChart(
            [
                ("Record digitally", "Income and expenses are entered or imported into compatible software."),
                ("Clean the data", "Bank feeds, receipts and invoices are checked and coded properly."),
                ("Review each quarter", "Figures are reviewed and questions are resolved before filing."),
                ("Send HMRC update", "The quarterly update is submitted through compatible software."),
                ("Finalise the tax return", "Year-end adjustments and tax return details are completed after year end."),
            ]
        ),
        PageBreak(),
        P("Quarterly deadlines", "SectionTitle"),
        P("HMRC allows standard update periods and calendar update periods. The filing deadline is the same under both patterns. Your software and accountant should confirm which period basis is being used."),
        info_table(
            [
                [P("Deadline", "TableHead"), P("Standard period", "TableHead"), P("Calendar period", "TableHead"), P("Client action date", "TableHead")],
                [P("7 August", "TableCell"), P("6 April to 5 July", "TableCell"), P("1 April to 30 June", "TableCell"), P("Send records by 25 July", "TableCell")],
                [P("7 November", "TableCell"), P("6 April to 5 October", "TableCell"), P("1 April to 30 September", "TableCell"), P("Send records by 25 October", "TableCell")],
                [P("7 February", "TableCell"), P("6 April to 5 January", "TableCell"), P("1 April to 31 December", "TableCell"), P("Send records by 25 January", "TableCell")],
                [P("7 May", "TableCell"), P("6 April to 5 April", "TableCell"), P("1 April to 31 March", "TableCell"), P("Send records by 25 April", "TableCell")],
            ],
            [27 * mm, 45 * mm, 47 * mm, 46 * mm],
        ),
        Spacer(1, 6 * mm),
        callout("HMRC says each quarterly update is cumulative from the start of the tax year. Correcting the records in the next update is usually better than rushing incomplete numbers."),
        Spacer(1, 6 * mm),
        P("What clients should provide", "SubTitle"),
        bullet_list(
            [
                "Bank statements and bank-feed access where available.",
                "Sales invoices, platform income, till summaries and other income records.",
                "Purchase invoices, receipts, mileage and expense records.",
                "Payroll and pension information, where relevant.",
                "VAT records, if VAT registered.",
                "Notes for unusual transactions, loans, cash payments or private expenses.",
            ]
        ),
        PageBreak(),
        P("Penalties and practical protection", "SectionTitle"),
        P("HMRC has introduced points-based late submission penalties. HMRC guidance says there are no penalty points for late quarterly updates in the 2026 to 2027 tax year, but updates still need to be submitted before the tax return can be completed. After that first year, missed quarterly update deadlines can create penalty points."),
        FlowChart(
            [
                ("Miss a submission deadline", "A penalty point can be added after the 2026 to 2027 tax year."),
                ("Reach 4 points", "HMRC charges a GBP200 penalty."),
                ("Miss another deadline", "HMRC charges another GBP200 penalty."),
                ("Points stay on record", "Points can remain until HMRC conditions are met."),
            ],
            accent=RED,
        ),
        Spacer(1, 6 * mm),
        P("How Sarmad Global helps", "SubTitle"),
        info_table(
            [
                [P("Problem", "TableHead"), P("Sarmad Global support", "TableHead")],
                [P("Messy records", "TableCell"), P("We clean, code and reconcile data so it is ready for quarterly review.", "TableCell")],
                [P("Software uncertainty", "TableCell"), P("We work with common bookkeeping and bridging software and can advise on a practical setup.", "TableCell")],
                [P("Deadline pressure", "TableCell"), P("We set quarterly action dates and prepare figures before HMRC deadlines.", "TableCell")],
                [P("No time to manage it", "TableCell"), P("We can provide bookkeeping support so your data is clean before quarterly deadlines.", "TableCell")],
            ],
            [55 * mm, 110 * mm],
        ),
        PageBreak(),
        P("HMRC sources used", "SectionTitle"),
        P("This guide is based on official HMRC and GOV.UK guidance available on 25 May 2026:", "Body"),
        sources_table(COMMON_SOURCES),
        Spacer(1, 7 * mm),
        P("This document is a plain-English client guide. It is not a substitute for tailored tax advice. Filing duties can depend on income level, business structure, property income, exemptions, software choices and HMRC updates.", "Small"),
        Spacer(1, 8 * mm),
        callout("For further assistance with MTD readiness, bookkeeping data clean-up, software workflows or quarterly reporting, contact Sarmad Global: sarmad.accountant@yahoo.com | 020 8646 3666 | sarmadglobal.finaccord.pro", GREEN),
    ]
    return story


def white_label_client_story():
    story = [
        CoverBlock(A4[0] - 52 * mm, A4[1] - 48 * mm, "CLIENT HANDOUT", "Making Tax Digital\nfor Income Tax", "A client-friendly guide for accounting practices to brand and share", "White-label practice edition"),
        PageBreak(),
        P("Making Tax Digital: client briefing", "SectionTitle"),
        P("This guide is prepared for accounting practices to share with their own clients. It explains Making Tax Digital for Income Tax in plain English without turning the document into a Sarmad Global sales document."),
        callout("Practice use: enter your firm details in the editable section near the end before sharing this PDF with clients. This keeps the relationship between your practice and your client clear."),
        Spacer(1, 5 * mm),
        P("The client message", "SubTitle"),
        bullet_list(
            [
                "MTD changes the routine for record keeping and reporting.",
                "Affected sole traders and landlords will need digital records and compatible software.",
                "Quarterly updates are summaries of income and expenses, not full tax returns.",
                "The final tax return still deals with final adjustments and other income.",
                "Clients should send records early so the practice can review, correct and submit on time.",
            ]
        ),
        Spacer(1, 5 * mm),
        P("Who is affected and when?", "SubTitle"),
        info_table(
            [
                [P("Start date", "TableHead"), P("Who joins", "TableHead"), P("Client action", "TableHead")],
                [P("6 April 2026", "TableCell"), P("Qualifying self-employment and property income over GBP50,000.", "TableCell"), P("Move to digital records and quarterly update routine.", "TableCell")],
                [P("6 April 2027", "TableCell"), P("Qualifying income over GBP30,000.", "TableCell"), P("Prepare software and records before the start date.", "TableCell")],
                [P("6 April 2028", "TableCell"), P("Qualifying income over GBP20,000.", "TableCell"), P("Expect more small businesses and landlords to join.", "TableCell")],
            ],
            [31 * mm, 73 * mm, 61 * mm],
        ),
        PageBreak(),
        P("The quarterly cycle", "SectionTitle"),
        FlowChart(
            [
                ("Keep records up to date", "Sales, rent, purchases and expenses are captured digitally."),
                ("Send records to your accountant", "Bank, receipt and invoice information is provided before the internal deadline."),
                ("Practice reviews the figures", "The practice checks categories, missing items and unusual transactions."),
                ("Approve the quarterly update", "The client approves the summary before it is sent."),
                ("Finalise after year end", "The final tax return is completed with adjustments and other income."),
            ]
        ),
        PageBreak(),
        P("Quarterly deadlines", "SectionTitle"),
        info_table(
            [
                [P("HMRC deadline", "TableHead"), P("Standard period", "TableHead"), P("Calendar period", "TableHead"), P("Suggested client deadline", "TableHead")],
                [P("7 August", "TableCell"), P("6 April to 5 July", "TableCell"), P("1 April to 30 June", "TableCell"), P("25 July", "TableCell")],
                [P("7 November", "TableCell"), P("6 April to 5 October", "TableCell"), P("1 April to 30 September", "TableCell"), P("25 October", "TableCell")],
                [P("7 February", "TableCell"), P("6 April to 5 January", "TableCell"), P("1 April to 31 December", "TableCell"), P("25 January", "TableCell")],
                [P("7 May", "TableCell"), P("6 April to 5 April", "TableCell"), P("1 April to 31 March", "TableCell"), P("25 April", "TableCell")],
            ],
            [33 * mm, 44 * mm, 48 * mm, 40 * mm],
        ),
        Spacer(1, 7 * mm),
        callout("Your practice can change the suggested client deadline to match your own workflow. The HMRC filing deadlines should not be changed."),
        Spacer(1, 7 * mm),
        P("What clients should send", "SubTitle"),
        bullet_list(
            [
                "Bank statements, bank feeds, sales records and rent records.",
                "Purchase invoices, receipts, expense records and mileage details.",
                "Notes for private expenses, loans, asset purchases, cash transactions and unusual items.",
                "Payroll, pension and VAT information if relevant.",
            ]
        ),
        PageBreak(),
        P("Make this guide your own", "SectionTitle"),
        P("Enter your practice details below before sharing this document with clients. This page is designed so the client sees your practice as the originator of the guidance."),
        FirmDetailsForm("white_label_client"),
        Spacer(1, 8 * mm),
        P("Prepared with technical support from Sarmad Global. This wording may be retained or removed according to your practice preference.", "Small"),
        PageBreak(),
        P("HMRC sources used", "SectionTitle"),
        P("This guide is based on official HMRC and GOV.UK guidance available on 25 May 2026:", "Body"),
        sources_table(COMMON_SOURCES),
        Spacer(1, 7 * mm),
        P("This is a client education document. Practices should adapt it to their engagement terms, service model and client communication policy.", "Small"),
    ]
    return story


def practice_story():
    story = [
        CoverBlock(A4[0] - 52 * mm, A4[1] - 48 * mm, "PRACTICE GUIDE", "MTD for Income Tax\nImplementation", "A detailed implementation guide for accountants and practice teams", "Sarmad Global practice implementation edition"),
        PageBreak(),
        P("MTD for practices: what changes operationally", "SectionTitle"),
        P("Making Tax Digital for Income Tax changes Self Assessment from an annual production cycle into a recurring digital record, quarterly update and year-end finalisation workflow. For practices, the key risk is not only tax technical accuracy; it is capacity, data quality, client discipline and software control."),
        callout("This guide is for the accounting practice itself. Use it to plan implementation, decide your service model, brief staff, and convert HMRC guidance into a manageable operating process."),
        Spacer(1, 5 * mm),
        P("Client segmentation", "SubTitle"),
        info_table(
            [
                [P("Segment", "TableHead"), P("Practice action", "TableHead"), P("Operational risk", "TableHead")],
                [P("Over GBP50,000", "TableCell"), P("Confirm mandation for 6 April 2026, software route, authorisation and quarterly service level.", "TableCell"), P("High risk if records are annual, mixed between systems, or still spreadsheet-only without controlled bridging.", "TableCell")],
                [P("Over GBP30,000", "TableCell"), P("Build into 2027 migration plan and start client education early.", "TableCell"), P("Clients may delay because the start date feels distant.", "TableCell")],
                [P("Over GBP20,000", "TableCell"), P("Model 2028 capacity and pricing now, especially for smaller landlords and sole traders.", "TableCell"), P("Lower-fee clients can consume disproportionate bookkeeping and query time.", "TableCell")],
            ],
            [35 * mm, 67 * mm, 63 * mm],
        ),
        Spacer(1, 7 * mm),
        P("Segmentation data to capture", "SubTitle"),
        bullet_list(
            [
                "Qualifying income by self-employment and property source before expenses.",
                "Business type, number of income sources and whether UK or foreign property is involved.",
                "Current records: cloud ledger, desktop software, spreadsheet, paper, bank statements only, or mixed records.",
                "Current agent position: main agent, supporting agent, legacy authorisation only, or no authorisation.",
                "Client appetite: self-managed, practice-managed bookkeeping, hybrid, or likely exemption/support case.",
            ]
        ),
        PageBreak(),
        P("The practice workflow", "SubTitle"),
        FlowChart(
            [
                ("Identify affected clients", "Use qualifying self-employment and property turnover before expenses."),
                ("Confirm authorisation", "Check ASA, Self Assessment agent codes and client permission."),
                ("Select software route", "Use ledger software, bridging software or practice production software."),
                ("Quarterly review cycle", "Clean data, review categories, resolve queries and submit updates."),
                ("Finalise Self Assessment", "Make adjustments, add other income and submit the final tax return."),
            ]
        ),
        PageBreak(),
        P("Authorisation and sign-up controls", "SectionTitle"),
        P("HMRC guidance separates the agent services account from older online services for agents. Practices need to confirm authorisations before signing clients up and before relying on software access."),
        info_table(
            [
                [P("Control point", "TableHead"), P("What the practice should check", "TableHead")],
                [P("Agent Services Account", "TableCell"), P("The practice can access the MTD for Income Tax service and client details after authorisation.", "TableCell")],
                [P("Client authorisation", "TableCell"), P("Existing Self Assessment authorisations may need to be added to the agent services account using the relevant agent codes.", "TableCell")],
                [P("Client permission", "TableCell"), P("Get client approval before signing them up and before choosing or authorising software on their behalf.", "TableCell")],
                [P("Software authorisation", "TableCell"), P("Compatible software must be authorised to communicate with HMRC for MTD for Income Tax.", "TableCell")],
            ],
            [50 * mm, 115 * mm],
        ),
        Spacer(1, 6 * mm),
        P("Software routes practices can use", "SubTitle"),
        bullet_list(
            [
                "Cloud bookkeeping software where clients already maintain digital records.",
                "Practice-led bookkeeping software where the firm maintains the ledger for the client.",
                "Spreadsheet plus compatible bridging software where appropriate and controlled.",
                "Tax production or practice management tools that support MTD filing workflows.",
                "A mixed model, with clear rules on which clients are client-maintained and which are firm-maintained.",
            ]
        ),
        Spacer(1, 7 * mm),
        P("Software decision rules", "SubTitle"),
        info_table(
            [
                [P("Client profile", "TableHead"), P("Suggested route", "TableHead"), P("Control required", "TableHead")],
                [P("Digitally confident client", "TableCell"), P("Client-maintained cloud bookkeeping.", "TableCell"), P("Monthly review checklist, locked categories and evidence of quarterly approval.", "TableCell")],
                [P("Low-volume landlord", "TableCell"), P("Spreadsheet plus compatible bridging, or simple ledger.", "TableCell"), P("Standardised template, digital links where required, and clear source record storage.", "TableCell")],
                [P("Messy annual records", "TableCell"), P("Practice-managed bookkeeping or clean-up project before mandation.", "TableCell"), P("Upfront data repair, bank reconciliation and recurring record collection dates.", "TableCell")],
                [P("Multiple trades/properties", "TableCell"), P("Structured ledger with separate income sources.", "TableCell"), P("Source-by-source quarterly review and finalisation workflow.", "TableCell")],
            ],
            [43 * mm, 55 * mm, 67 * mm],
        ),
        PageBreak(),
        P("Quarterly update process for teams", "SectionTitle"),
        P("Quarterly updates are summaries sent through compatible software. HMRC guidance also explains that the updates are cumulative from the start of the tax year to the end of the update period. That means the firm needs a reliable recurring review process rather than a once-a-year correction exercise."),
        info_table(
            [
                [P("Stage", "TableHead"), P("Team action", "TableHead"), P("Client instruction", "TableHead")],
                [P("Month 1", "TableCell"), P("Bank feeds, receipts, invoices and coding hygiene.", "TableCell"), P("Upload records weekly or monthly.", "TableCell")],
                [P("Month 2", "TableCell"), P("Resolve missing items and unusual transactions.", "TableCell"), P("Answer queries quickly.", "TableCell")],
                [P("Month 3", "TableCell"), P("Review cumulative update and obtain approval.", "TableCell"), P("Approve before internal action date.", "TableCell")],
                [P("Deadline month", "TableCell"), P("Submit before 7 August, 7 November, 7 February or 7 May.", "TableCell"), P("Do not leave approvals to deadline week.", "TableCell")],
            ],
            [33 * mm, 72 * mm, 60 * mm],
        ),
        Spacer(1, 6 * mm),
        callout("A practice should treat MTD as a recurring compliance product: client list, software route, monthly data hygiene, quarterly review, approval evidence and submission record."),
        PageBreak(),
        P("Service model and pricing decisions", "SectionTitle"),
        P("MTD creates repeated touchpoints. Practices should avoid treating the work as a small add-on to the annual tax return. Decide in advance what is included, what is chargeable, and what happens when a client sends poor records late."),
        info_table(
            [
                [P("Service model", "TableHead"), P("Includes", "TableHead"), P("Best for", "TableHead")],
                [P("Client-maintained records", "TableCell"), P("Software setup, quarterly review, submission and year-end finalisation.", "TableCell"), P("Organised clients comfortable with software.", "TableCell")],
                [P("Practice-managed records", "TableCell"), P("Bookkeeping, reconciliation, quarterly update, evidence trail and final tax return data.", "TableCell"), P("Clients with weak record keeping or no internal finance support.", "TableCell")],
                [P("Hybrid model", "TableCell"), P("Client captures documents; practice codes, reconciles and files.", "TableCell"), P("Clients willing to upload records but not maintain a ledger.", "TableCell")],
                [P("Implementation project", "TableCell"), P("Software selection, migration, training, template setup and first-quarter supervision.", "TableCell"), P("Practices and clients moving from annual records to digital workflows.", "TableCell")],
            ],
            [40 * mm, 77 * mm, 48 * mm],
        ),
        Spacer(1, 7 * mm),
        P("Internal controls checklist", "SubTitle"),
        bullet_list(
            [
                "Record a named owner for each client segment and each quarterly deadline.",
                "Use internal action dates that are earlier than HMRC deadlines.",
                "Keep evidence of client approval before submission.",
                "Track software authorisation, agent role and sign-up status separately.",
                "Escalate late or incomplete records before the deadline week.",
                "Build a standard query process for uncategorised items, private expenses and missing bank transactions.",
            ]
        ),
        PageBreak(),
        P("How Sarmad Global supports practices", "SectionTitle"),
        P("Sarmad Global can assist practices that need operational support, software workflow design or temporary technical capacity while MTD is implemented."),
        info_table(
            [
                [P("Practice need", "TableHead"), P("Sarmad Global support", "TableHead")],
                [P("Messy client data", "TableCell"), P("Specialist bookkeeping team to clean records, reconcile feeds and prepare data for quarterly updates.", "TableCell")],
                [P("Software uncertainty", "TableCell"), P("Review of current software stack and practical route selection for ledger, bridging or practice systems.", "TableCell")],
                [P("Implementation capacity", "TableCell"), P("Support for client segmentation, workflows, templates, task lists and team process design.", "TableCell")],
                [P("Practice development", "TableCell"), P("Financial and accounting development team support for automation, reporting and practice operating model improvements.", "TableCell")],
            ],
            [55 * mm, 110 * mm],
        ),
        Spacer(1, 7 * mm),
        P("Practice checklist", "SubTitle"),
        bullet_list(
            [
                "Export a list of sole trader and landlord clients and segment by qualifying income.",
                "Check agent services account access and client authorisation position.",
                "Decide the software route for each affected client group.",
                "Issue client education material early and collect consent for sign-up.",
                "Set internal record collection dates before HMRC deadlines.",
                "Create a quarterly approval evidence process.",
                "Contact Sarmad Global where extra bookkeeping, MTD workflow or software implementation help is needed.",
            ]
        ),
        PageBreak(),
        callout("For help implementing MTD workflows, cleaning client data, choosing software routes or building practice automation, contact Sarmad Global: sarmad.accountant@yahoo.com | 020 8646 3666 | sarmadglobal.finaccord.pro", GREEN),
        PageBreak(),
        P("HMRC sources used", "SectionTitle"),
        P("This practice guide is based on official HMRC and GOV.UK guidance available on 25 May 2026:", "Body"),
        sources_table(AGENT_SOURCES),
        Spacer(1, 7 * mm),
        P("This document is a practice operations guide. It is not a substitute for firm-specific tax, regulatory, engagement-letter, AML or quality-management advice.", "Small"),
    ]
    return story


def build_pdf(path, title, author, story):
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=title,
        author=author,
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)


def copy_to_downloads(path):
    if os.path.isdir(DOWNLOADS):
        shutil.copy2(path, os.path.join(DOWNLOADS, os.path.basename(path)))


def build():
    os.makedirs(SITE_DOWNLOADS, exist_ok=True)
    build_pdf(CLIENT_PDF, "Sarmad Global MTD Public Client Guide", "Sarmad Global", public_client_story())
    build_pdf(WHITE_LABEL_PDF, "White Label MTD Client Guide for Practices", "Sarmad Global", white_label_client_story())
    build_pdf(PRACTICE_PDF, "Sarmad Global MTD Practice Implementation Guide", "Sarmad Global", practice_story())
    shutil.copy2(PRACTICE_PDF, LEGACY_PRACTICE_PDF)
    copy_to_downloads(CLIENT_PDF)
    copy_to_downloads(WHITE_LABEL_PDF)
    copy_to_downloads(PRACTICE_PDF)
    copy_to_downloads(LEGACY_PRACTICE_PDF)
    print(CLIENT_PDF)
    print(WHITE_LABEL_PDF)
    print(PRACTICE_PDF)


if __name__ == "__main__":
    build()
