# LevyTate Product Specification

## Product Purpose

LevyTate is a role-based apprenticeship and workforce development platform that helps employers:

- increase apprenticeship engagement
- guide employees into suitable development pathways
- manage approval workflows
- support workforce planning
- improve internal apprenticeship culture
- generate provider matching requests for the LevyTate team
- build future talent pipelines through school and pupil engagement

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
- Future talent and school engagement opportunities

## Strategic Modules

### Apprenticeship Operating System

Purpose:
Help employers increase apprenticeship adoption, manage approvals, map provider delivery and support workforce planning.

Primary users:

- Employee
- Line Manager
- Department Head
- Apprenticeship Lead

### Future Talent Portal

Purpose:
Allow employers to engage directly with pupils and schools to build future talent pipelines, improve career awareness and support progression into apprenticeships and employment.

Environment rule:
Future Talent Portal is a LevyTate strategic module. It must render inside a standalone LevyTate application shell and must not appear as a public MPR Consulting website page or inherit MPR Consulting marketing navigation.

Primary users:

- Employer
- School
- Pupil

Employer capabilities:

- Employer profile
- Employee case studies
- Career pathway maps
- Apprenticeship information
- Challenges and quizzes
- Skills activities
- Engagement analytics

School capabilities:

- School dashboard
- Pupil participation
- Activity completion
- Employer engagement tracking

Pupil capabilities:

- Explore employers
- View employee stories
- Complete challenges
- Earn badges
- Career pathway explorer
- Ask LevyTate AI
- Save favourite employers

Future Talent AI:
Pupils can explore careers, industries, apprenticeships and future progression routes. AI recommendations should use interests and strengths to suggest suitable employers, career routes, apprenticeships and next activities.

Commercial value:

- Builds early employer engagement
- Creates school partnership opportunities
- Supports future apprenticeship demand
- Generates strategic workforce pipeline conversations
- Extends LevyTate beyond current employees into pre-employment talent development

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
Production Supervisor through stronger manufacturing capability

Recommended Pathways:

- Level 3 Engineering Technician
- Level 4 Improvement Practitioner

Current Application:
Level 3 Engineering Technician

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

## LevyTate Copilot

Purpose:
Help users complete work inside LevyTate. Copilot is the operating system assistant for recommendations, applications, provider relationships, reporting and workflow support.

Primary behaviours:

- Explain recommendations, provider rationale, funding and workflows
- Guide users through existing LevyTate tasks
- Find employees, applications, programmes, provider relationships and reports
- Create draft notes, summaries, emails, application answers and decision rationale
- Coach platform decisions using grounded records and role permissions

Non-goal:
LevyTate Copilot should not behave like a general-purpose chatbot, search engine or generic career coach.

### Employee AI

Purpose:
Help the employee understand the current recommendation, track the current application and prepare the next application or manager conversation step.

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

## Specialist Pathway Funding Rule

Withdrawn standards must not be recommended as active funded pathways for new applications.

Historic records may remain, but new recommendations should be specialist and role-led. For management progression, LevyTate should identify the type of management involved and recommend a specialist pathway that builds management-level capability through the employee's actual role.
## MVP Data Boundary

The LevyTate MVP must start as a clean client workspace. It must not preload Portakabin, Wren or other employer demo employees, sites, departments, applications, role mappings or personas.

Employer demo records are isolated under demo-only data namespaces and may be used by standalone demo routes such as `/portakabin-apprenticeship-hub`.

MVP routes should import from `lib/levytate/data/mvp` and start with empty employer records for:

- employers
- sites
- departments
- employees
- roles
- applications
- provider matching requests

The MVP may preload LevyTate-owned assets such as the provider catalogue because these are platform assets, not employer records.

## Provider Catalogue

LevyTate maintains a seeded provider catalogue for LevyTate-led provider matching. Provider and programme records include verification status and should be editable by LevyTate admins.

Provider matching remains a LevyTate-led service. Employers submit needs and LevyTate prepares a controlled shortlist using programme fit, sector fit, delivery model, region, employer need and provider status. It must not be positioned as an open public provider marketplace.

Provider funding language must use `potentially levy-funded` or `potentially funded through levy/co-investment`. Withdrawn standards must not be active recommendations for new starts.


