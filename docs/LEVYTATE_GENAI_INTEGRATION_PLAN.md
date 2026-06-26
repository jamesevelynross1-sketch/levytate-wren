# LevyTate GenAI Integration Plan

Plan date: 18 June 2026  
Scope: Real GenAI chat support for Ask LevyTate AI inside the standalone LevyTate application environment, with the current Portakabin demo as the reference implementation.

## Objective

Add real GenAI chat support to Ask LevyTate AI without changing the core LevyTate workflows.

The implementation should:

- keep LevyTate role-based and grounded
- preserve the existing approval flow
- respect the one-active-application rule
- support provider matching as a LevyTate Team service, not a marketplace
- use OpenAI securely from the server only
- keep deterministic product actions and progressive reveal in the UI

This plan is for implementation design only. It does not change production code yet.

## 1. Recommended Architecture

### Overview

LevyTate should use a hybrid architecture:

- deterministic application state and business rules remain in the app
- GenAI is used for guided explanation, recommendation, summarisation, and drafting
- all product actions remain controlled by local rules and explicit user confirmation

This avoids turning the AI layer into the source of truth for workflow state.

### Frontend

Recommended frontend responsibilities:

- chat interface inside the existing Ask LevyTate AI workspace
- role-specific AI mode based on current selected role
- progressive reveal interaction model
- prompt chips for common starting questions
- deterministic action cards rendered from structured AI output
- local handling of CTA actions such as:
  - open pathway details
  - start application
  - open My Applications
  - open Reporting
  - prepare provider matching request

Recommended component structure:

- `AskLevyTateAIPage`
- `LevyTateChatPanel`
- `LevyTatePromptChips`
- `LevyTateResponseCard`
- `LevyTateActionRail`
- `LevyTateRecommendationCard`
- `LevyTateProviderMatchDraftCard`

Recommended frontend state:

- current role
- selected employee persona
- selected site
- current section
- conversation history
- loading state
- API error state
- structured AI response payload
- fallback mocked-response mode

### Backend

Recommended backend responsibilities:

- secure API route at `/api/levytate-ai`
- server-side OpenAI call only
- role-specific prompt construction
- local data grounding from current constants and app state
- response validation
- safety filtering and rule enforcement
- structured JSON response shaping
- error handling and fallback mode

No OpenAI API keys should ever be exposed client-side.

### Recommended Data Flow

1. User opens Ask LevyTate AI.
2. Frontend sends request to `/api/levytate-ai`.
3. API route assembles:
   - role context
   - employer context
   - selected site
   - selected employee persona where relevant
   - approved pathway data
   - provider mapping data
   - workflow rules
4. API route sends a server-side OpenAI request.
5. OpenAI returns structured JSON.
6. API route validates and normalises output.
7. Frontend renders:
   - assistant message
   - action buttons
   - recommendation cards
   - prefill suggestions
   - provider matching draft where allowed

## 2. AI Modes

Ask LevyTate AI must remain role-specific.

### Employee AI

Purpose:

- help the employee find approved pathways
- explain why a pathway is suitable
- suggest next steps
- support application pre-fill

Allowed behaviours:

- recommend approved pathways only
- explain suitability using current role, site, department and career goal
- draft application prefill suggestions
- direct user to start an application only if allowed
- block second active application attempts

Must not:

- approve anything
- show provider marketplace behaviour
- invent unavailable pathways

### Line Manager AI

Purpose:

- support team development
- help review applications
- guide manager decisions

Allowed behaviours:

- explain why a pathway could help a direct report or team
- summarise team development themes
- suggest approval considerations
- suggest questions the manager should ask before approving

Must not:

- make the final decision automatically
- expose data outside manager scope

### Department Head AI

Purpose:

- explain workforce analytics
- summarise participation, site and skills trends
- support planning conversations

Allowed behaviours:

- explain readiness, participation and site signals
- summarise likely skills gaps
- explain future demand patterns
- suggest where deeper reporting should be opened

Must not:

- offer approval actions
- expose individual decision controls

### Apprenticeship Lead AI

Purpose:

- support role-to-standard mapping
- support pathway rationale
- support funding interpretation
- create provider matching request drafts

Allowed behaviours:

- suggest recommended and alternative apprenticeship standards
- explain business rationale
- explain likely fit by role family
- suggest funding route wording
- draft a provider matching request for LevyTate Team review

