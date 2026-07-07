from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\james\Downloads\Job Title Report.xlsx")
SHEET_NAME = "New Report"


PERSONA_SPECS = [
    ("GC-0001", "Olivia Kershaw", "Managing Director", "Department Head", "", "Billericay Support Office", ""),
    ("GC-0002", "Megan Rowe", "Talent & Development Director", "Apprenticeship Lead", "GC-0001", "Billericay Support Office", ""),
    ("GC-0003", "Ruth Ellison", "Regional Operations Director", "Department Head", "GC-0001", "Leeds Regional Hub", ""),
    ("GC-0004", "Simon Hartley", "Operations Director", "Department Head", "GC-0001", "Birmingham Regional Hub", ""),
    ("GC-0005", "Priya Sethi", "CIO", "Department Head", "GC-0001", "Billericay Support Office", ""),
    ("GC-0006", "Gareth Miles", "HSQE Director", "Department Head", "GC-0001", "Birmingham Regional Hub", ""),
    ("GC-0007", "Anika Shah", "Procurement Director", "Department Head", "GC-0001", "Billericay Support Office", ""),
    ("GC-0008", "Daniel Reeves", "Winter Maintenance Director", "Department Head", "GC-0001", "Manchester Regional Hub", ""),
    ("GC-0009", "Charlotte Briggs", "Business Development Director", "Department Head", "GC-0001", "Billericay Support Office", ""),
    ("GC-0010", "Nathan Cole", "Construction Director", "Department Head", "GC-0004", "Birmingham Regional Hub", ""),
    ("GC-0011", "Hannah Price", "Commercial Operations Director", "Department Head", "GC-0004", "Billericay Support Office", ""),
    ("GC-0012", "Mark Trelawney", "Utilities & Inland Waterways Director", "Department Head", "GC-0001", "Bristol Regional Hub", ""),
    ("GC-0013", "Eleanor Stone", "Finance Director", "Department Head", "GC-0001", "Billericay Support Office", ""),
    ("GC-0014", "Leah Morrison", "People Director", "Department Head", "GC-0001", "Billericay Support Office", ""),
    ("GC-0015", "James Whitaker", "Contract Manager", "Line Manager", "GC-0004", "Birmingham Regional Hub", "Awaiting Manager Review"),
    ("GC-0016", "Aisha Morgan", "Grounds Maintenance Supervisor", "Line Manager", "GC-0003", "Leeds Regional Hub", "Approved by Line Manager"),
    ("GC-0017", "Tom Llewellyn", "Grounds Maintenance Team Leader", "Line Manager", "GC-0016", "Leeds Regional Hub", ""),
    ("GC-0018", "Sofia Bennett", "Grounds Maintenance Operative", "Employee", "GC-0017", "Leeds Regional Hub", "Submitted to Line Manager"),
    ("GC-0019", "Ryan Patel", "Mobile Grounds Maintenance Operative", "Employee", "GC-0017", "Wales & West Field Region", ""),
    ("GC-0020", "Lucy Carver", "Landscape Supervisor", "Line Manager", "GC-0003", "South East Field Region", "Awaiting Final Approval"),
    ("GC-0021", "Ben Aldridge", "Arborist", "Employee", "GC-0024", "Rail North Depot", "Draft"),
    ("GC-0022", "Maya Fisher", "Arb Team Leader", "Line Manager", "GC-0024", "Rail South West Depot", "Approved for Enrolment"),
    ("GC-0023", "Ethan Walsh", "Arborist Apprentice", "Employee", "GC-0022", "Rail North Depot", ""),
    ("GC-0024", "Rebecca Lane", "Rail Site Manager", "Line Manager", "GC-0004", "Rail South West Depot", ""),
    ("GC-0025", "Callum Brooks", "Rail Site Supervisor", "Line Manager", "GC-0024", "Rail Central Depot", "Declined by Line Manager"),
    ("GC-0026", "Nadia Quinn", "Rail Planner", "Employee", "GC-0024", "Rail South East Depot", "Submitted to Apprenticeship Lead"),
    ("GC-0027", "Ibrahim Khan", "Senior Project Manager", "Line Manager", "GC-0012", "Bristol Regional Hub", ""),
    ("GC-0028", "Grace Nolan", "Assistant Planner / Site Manager", "Employee", "GC-0027", "Bristol Regional Hub", ""),
    ("GC-0029", "Harriet Blake", "Construction Manager", "Line Manager", "GC-0010", "Birmingham Regional Hub", ""),
    ("GC-0030", "Owen Hughes", "Site Supervisor", "Employee", "GC-0029", "Birmingham Regional Hub", "Awaiting Manager Review"),
    ("GC-0031", "Amelia Ross", "Quantity Surveyor", "Employee", "GC-0011", "Billericay Support Office", ""),
    ("GC-0032", "Joel Spencer", "Senior Commercial Manager", "Line Manager", "GC-0011", "Billericay Support Office", ""),
    ("GC-0033", "Clara Singh", "Business Analyst", "Employee", "GC-0005", "Billericay Support Office", "Submitted to Line Manager"),
    ("GC-0034", "Isaac Turner", "Data Analyst", "Employee", "GC-0005", "Billericay Support Office", "Awaiting Manager Review"),
    ("GC-0035", "Molly Grant", "Data Engineer", "Employee", "GC-0005", "Billericay Support Office", ""),
    ("GC-0036", "Leo Martin", "IT Support Manager", "Line Manager", "GC-0005", "Billericay Support Office", ""),
    ("GC-0037", "Zara Ahmed", "IT Support Technician", "Employee", "GC-0036", "Billericay Support Office", "Draft"),
    ("GC-0038", "Kieran Fox", "Infrastructure Engineer", "Employee", "GC-0036", "Billericay Support Office", ""),
    ("GC-0039", "Emily Webb", "Digital Product Owner", "Line Manager", "GC-0005", "Billericay Support Office", ""),
    ("GC-0040", "Tariq Hussain", "Application Support Analyst", "Employee", "GC-0039", "Billericay Support Office", ""),
    ("GC-0041", "Sophie Mason", "Senior Procurement Manager", "Line Manager", "GC-0007", "Billericay Support Office", "Awaiting Final Approval"),
    ("GC-0042", "Matthew Green", "Procurement Team Leader", "Line Manager", "GC-0041", "Billericay Support Office", ""),
    ("GC-0043", "Ella Crawford", "Procurement Coordinator", "Employee", "GC-0042", "Billericay Support Office", "Approved by Line Manager"),
    ("GC-0044", "Jake Wilson", "Assistant Buyer", "Employee", "GC-0042", "Billericay Support Office", ""),
    ("GC-0045", "Ruby Sinclair", "Finance Assistant", "Employee", "GC-0013", "Billericay Support Office", ""),
    ("GC-0046", "Noah Peters", "Management Accountant", "Employee", "GC-0013", "Billericay Support Office", ""),
    ("GC-0047", "Freya Dawson", "Fleet & Asset Manager", "Line Manager", "GC-0013", "Bristol Regional Hub", ""),
    ("GC-0048", "Liam O'Connor", "Fleet Coordinator", "Employee", "GC-0047", "Bristol Regional Hub", "Submitted to Apprenticeship Lead"),
    ("GC-0049", "Sienna Ward", "HSQE Manager", "Line Manager", "GC-0006", "Birmingham Regional Hub", ""),
    ("GC-0050", "Oscar Hill", "HSQE Coordinator", "Employee", "GC-0049", "Birmingham Regional Hub", "Approved for Enrolment"),
    ("GC-0051", "Mila Ramsey", "Health & Safety Advisor", "Employee", "GC-0049", "South East Field Region", "Awaiting Manager Review"),
    ("GC-0052", "Adam Bell", "Sustainability Program Manager", "Line Manager", "GC-0006", "Billericay Support Office", ""),
    ("GC-0053", "Phoebe Taylor", "Quality and IMS Lead", "Employee", "GC-0049", "Birmingham Regional Hub", ""),
    ("GC-0054", "Chloe Evans", "People Advisor", "Employee", "GC-0014", "Billericay Support Office", ""),
    ("GC-0055", "Aaron Shaw", "People Business Partner", "Line Manager", "GC-0014", "Billericay Support Office", "Submitted to Line Manager"),
    ("GC-0056", "Ivy Coleman", "Talent Acquisition Specialist", "Employee", "GC-0055", "Billericay Support Office", ""),
    ("GC-0057", "George Ellis", "Digital & Campaigns Manager", "Line Manager", "GC-0009", "Billericay Support Office", ""),
    ("GC-0058", "Evelyn Brooks", "Marketing Assistant", "Employee", "GC-0057", "Billericay Support Office", ""),
    ("GC-0059", "Finn Reynolds", "Bid Manager", "Line Manager", "GC-0009", "Billericay Support Office", ""),
    ("GC-0060", "Isla Chapman", "Bid Writer", "Employee", "GC-0059", "Billericay Support Office", "Awaiting Manager Review"),
    ("GC-0061", "Poppy Lawrence", "Customer Service Manager", "Line Manager", "GC-0008", "Manchester Regional Hub", ""),
    ("GC-0062", "Alfie Barrett", "Contact Centre Team Leader", "Line Manager", "GC-0061", "Manchester Regional Hub", ""),
    ("GC-0063", "Maisie Douglas", "Key Account Manager", "Line Manager", "GC-0003", "Leeds Regional Hub", ""),
    ("GC-0064", "Theo Palmer", "Account Manager", "Employee", "GC-0063", "Leeds Regional Hub", ""),
    ("GC-0065", "Erin Foster", "Client Services Administrator", "Employee", "GC-0063", "Leeds Regional Hub", ""),
    ("GC-0066", "Samuel Reed", "Commercial Operations Planner", "Employee", "GC-0008", "Manchester Regional Hub", "Approved by Line Manager"),
    ("GC-0067", "Lara Gibson", "Materials Planner", "Employee", "GC-0008", "Manchester Regional Hub", ""),
    ("GC-0068", "Harrison Cook", "Workshop Manager", "Line Manager", "GC-0008", "Manchester Regional Hub", ""),
    ("GC-0069", "Niamh Porter", "Workshop Supervisor", "Employee", "GC-0068", "Manchester Regional Hub", ""),
    ("GC-0070", "Jude Fleming", "Mobile Waste Operative", "Employee", "GC-0012", "Wales & West Field Region", ""),
    ("GC-0071", "Megan Park", "Commercial Coordinator", "Employee", "GC-0012", "Bristol Regional Hub", ""),
    ("GC-0072", "Oliver Finch", "GIS Specialist", "Employee", "GC-0004", "Billericay Support Office", ""),
    ("GC-0073", "Ava Knight", "CAD/GIS Technician", "Employee", "GC-0004", "Billericay Support Office", ""),
    ("GC-0074", "Henry Page", "Ecologist", "Employee", "GC-0004", "South East Field Region", ""),
    ("GC-0075", "Lily Barker", "Assistant Ecologist", "Employee", "GC-0074", "South East Field Region", ""),
    ("GC-0076", "Max Cooper", "Biodiversity Manager", "Line Manager", "GC-0004", "Billericay Support Office", ""),
]


