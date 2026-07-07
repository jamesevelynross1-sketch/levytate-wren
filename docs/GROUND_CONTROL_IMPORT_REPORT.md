# Ground Control Import Report

## Source

- Workbook: `C:/Users/james/Downloads/Job Title Report.xlsx`
- Sheet: `New Report`
- Source rows reviewed: 434
- Imported rows with a usable job title: 433

## Import Summary

- Divisions imported: 14
- Departments imported: 43 subdivisions treated as department layer
- Teams imported: 60
- Unique job titles imported: 433
- Demo personas generated: 76

## Imported Divisions

- Business Development
- Finance
- GCH
- HSQE
- IT
- JW Crowther
- Landscaping, Design and Energy
- Maintenance
- People
- Rail & Infrastructure
- Supply Chain
- Udder Rocks
- Utilities & Inland Waterways
- Winter Maintenance

## Data Quality Findings

- Exact duplicate job titles found: 0
- Blank job title rows skipped: 1
- Blank subdivision rows: 8
- Blank team rows: 28
- Blank job role rows: 140

## Duplicate or Inconsistent Role Names Found

The workbook has no exact duplicate job titles. Several generic job roles repeat across many job titles, so the import keeps the unique job title as the role source of truth and stores the repeated job role as metadata.

- Administrator: 12 source rows
- Consultant: 7 source rows
- Accounts Assistant: 6 source rows
- Litter Picker: 5 source rows
- Grounds Maintenance Operative: 5 source rows
- Key Account Manager: 4 source rows
- Grounds Maintenance Team Leader: 4 source rows
- Rail Site Manager: 4 source rows
- Business Development Director: 4 source rows
- Regional Operations Manager: 4 source rows
- Procurement Coordinator: 4 source rows
- Planning Manager: 4 source rows

## Encoding and Normalisation Issues Fixed

- en dash separator: 22
- backslash separator: 1
- spelling correction: 3

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

- Subdivision is treated as the department layer for the import report.
- The LevyTate MVP role model does not yet expose separate division, subdivision and team fields, so division is stored as role department and subdivision/team are stored in business area, skills tags and AI context.
- Demo employee names are fictional and generated only for the demonstration workspace.
- Manager relationships are inferred from seniority, division and team because the workbook contains job titles rather than people or reporting lines.
- Locations are inferred from division, regional team names and a small set of Ground Control-style regional hubs.
- Recommendations are generated from role evidence, future capability and Ground Control priorities using specialist standards, not generic management standards.

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
