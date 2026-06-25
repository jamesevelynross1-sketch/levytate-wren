# LevyTate MVP Structure

This folder contains the production-oriented LevyTate domain, data and platform boundaries.

## Domain

`lib/levytate/domain` contains reusable product concepts and rules that apply across employers:

- roles and navigation permissions
- application status rules
- active application checks
- provider catalogue filtering and shortlisting
- provider matching support logic
- learner and request utility functions
- shared TypeScript types

These files should stay employer-neutral.

## MVP Data

`lib/levytate/data/mvp` contains the clean MVP starting state.

The MVP must not preload employer mock data. It starts with empty arrays for:

- employers
- sites
- departments
- employees
- roles
- applications
- provider matching requests

The MVP may preload LevyTate-owned platform assets, including the provider catalogue.

## Provider Catalogue

`lib/levytate/data/mvp/provider-catalogue.ts` contains real provider records and starter programme records.

Each provider and programme includes:

- verification status
- source URL
- delivery model
- regions
- sectors
- funding status
- editable contact and notes fields

Programme data should be treated as either `verified` or `needs_verification`. Category-level entries should usually be marked `needs_verification` until a LevyTate admin confirms the exact public programme page.

Generic Level 3 Team Leader and Level 5 Operations Manager routes must not be active recommendations for new starts. If historic or provider-site references exist, they should be marked `defunded_for_new_starts` and unavailable for new recommendations.

## Demo Data

`lib/levytate/data/demo` marks employer demo data as demo-only.

The current Portakabin demo data remains available for the standalone `/portakabin-apprenticeship-hub` demo route, but MVP routes must import from `lib/levytate/data/mvp` instead of employer demo files.

## UI

Shared MVP UI belongs in `components/levytate-platform` or `components/levytate-demo` where appropriate.

Demo routes may compose these components with demo data. MVP routes should compose the same components with neutral MVP data and empty employer records.