def clean(value: object, field: str, fix_counts: Counter[str]) -> str:
    value = "" if value is None else str(value).strip()
    replacements = [
        ("ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·", " - ", "mojibake middle dot"),
        ("Ãƒâ€šÃ‚Â·", " - ", "mojibake middle dot"),
        ("Ã‚Â·", " - ", "mojibake middle dot"),
        ("Â·", " - ", "mojibake middle dot"),
        ("â€¢", " - ", "mojibake bullet"),
        ("\u2013", " - ", "en dash separator"),
        ("\\", " / ", "backslash separator"),
        ("Technicial", "Technician", "spelling correction"),
        ("Aquisition", "Acquisition", "spelling correction"),
    ]
    for before, after, label in replacements:
        if before in value:
            fix_counts[label] += value.count(before)
            value = value.replace(before, after)
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+-\s+", " - ", value).strip()
    value = re.sub(r"\s+/\s+", " / ", value).strip()
    return value


def slug(value: str) -> str:
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "unknown"


def to_ts_object_array(name: str, rows: list[dict], type_name: str) -> str:
    text = json.dumps(rows, indent=2, ensure_ascii=False)
    for key in sorted({key for row in rows for key in row.keys()}, key=len, reverse=True):
        text = text.replace(f'"{key}"', key)
    return f"export const {name} = {text} satisfies {type_name}[];\n"