Must not:

- act like a provider directory for employees
- claim guaranteed funding
- auto-submit provider requests without confirmation

## 3. Data Grounding

Phase 1 should ground the AI in local application data and constant data already in the repo.

The AI should be grounded in:

- approved Portakabin pathways
- provider mappings
- Portakabin employee personas
- current application workflow and status model
- site data
- apprenticeship standards data already modelled in demo constants
- LevyTate product rules from the spec

### Recommended Grounding Strategy

For Phase 1, build a server-side context assembly layer that converts app data into a concise structured prompt context.

Suggested context domains:

- `productRules`
- `rolePermissions`
- `workflowRules`
- `employeePersona`
- `siteSummary`
- `approvedPathways`
- `providerMappings`
- `applicationState`
- `employerContext`

### Important Grounding Principle

The model should answer only from supplied grounded data plus tightly controlled system instructions.

If something is not in the grounded data:

- the model should say it is not currently available in this environment
- the model should not guess

## 4. Safety Rules

The AI must:

- not invent unavailable pathways
- clearly mark anything not currently available
- not say "fully funded"
- use:
  - `potentially levy-funded`
  - `potentially funded through levy/co-investment`
- not expose provider matching as an open marketplace
- route provider matching requests to LevyTate Team
- respect role permissions
- respect the one-active-application rule
- not submit applications or provider requests silently
- not make approval decisions automatically

### Recommended Safety Enforcement Layers

1. System prompt rules
2. Server-side role filtering
3. Server-side business-rule checks
4. Structured output validation
5. Frontend rendering constraints

### Suggested Fallback Language

If the AI is unsure:

- "That option is not currently available in this LevyTate environment."
- "I cannot see an approved pathway for that route in the current employer configuration."
- "I can help draft a provider matching request for LevyTate Team, but I cannot expose an open provider marketplace."

## 5. Suggested API Design

Recommended route:

- `/api/levytate-ai`

### Request Body

```json
{
  "role": "Employee",
  "selectedEmployee": "Amelia Hart",
  "selectedSite": "York Head Office, Visitor Centre and UK Factory",
  "currentSection": "Ask LevyTate AI",
  "userMessage": "I want to become a production supervisor",
  "conversationHistory": [
    {
      "role": "user",
      "content": "I want to become a production supervisor"
    }
  ],
  "employerContext": "Portakabin"
}
```

### Response Body

```json
{
  "assistantMessage": "Based on your current role and goal, the strongest approved pathway is Level 3 Engineering Technician.",
  "recommendedActions": [
    {
      "label": "View pathway",
      "type": "open_pathway",
      "target": "Level 3 Engineering Technician"
    }
  ],
  "recommendedPathways": [
    {
      "title": "Level 3 Engineering Technician",
      "reason": "Matches current production role and manufacturing progression goal.",
      "availability": "approved"
    }
  ],
  "applicationPrefill": {
    "selectedApprenticeship": "Level 3 Engineering Technician",
    "reasonForInterest": "Supports progression through technical manufacturing evidence and production capability.",
    "careerGoal": "Production Supervisor through stronger manufacturing capability"
  },
  "providerMatchDraft": null,
  "nextStep": "start_application",
  "safetyNotes": [
    "Employee has one active application at a time rule."
  ]
}
```

### Suggested Type Definitions

```ts
type LevyTateAiRequest = {
  role: "Employee" | "Line Manager" | "Department Head" | "Apprenticeship Lead";
  selectedEmployee?: string;
  selectedSite: string;
  currentSection: string;
  userMessage: string;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  employerContext: string;
};

type LevyTateAiResponse = {
  assistantMessage: string;
  recommendedActions: Array<{
    label: string;
    type: string;
    target?: string;
  }>;
  recommendedPathways: Array<{
    title: string;
    reason: string;
    availability: "approved" | "not_available" | "alternative";
  }>;
  applicationPrefill: null | {
    selectedApprenticeship?: string;
    reasonForInterest?: string;
    careerGoal?: string;
    supportRequired?: string;
  };
  providerMatchDraft: null | {
    roleFamily: string;
    recommendedStandard: string;
    rationale: string;
    fundingRoute: string;
    notes: string;
  };
  nextStep: string | null;
  safetyNotes: string[];
};
```

## 6. OpenAI Implementation

### Recommended API

