# LevyTate MVP Structure

This folder is the first production-oriented boundary around the Portakabin LevyTate demo.

## Domain

`lib/levytate/domain` contains reusable product concepts and rules that should apply across employers:

- roles and navigation permissions
- application status rules
- active application checks
- provider mapping lookup helpers
- learner and request utility functions
- shared TypeScript types

These files should stay employer-neutral wherever possible.

## Employer Data

`lib/levytate/data/portakabin` contains Portakabin-specific demo data:

- employer and site records
- employee personas and learner records
- pathway catalogue and role-to-pathway mappings
- application seed data and demand scenarios
- provider mappings
- provider matching request seeds

This remains mock data for now, but it is isolated so the next MVP phase can replace it with API-backed data without rewriting the UI.

## UI

The Portakabin route still owns the screen composition and interaction state. Shared UI components should continue to move toward `components/levytate-demo` or a future `components/levytate-platform` package when reused by more than one employer environment.
