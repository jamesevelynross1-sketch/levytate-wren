# LevyTate MVP Architecture

## Domain and Project Setup

The LevyTate MVP is designed to run as a standalone SaaS product on `https://www.levytate.co.uk/`.

Current Vercel state checked during implementation:

- Current local repository remote: `https://github.com/jamesevelynross1-sketch/levytate-wren.git`
- Current local Vercel link before deployment: `mpr-consulting-site`
- `levytate.co.uk` and `www.levytate.co.uk` are registered in the Vercel account
- Current aliases show `levytate.co.uk` and `www.levytate.co.uk` attached to the `levytate-website` Vercel project
- The MPR Consulting site remains a separate Vercel project and should not serve the LevyTate MVP

Because this repository still contains MPR Consulting routes, LevyTate is isolated behind host-based routing. The internal route group is `/levytate`, and middleware maps the public LevyTate domain to the clean product URLs.

## Public Site

Public LevyTate landing page:

- Browser URL on LevyTate domain: `/`
- Internal route: `/levytate`

Purpose:

- Explain what LevyTate is
- Position the MVP as beta software
- Drive users to request beta access or log in

The public page does not use the MPR Consulting header, footer, navigation or calls to action.

## Beta Login

Beta login URL on LevyTate domain:

- `/login`

Internal route:

- `/levytate/login`

Temporary beta access uses:

- the approved email allowlist in `lib/levytate/config/beta-access.ts`
- beta access code validation through `/api/levytate-beta-login`
- a signed, expiring HTTP-only session cookie
- the `beta_admin` access level

The current approved beta account is:

- `hello@levytate.co.uk`

Default beta code:

- `LEVYTATE-BETA`

Deployments can override the default code with:

- `LEVYTATE_BETA_CODE`

Production must configure the cookie signing secret:

- `LEVYTATE_BETA_SESSION_SECRET`

The app validates the signed session in middleware and again in the server-rendered app page. Invalid or expired cookies are cleared before redirecting to `/login`.

## Protected App

Protected app URL on LevyTate domain:

- `/app`

Internal route:

- `/levytate/app`

Access rules:

- unauthenticated `/app` requests redirect to `/login`
- authenticated `/login` requests redirect to `/app`
- logout clears the beta session through `/api/levytate-beta-logout`

## MVP Modules

The protected MVP app currently includes:

- Dashboard
- Employees
- Roles
- Applications
- Providers
- Provider Matching
- Enrolments
- Settings

The app shell includes:

- LevyTate-only branding
- left navigation
- top search
- employer workspace indicator
- user profile indicator
- logout

It does not include:

- MPR Consulting header
- MPR Consulting navigation
- MPR Consulting logo
- Portakabin branding
- Portakabin demo data

## Data Approach

The MVP starts with clean employer records.

Empty MVP data includes:

- employers
- sites
- departments
- employees
- roles
- applications
- provider matching requests

Seeded platform data includes:

- provider catalogue

The provider catalogue is a LevyTate-owned platform asset and may be preloaded because it is not employer mock data.

Seeded providers:

- QA
- Apprentify
- Learning Curve Group
- AiCore
- RHG Consult
- The Marketing Trainer
- HBTC
- Staffordshire University
- Learning Skills Partnership
- Baltic Apprenticeships
- SRSCC

## Demo Separation

The Portakabin demo remains separate:

- `/portakabin-apprenticeship-hub` is demo only
- `/app` is the real MVP beta product

Demo employer data should remain under demo or employer-specific namespaces and must not be imported into MVP app routes.

## Future Auth Plan

The current beta gate is intentionally lightweight. Production auth should later replace it with:

- managed authentication provider or custom auth service
- user records
- organisation membership
- role-based permissions
- audit logging
- invitation workflow
- passwordless or SSO support

## Future Database Plan

The current MVP uses local domain constants and clean empty arrays for employer records. A production database should add tables or collections for:

- employers
- employer users
- employees
- departments
- sites
- roles
- role pathway mappings
- applications
- providers
- provider programmes
- provider matching requests
- enrolments
- audit events

The current domain structure should make those records replaceable without rewriting the UI.

## Layout Isolation Rule

LevyTate must never inherit the MPR Consulting marketing layout.

Domain requests for `levytate.co.uk` and `www.levytate.co.uk` must bypass the MPR `SiteChrome` at the root layout level. The LevyTate public site, `/login` and `/app` must not render:

- MPR Consulting logo
- MPR Consulting public navigation
- Book a Conversation
- Home
- Framework
- Levy Health Check
- Provider Matching
- NEET On Our Watch
- Insights
- Contact

MPR Consulting routes should continue to use the MPR marketing shell on the MPR domain.