def to_ts_const(name: str, value: dict) -> str:
    text = json.dumps(value, indent=2, ensure_ascii=False)
    for key in [
        "sourceFile",
        "sourceSheet",
        "sourceRows",
        "importedRows",
        "divisionsImported",
        "departmentsImported",
        "teamsImported",
        "uniqueJobTitlesImported",
        "demoPersonasGenerated",
        "exactDuplicateJobTitlesRemoved",
        "blankCounts",
        "blankSubdivisionRows",
        "blankTeamRows",
        "blankJobRoleRows",
        "blankJobTitleRows",
        "normalisationFixes",
        "duplicateOrRepeatedJobRoles",
        "frequentSubdivisions",
        "assumptions",
        "name",
        "count",
    ]:
        text = text.replace(f'"{key}"', key)
    return f"export const {name} = {text} as const;\n"


def load_rows() -> tuple[list[dict], dict]:
    wb = load_workbook(SOURCE, read_only=True, data_only=True)
    ws = wb[SHEET_NAME]
    headers = [str(cell).strip() for cell in next(ws.iter_rows(values_only=True))]
    fix_counts: Counter[str] = Counter()
    raw_rows: list[dict] = []
    for row_number, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
        raw_rows.append({headers[index]: row[index] for index in range(len(headers))} | {"_rowNumber": row_number})

    normalised: list[dict] = []
    seen_titles: set[str] = set()
    for record in raw_rows:
        row = {
            "rowNumber": record["_rowNumber"],
            "division": clean(record.get("Division"), "Division", fix_counts),
            "subdivision": clean(record.get("Subdivision"), "Subdivision", fix_counts),
            "team": clean(record.get("Team"), "Team", fix_counts),
            "jobRole": clean(record.get("Job role"), "Job role", fix_counts),
            "jobTitle": clean(record.get("Job title"), "Job title", fix_counts),
        }
        if not row["jobTitle"]:
            continue
        title_key = row["jobTitle"].lower()
        if title_key in seen_titles:
            continue
        seen_titles.add(title_key)
        normalised.append(row)

    slug_counts: Counter[str] = Counter()
    for row in normalised:
        base = f"gc-role-{slug(row['jobTitle'])}"
        slug_counts[base] += 1
        row["roleId"] = base if slug_counts[base] == 1 else f"{base}-{slug_counts[base]}"

    def raw_clean(field: str) -> list[str]:
        return [clean(row.get(field), field, Counter()) for row in raw_rows if clean(row.get(field), field, Counter())]

    job_titles_all = raw_clean("Job title")
    job_roles_all = raw_clean("Job role")
    summary = {
        "sourceFile": SOURCE.name,
        "sourceSheet": SHEET_NAME,
        "sourceRows": len(raw_rows),
        "importedRows": len(normalised),
        "divisionsImported": len({row["division"] for row in normalised if row["division"]}),
        "departmentsImported": len({row["subdivision"] for row in normalised if row["subdivision"]}),
        "teamsImported": len({row["team"] for row in normalised if row["team"]}),
        "uniqueJobTitlesImported": len(normalised),
        "demoPersonasGenerated": len(PERSONA_SPECS),
        "exactDuplicateJobTitlesRemoved": len(job_titles_all) - len(set(job_titles_all)),
        "blankCounts": {
            "blankSubdivisionRows": sum(1 for row in raw_rows if not clean(row.get("Subdivision"), "Subdivision", Counter())),
            "blankTeamRows": sum(1 for row in raw_rows if not clean(row.get("Team"), "Team", Counter())),
            "blankJobRoleRows": sum(1 for row in raw_rows if not clean(row.get("Job role"), "Job role", Counter())),
            "blankJobTitleRows": sum(1 for row in raw_rows if not clean(row.get("Job title"), "Job title", Counter())),
        },
        "normalisationFixes": dict(fix_counts),
        "duplicateOrRepeatedJobRoles": [
            {"name": name, "count": count}
            for name, count in Counter(job_roles_all).most_common()
            if count > 1
        ][:20],
        "frequentSubdivisions": [
            {"name": name, "count": count}
            for name, count in Counter(raw_clean("Subdivision")).most_common()
            if count > 1
        ][:20],
        "assumptions": [
            "Subdivision is treated as the department layer for the import report.",
            "The LevyTate MVP role model does not yet expose separate division, subdivision and team fields, so division is stored as role department and subdivision/team are stored in business area, skills tags and AI context.",
            "Demo employee names are fictional and generated only for the demonstration workspace.",
            "Manager relationships are inferred from seniority, division and team because the workbook contains job titles rather than people or reporting lines.",
            "Locations are inferred from division, regional team names and a small set of Ground Control-style regional hubs.",
            "Recommendations are generated from role evidence, future capability and Ground Control priorities using specialist standards, not generic management standards.",
        ],
    }
    return normalised, summary


