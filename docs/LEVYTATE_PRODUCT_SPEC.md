# LevyTate Product Specification

## Product Purpose

LevyTate is a role-based apprenticeship and workforce development platform that helps employers:

- increase apprenticeship engagement
- guide employees into suitable development pathways
- manage approval workflows
- support workforce planning
- improve internal apprenticeship culture
- generate provider matching requests for the LevyTate team

## Commercial Objectives

LevyTate generates revenue through:

1. Provider matching opportunities
2. Provider subscriptions
3. Consultancy projects
4. Workforce planning support
5. Strategic apprenticeship advisory

The platform should support:

- Lead generation
- Consultancy opportunities
- Provider matching opportunities
- Workforce planning conversations
- Employer engagement

AI workflows should identify opportunities to create:

- Provider matching requests
- Workforce planning discussions
- Strategic advisory opportunities

## Core User Roles

### Employee

Can:

- Use Ask LevyTate AI
- View recommended pathways
- Save pathways
- Compare pathways
- Start one application
- Track application
- View skills analysis
- View development passport

Cannot:

- Approve applications
- Access reports
- See other employees
- Access provider matching

### Line Manager

Can:

- View direct reports
- Review applications from direct reports
- Approve or decline applications
- View team skills
- View team development
- Access line manager reports
- Use Ask LevyTate AI for team development support

### Department Head

Can:

- View department participation
- View learners by site
- View skills gaps
- View future skills demand
- Access department reports
- Use Ask LevyTate AI for workforce insight

Cannot:

- Approve or decline applications

### Apprenticeship Lead

Can:

- View organisation-wide apprenticeship activity
- Final approve applications
- Manage programmes
- Manage providers
- Use Ask LevyTate AI for role-to-standard mapping
- Submit provider matching requests to LevyTate
- Access executive reports

## Approval Workflow

Employee submits application -> Line Manager reviews -> Line Manager approves or declines -> Apprenticeship Lead gives final approval -> Approved for enrolment

Department Head is not part of the approval workflow.

## Application Rule

Employees may only have one active apprenticeship application at a time.

Active statuses:

- Draft
- Submitted to Line Manager
- Awaiting Manager Review
- Approved by Line Manager
- Submitted to Apprenticeship Lead
- Awaiting Final Approval
- Approved for Enrolment

Closed statuses:

- Declined by Line Manager
- Declined by Apprenticeship Lead
- Withdrawn
- Cancelled
- Completed

## Demo Personas

### Amelia Hart

Role:
Production Team Member

Department:
Manufacturing

Site:
York Head Office, Visitor Centre and UK Factory

Line Manager:
Ryan Booth

Career Goal:
Production Supervisor / Team Leader

Recommended Pathways:

- Level 3 Team Leader
- Level 3 Engineering Technician

Current Application:
Level 3 Team Leader

Status:
Awaiting Manager Review

Dashboard should show:

- Recommended Pathways: 2
- Current Application: 1
- Saved Opportunities: 1
- Development Passport: 7

### Daniel Carter

Role:
Data & Reporting Analyst

Department:
Business Intelligence

Site:
York Head Office, Visitor Centre and UK Factory

Line Manager:
Sarah Mitchell

Career Goal:
Head of Data & Automation

Recommended Pathways:

- Level 3 Data Technician
- Level 4 Data Analyst
- Level 4 Business Analyst
- AI & Automation Workforce Programme
- Level 6 Data Scientist

Current Application:
Level 4 Data Analyst

Status:
Awaiting Manager Review

Dashboard should show:

- Recommended Pathways: 5
- Current Application: 1
- Saved Opportunities: 3
- Development Passport: 4

Daniel must not show "2 applications in progress".

## Ask LevyTate AI

### Employee AI

Purpose:
Help the employee find the most relevant approved pathway and complete the application journey.

Rules:

- Do not show recommendations by default
- Start with a single AI input
- Reveal recommendations only after interaction
- Reveal application form only after Start Application
- Pre-fill application details
- Block second applications if active application exists

### Line Manager AI

Purpose:
Support team development and application review.

### Department Head AI

Purpose:
Support workforce capability, participation and reporting insight.

No approval actions.

### Apprenticeship Lead AI

Purpose:
Map roles to apprenticeship standards and create provider matching requests.

Response should include:

- Recommended standards
- Alternative standards
- Business rationale
- Potential funding route
- Provider matching option

Provider matching requests are submitted to the LevyTate team, not directly to providers.

## Provider Matching

Provider matching is a commercial LevyTate workflow.

The Apprenticeship Lead can submit a provider matching request.

The request should include:

- employer
- role/workforce need
- recommended programme
- number of learners
- preferred sites
- delivery preference
- funding position
- urgency
- notes

The status should progress through:

- Submitted
- Under Review
- Provider Shortlist Being Prepared
- Shortlist Ready

## Navigation

Employee:

- Ask LevyTate AI
- Dashboard
- Recommended Pathways
- Career Pathfinder
- Skills Analysis
- My Applications
- Development Passport

Line Manager:

- Ask LevyTate AI
- Dashboard
- My Team
- Applications
- Team Development
- Reports

Department Head:

- Ask LevyTate AI
- Dashboard
- Department Analytics
- Site Breakdown
- Future Demand
- Reports

Apprenticeship Lead:

- Ask LevyTate AI
- Dashboard
- Approvals
- Approved for Enrolment
- Providers
- Programmes
- Reports

## Design Principles

LevyTate should feel:

- premium
- executive
- simple
- guided
- enterprise-grade
- easy to navigate

Avoid:

- duplicated branding
- oversized headers
- unnecessary whitespace
- inconsistent cards
- long text
- generic demo data
- conflicting dashboard metrics

## Reporting

Employees do not need reports.

Line Manager reports:

- Team development trend
- Team skills profile
- Apprenticeship participation
- Team progress report

Department Head reports:

- Apprenticeship participation by site
- Workforce readiness index
- Department skills gap analysis
- Learner distribution
- Department workforce report

Apprenticeship Lead reports:

- Levy utilisation
- Active learners by site
- Provider performance
- Starts vs completions
- Programme portfolio
- Workforce readiness report
