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

- email address
- beta access code
- server-side validation through `/api/levytate-beta-login`
- HTTP-only beta session cookie

Default beta code:

- `LEVYTATE-BETA`

Future deployments can override the default with:

- `LEVYTATE_BETA_CODE`

If login fails, the user sees:

`Beta access is currently invite-only. Please check your access code or request access.`

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