def write_import_file(rows: list[dict], summary: dict) -> None:
    by_title = {row["jobTitle"].lower(): row for row in rows}
    for _, _, title, *_ in PERSONA_SPECS:
        if title.lower() not in by_title:
            raise SystemExit(f"Missing persona title in workbook: {title}")

    organisation_rows = [
        {
            "roleId": row["roleId"],
            "division": row["division"],
            "subdivision": row["subdivision"],
            "team": row["team"],
            "jobRole": row["jobRole"],
            "jobTitle": row["jobTitle"],
            "sourceRow": row["rowNumber"],
        }
        for row in rows
    ]
    personas = [
        {
            "employeeNumber": employee_number,
            "name": name,
            "jobTitle": title,
            "managerEmployeeNumber": manager,
            "site": site,
            "platformRole": platform_role,
            "applicationStatus": status,
        }
        for employee_number, name, title, platform_role, manager, site, status in PERSONA_SPECS
    ]

    content = """// Generated from C:/Users/james/Downloads/Job Title Report.xlsx. Do not add Ground Control logic to shared components.
export type GroundControlOrganisationRow = {
  roleId: string;
  division: string;
  subdivision: string;
  team: string;
  jobRole: string;
  jobTitle: string;
  sourceRow: number;
};

export type GroundControlPersonaImport = {
  employeeNumber: string;
  name: string;
  jobTitle: string;
  managerEmployeeNumber: string;
  site: string;
  platformRole: "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead";
  applicationStatus: string;
};

"""
    content += to_ts_object_array("groundControlOrganisationRows", organisation_rows, "GroundControlOrganisationRow")
    content += "\n"
    content += to_ts_object_array("groundControlPersonaImports", personas, "GroundControlPersonaImport")
    content += "\n"
    content += to_ts_const("groundControlImportSummary", summary)
    (ROOT / "lib/levytate/data/demo/ground-control-import.ts").write_text(content, encoding="utf-8")


