# Persistent Contextual Copilot

LevyTate Copilot is available beside permitted workspace pages while the existing standalone Copilot module remains available as a fallback. The persistent launcher is gated by `copilot:use`; Platform Admin remains excluded from employer operational context.

## Context contract

`LevyTateCopilotContext` records the canonical module, current route, human-readable context label, and an optional canonical learner, application, provider, employee or programme identifier. Module context is always available. Learner and application selection callbacks enrich that context when a record is open. Provider/programme entity context is used when an existing deep-link navigation target provides a canonical identifier; no identifier is invented.

The drawer passes the context label and module into the existing Copilot request payload. It does not create a second AI client, model, endpoint or permission path.

## Conversation behaviour

The existing `AskLevyTateAiWorkspace` remains mounted while the drawer is closed and while users move between modules. Its conversation state therefore persists. Context changes add a visible divider and affect only subsequent prompts and requests; previous answers are not relabelled.

## Presentation and accessibility

- Desktop: a restrained right-edge launcher opens a 420px overlay drawer while the underlying module remains visible.
- Mobile: the same drawer becomes a full-width sheet.
- Escape closes the drawer, focus moves to the close control on open, and focus returns to the launcher on close.
- The closed drawer is inert and hidden from accessibility navigation.
- Suggestions and the input placeholder are contextual rather than generic.

No proactive insight counts, write actions, database migration, new AI provider or Production configuration are included.