Use the OpenAI Responses API.

Recommended implementation principles:

- server-side call only
- structured JSON output
- role-specific system prompts
- local grounding from constants in Phase 1
- deterministic UI rendering from structured fields

### Why Responses API

Responses API is a strong fit because it supports:

- modern structured generation
- system prompt control
- predictable JSON-shaped output
- easier future extension into tools, retrieval and orchestration

### Recommended Call Pattern

Server-side route should:

1. build role-specific system instructions
2. build grounded context payload
3. pass user message plus recent conversation
4. request strict structured output
5. validate output before returning to UI

### Recommended Model Configuration

Environment-driven model selection:

- `process.env.LEVYTATE_AI_MODEL`

Initial recommendation:

- use a capable general reasoning model for Phase 1
- keep model swappable by environment variable

### Future Direction

Later phases can replace large prompt grounding with:

- RAG over apprenticeship standards
- RAG over provider capability records
- employer-specific indexed pathway data

## 7. Progressive Implementation Phases

### Phase 1

Goal:

- keep mocked AI as fallback
- add real API route
- use OpenAI for natural-language answers
- keep actions deterministic

Scope:

- `/api/levytate-ai`
- role-specific prompts
- local grounded data
- structured assistant message plus recommended actions
- frontend fallback to mocked behaviour if API disabled or fails

### Phase 2

Goal:

- structured recommendations from AI

Scope:

- recommended pathways
- rationale
- next-step suggestions
- application prefill suggestions

### Phase 3

Goal:

- provider matching draft generation

Scope:

- Apprenticeship Lead AI drafts provider matching requests
- user reviews before submit
- request still routed to LevyTate Team

### Phase 4

Goal:

- deeper grounding with retrieval

Scope:

- RAG over apprenticeship standards
- RAG over provider capability data
- RAG over employer-specific pathway configurations

### Phase 5

Goal:

- enterprise controls

Scope:

- audit logs
- admin review
- usage monitoring
- failure analytics
- prompt/version governance

## 8. UX Behaviour

Ask LevyTate AI should not show everything by default.

### Initial State

Show:

- input only
- prompt chips

Examples:

- "I want to become a production supervisor"
- "What apprenticeship is right for me?"
- "Help me apply"
- "What progression options do I have?"

### After User Message

Show:

- AI response only

### If Recommendation Exists

Show:

- recommendation card

### If Application Is Relevant

Show:

- `Start Application` CTA

Only if:

- employee has no active application
- recommended pathway is approved

### If Provider Matching Is Relevant

Show:

- `Request Provider Matching` CTA

Only for:

- Apprenticeship Lead

### UX Principle

AI should feel like a guided conversation that reveals the next right action, not a feature wall.

## 9. Environment Variables

Required environment variables:

```env
OPENAI_API_KEY=
LEVYTATE_AI_MODEL=
LEVYTATE_AI_ENABLED=
```

### Recommended Defaults

- `LEVYTATE_AI_ENABLED=false` in environments without configuration
- `LEVYTATE_AI_MODEL` explicitly set rather than hard-coded

### Suggested Behaviour

- if `LEVYTATE_AI_ENABLED` is false, frontend uses existing mocked AI behaviour
- if `OPENAI_API_KEY` is missing, API route returns controlled fallback

## 10. Risks And Mitigations

### Hallucination

Risk:

- AI invents pathways, funding statements or provider options

Mitigation:

- strong system prompts
- grounded local context only
- structured output validation
- fallback wording when data is missing

### Wrong Pathway Recommendations

Risk:

- pathway recommendations do not align with approved employer routes

Mitigation:

- only recommend from approved pathway list
- label alternatives clearly
- keep pathway actions deterministic

### Data Privacy

Risk:

- too much persona or learner data exposed to the model

Mitigation:

- send role-appropriate minimum context only
- no unnecessary personal data
- keep conversation payload compact

### Permissions

Risk:

- employee sees manager or provider-only actions

Mitigation:

- role-based server filtering
- role-based frontend rendering
- response validation against permissions

### Cost Control

Risk:

- AI usage becomes expensive through long chats or repeated prompts

Mitigation:

- rate limiting
- max token caps
- short context windows
- caching
- mocked fallback on failure

### Prompt Injection

Risk:

- user attempts to override role rules or ask for hidden data

Mitigation:

