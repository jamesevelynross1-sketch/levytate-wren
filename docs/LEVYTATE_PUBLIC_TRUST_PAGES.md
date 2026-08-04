# LevyTate public trust pages

## Purpose

This document records the public trust and support surface for Core Early Access. Public copy is held in `lib/levytate/public-trust-content.ts` and rendered through one shared component. Internal review status is held separately in a server-only module and is returned only to an authorised Platform Admin.

## Routes and public links

| Public route | Purpose | Login link | Authenticated link |
| --- | --- | --- | --- |
| `/levytate/privacy` | Privacy notice | Yes | Yes |
| `/levytate/early-access-terms` | Early Access operating terms | Yes | Yes |
| `/levytate/data-processing` | Data-processing overview | No | No |
| `/levytate/support` | Service and security support | Yes | Yes |
| `/levytate/account-help` | Enumeration-safe account guidance | Yes | No |
| `/levytate/data-rights` | Privacy request guidance | No | Yes |

On `www.levytate.co.uk`, short paths such as `/privacy` are rewritten to the corresponding LevyTate route. Canonical metadata uses the short `https://www.levytate.co.uk/...` URL. The `/levytate/...` routes remain directly available in protected Previews.

The pages use LevyTate public chrome and must never display application navigation, protected employer information, Platform Admin review state, repository terminology or drafting notes.

## Authentication email link contract

The externally managed Supabase magic-link template must contain restrained links to:

- `https://www.levytate.co.uk/privacy`
- `https://www.levytate.co.uk/early-access-terms`
- `https://www.levytate.co.uk/account-help`
- `https://www.levytate.co.uk/support`

The template must keep its existing secure callback variables and must not expose a token in visible copy or analytics. This sprint does not modify the external template and sends no authentication email. Template changes require a separate controlled delivery test.

## Publication process

1. Product owner prepares factual copy and records unresolved matters in the approval checklist, never in public copy.
2. Privacy/legal owner approves required wording and status.
3. A code review confirms public and server-only metadata remain separated.
4. Automated validation checks routes, canonical metadata and prohibited claims.
5. A protected Preview is reviewed on desktop and mobile before publication.
6. Version, effective date and last-reviewed date are updated together.
7. Publication to the production alias requires an explicit production approval outside this sprint.

## Search and access treatment

Public trust pages are indexable and carry explicit canonical URLs. The protected application carries `noindex, nofollow`. Public pages have one `h1`, ordered section headings, keyboard-visible links, minimum touch targets where controls are used, and no horizontal overflow at 390 pixels.

## Acceptance-model finding

The current schema has controlled access, membership and prospect-access records but no versioned legal-document acceptance record. No migration is introduced in Sprint 1B. Before the first real employer account is issued, implement an acceptance record containing at least: user, organisation, document type, document version, accepted timestamp, acceptance method, and immutable evidence reference. Do not overload authentication or prospect-access audit events for this purpose.
