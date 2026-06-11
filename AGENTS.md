# LevyTate Codex Instructions

## Read First

Before making changes:

1. Read `/docs/LEVYTATE_PRODUCT_SPEC.md`.
2. Read `/docs/LEVYTATE_PRODUCT_BACKLOG.md`.
3. Check the requested change against existing:
   - user roles
   - workflow rules
   - demo personas
   - AI assistant behaviour
   - dashboard metrics
   - application logic
   - design system

Do not implement partial changes that only update one screen while leaving other related screens inconsistent.

## Required Project Documents

Before implementing changes, read:

- `/docs/LEVYTATE_PRODUCT_SPEC.md`
- `/docs/LEVYTATE_PRODUCT_BACKLOG.md`

Ensure new features align with:

- Product strategy
- Commercial objectives
- Existing workflows
- Existing personas

Do not implement features that conflict with the product specification.

## Core Product Rules

LevyTate is a role-based apprenticeship and workforce development platform.

Approval flow:

Employee -> Line Manager -> Apprenticeship Lead -> Enrolment

Department Head does not approve applications.

Employees may only have one active apprenticeship application at a time.

If an employee has an active application, they may still:

- Ask LevyTate AI questions
- Save pathways
- Compare pathways
- View recommendations

They may not:

- Start a second application
- Submit a second application
- Create multiple draft applications

## Role Rules

Employee:
Find pathways, use Ask LevyTate AI, save pathways, apply, track application.

Line Manager:
Review direct-report applications, approve or decline, view team development, use reports.

Department Head:
View workforce analytics, site participation, skills gaps and reports. No approvals.

Apprenticeship Lead:
Final approval, programme and provider oversight, Ask LevyTate AI role mapping, provider matching and reports.

## AI Assistant Rules

Ask LevyTate AI is role-specific.

Employee:
Guided pathway support and application assistance.

Line Manager:
Team development and application review support.

Department Head:
Workforce capability and reporting insight.

Apprenticeship Lead:
Role-to-standard mapping and provider matching requests submitted to LevyTate.

The AI interface should use progressive reveal:

- Input first
- Recommendation only after interaction
- Application form only after Start Application
- Confirmation only after submission

## Design Rules

Maintain a premium enterprise SaaS feel.

Prioritise:

- clean spacing
- consistent typography
- consistent cards
- concise copy
- strong visual hierarchy
- boardroom-ready reports

Do not add oversized hero sections or unnecessary empty space.

## Development Rules

Before finishing any task:

- Run `npm run lint`
- Run `npm run build`
- Check relevant UI states
- Check role-specific behaviour
- Check demo data consistency

## Deployment Requirement

Every task must:

1. Commit changes
2. Push changes
3. Deploy successfully
4. Verify deployment reaches Ready status
5. Provide deployment URL
6. Provide files changed
7. Provide a concise summary of changes

Work is not complete until a working deployment URL is provided.