- server-side role rules included in system prompt
- do not pass raw hidden data
- validate output structure and allowed actions
- discard disallowed recommendations

### Auditability

Risk:

- no record of what AI said or suggested

Mitigation:

- add request/response logging in later phase
- store prompt version and role mode
- capture structured action outputs

## 11. Cost Control

Recommended controls:

- rate limiting per user session or IP
- max tokens on responses
- short context windows
- role-specific context only
- caching common prompt-chip requests
- fallback to mocked responses if API fails

### Suggested Phase 1 Controls

- keep last 6 to 8 conversation turns only
- do not send large tables or full datasets
- summarise local data into compact context
- use deterministic app actions rather than asking AI to generate workflow state

### Suggested Fallback Strategy

If API call fails:

1. log server error
2. return controlled fallback payload
3. show existing mocked response patterns
4. do not break the Ask LevyTate AI UI

## 12. Recommended Implementation Shape

### Suggested Files

- `app/api/levytate-ai/route.ts`
- `lib/levytate-ai/context.ts`
- `lib/levytate-ai/prompts.ts`
- `lib/levytate-ai/response-schema.ts`
- `lib/levytate-ai/safety.ts`
- `lib/levytate-ai/fallback.ts`

### Suggested Responsibilities

`route.ts`

- parse request
- check env flags
- call context builder
- call OpenAI
- validate output
- return response

`context.ts`

- assemble grounded role-specific context

`prompts.ts`

- define shared system prompt
- define role-specific prompt additions

`response-schema.ts`

- define response types and validation schema

`safety.ts`

- post-process and enforce allowed actions

`fallback.ts`

- return mocked/fallback structured responses

## 13. Phase 1 Implementation Prompt

Use the following prompt when ready to build Phase 1:

```text
Read:

- AGENTS.md
- docs/LEVYTATE_PRODUCT_SPEC.md
- docs/LEVYTATE_PRODUCT_BACKLOG.md
- docs/LEVYTATE_PRODUCT_POSITIONING.md
- docs/LEVYTATE_GENAI_INTEGRATION_PLAN.md

TASK:
Implement Phase 1 of real GenAI support for Ask LevyTate AI in the Portakabin LevyTate demo.

Requirements:

1. Do not add new pages.
2. Do not change the core application workflow.
3. Keep mocked AI as fallback if API is disabled or fails.
4. Add a secure server-side API route:
   /api/levytate-ai
5. Use server-side OpenAI Responses API only.
6. Do not expose API keys client-side.
7. Support role-specific AI modes for:
   - Employee
   - Line Manager
   - Department Head
   - Apprenticeship Lead
8. Ground responses using local Portakabin demo data and LevyTate product rules.
9. Return structured JSON:
   - assistantMessage
   - recommendedActions
   - recommendedPathways
   - applicationPrefill
   - providerMatchDraft
   - nextStep
   - safetyNotes
10. Keep UI progressive:
   - input first
   - response after submit
   - action cards only when relevant
11. Enforce safety rules:
   - no invented pathways
   - no "fully funded"
   - use "potentially levy-funded" or "potentially funded through levy/co-investment"
   - no provider marketplace behaviour
   - provider matching routed to LevyTate Team
   - respect one-active-application rule
   - respect role permissions
12. Suggested new modules:
   - app/api/levytate-ai/route.ts
   - lib/levytate-ai/context.ts
   - lib/levytate-ai/prompts.ts
   - lib/levytate-ai/response-schema.ts
   - lib/levytate-ai/safety.ts
   - lib/levytate-ai/fallback.ts
13. Add environment variable usage:
   - OPENAI_API_KEY
   - LEVYTATE_AI_MODEL
   - LEVYTATE_AI_ENABLED
14. Preserve the premium SaaS design and current Portakabin environment.

Before finishing:

- run npm run lint
- run npm run build
- commit changes
- push changes
- deploy
- verify Ready status
- provide deployment URL
- summarise files changed
```

## Final Recommendation

LevyTate should implement real GenAI in controlled layers, not as a free-form chatbot bolted onto the UI.

The best Phase 1 approach is:

- server-side OpenAI
- structured JSON output
- grounded local context
- deterministic UI actions
- mocked fallback
- strong role and workflow enforcement

That gives LevyTate a credible real AI layer while protecting the product story, the workflow model, and the commercial value of Provider Matching.