def write_report(rows: list[dict], summary: dict) -> None:
    divisions = sorted({row["division"] for row in rows if row["division"]})
    role_lines = "\n".join(
        f"- {item['name']}: {item['count']} source rows" for item in summary["duplicateOrRepeatedJobRoles"][:12]
    )
    fixes = summary["normalisationFixes"]
    fix_lines = "\n".join(f"- {name}: {count}" for name, count in fixes.items()) if fixes else "- None detected in source workbook"
    assumptions = "\n".join(f"- {item}" for item in summary["assumptions"])
    report = f"""# Ground Control Import Report

## Source

- Workbook: `C:/Users/james/Downloads/Job Title Report.xlsx`
- Sheet: `New Report`
- Source rows reviewed: {summary['sourceRows']}
- Imported rows with a usable job title: {summary['importedRows']}

## Import Summary

- Divisions imported: {summary['divisionsImported']}
- Departments imported: {summary['departmentsImported']} subdivisions treated as department layer
- Teams imported: {summary['teamsImported']}
- Unique job titles imported: {summary['uniqueJobTitlesImported']}
- Demo personas generated: {summary['demoPersonasGenerated']}

## Imported Divisions

{chr(10).join(f"- {division}" for division in divisions)}

## Data Quality Findings

- Exact duplicate job titles found: {summary['exactDuplicateJobTitlesRemoved']}
- Blank job title rows skipped: {summary['blankCounts']['blankJobTitleRows']}
- Blank subdivision rows: {summary['blankCounts']['blankSubdivisionRows']}
- Blank team rows: {summary['blankCounts']['blankTeamRows']}
- Blank job role rows: {summary['blankCounts']['blankJobRoleRows']}

## Duplicate or Inconsistent Role Names Found

The workbook has no exact duplicate job titles. Several generic job roles repeat across many job titles, so the import keeps the unique job title as the role source of truth and stores the repeated job role as metadata.

{role_lines}

## Encoding and Normalisation Issues Fixed

{fix_lines}

The seeded workspace also sanitises common mojibake separators such as corrupted middle dots and broken bullet characters before rendering demo text.

## Hierarchy Preservation

The workbook hierarchy is preserved in the seeded role records as follows:

- Division -> role department
- Subdivision -> role business area and AI context
- Team -> role business area, tags and AI context
- Job role -> role metadata and AI context
- Job title -> role title and employee job title

## Persona Generation

The generated personas are fictional and are designed to make the workspace feel active across senior leadership, line management, operational teams, IT, finance, procurement, HSQE, people, business development, rail, utilities and field operations.

Application statuses are intentionally varied across the workflow:

- Draft
- Submitted to Line Manager
- Awaiting Manager Review
- Approved by Line Manager
- Submitted to Apprenticeship Lead
- Awaiting Final Approval
- Approved for Enrolment
- Declined by Line Manager

## Assumptions Made

{assumptions}

## Recommendation Approach

Recommendations are generated from the imported role title, job role, division, subdivision and team, then refined against Ground Control priorities:

- Operational productivity
- AI-enabled field operations
- Leadership capability through role-specific standards
- Commercial performance
- Digital transformation
- Sustainability
- Health & Safety
- Customer service excellence

The seed avoids recommending withdrawn generic management standards. Management capability is handled through specialist routes such as improvement, business analysis, project delivery, procurement, safety, land-based, digital and customer-focused pathways.
"""
    (ROOT / "docs/GROUND_CONTROL_IMPORT_REPORT.md").write_text(report, encoding="utf-8")


def main() -> None:
    rows, summary = load_rows()
    write_import_file(rows, summary)
    write_report(rows, summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
