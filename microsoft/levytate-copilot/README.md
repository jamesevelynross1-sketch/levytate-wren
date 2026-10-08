# LevyTate Microsoft 365 Copilot package

This folder contains the internal-pilot Microsoft 365 app package for the existing LevyTate remote MCP connector. It adds a branded application identity around the proven connector; it does not add or duplicate connector business logic.

## Package boundary

- App manifest schema: Microsoft 365 app manifest `1.30`
- Remote MCP endpoint: `https://levytate-mcp-staging.vercel.app/api/mcp/levytate`
- Authentication: the existing Microsoft Entra SSO registration, referenced through `OAuthPluginVault`
- Tool discovery: dynamic from the existing MCP server
- Package identity: `259dd8b4-5958-4c2c-8f77-38a93ef7634d` (Microsoft 365 package ID, not a second Entra application)
- Pilot scope: the existing MPR Consulting Microsoft tenant only
- Production publication: prohibited for this pilot artifact

Microsoft's current manifest schema limits the developer-name field to 32 characters. The package therefore uses the schema-compliant `Control My Costs Ltd (LevyTate)` while retaining the full legal presentation, **Control My Costs Ltd trading as LevyTate**, in this package documentation.

The remote MCP server remains the authority for authentication, tenancy, JIT identity resolution, RBAC and tool execution. All ten existing tools remain read-only, non-destructive and idempotent.

## Brand assets

- `assets/color.png`: 192 x 192 PNG with a deep-navy background and a centred mint/coral `LT` mark inside Microsoft's 120 x 120 safe zone.
- `assets/outline.png`: 32 x 32 transparent PNG with the same simplified mark in white.
- `preview/brand-contact-sheet.png`: local QA sheet showing the colour and outline marks at their required small sizes beside the existing LevyTate wordmark. It is not included in the upload package.

The mark is deliberately constructed from the existing LevyTate mint, coral, navy and rounded wordmark character. `public/brand/favicon-icon-only.svg` is not used because it is the separate MPR-style symbol.

## Build and validate

From the repository root:

```sh
npm run package:microsoft-copilot
npx -y @microsoft/m365agentstoolkit-cli validate \
  --package-file microsoft/levytate-copilot/levytate-microsoft-copilot-1.0.0.zip
```

The build creates the two PNGs, the contact sheet and the versioned ZIP. The ZIP contains only:

```text
manifest.json
assets/color.png
assets/outline.png
```

Do not add environment files, tokens, tenant exports, logs, source code or test data to the ZIP.

## Controlled internal upload

Keep the currently functioning custom federated connector installed as the rollback path. Do not remove or edit it before the branded package is proven.

For the controlled MPR Consulting tenant test:

1. Sign in to the Microsoft Teams admin center with the existing tenant administrator.
2. Open **Teams apps > Manage apps**.
3. Choose **Actions > Upload new app** (or **Upload new app**, depending on the current admin-center layout).
4. Upload `levytate-microsoft-copilot-1.0.0.zip`.
5. Restrict the app to the approved internal pilot audience, currently `james@mprconsulting.co.uk`, using the tenant's app availability/permission policy. Do not make it generally available.
6. Wait for the custom app to become available, then install it for the approved pilot user from **Teams > Apps > Manage your apps > Upload an app** if the tenant policy requires personal installation.
7. In Microsoft 365 Copilot, confirm that LevyTate appears as an available connected source and that the existing Entra consent continues to use the current registration.

No Microsoft Store submission is part of this package.

## Live branding acceptance

After internal installation, ask:

> What's going on with our apprenticeships at the minute? Anything I need to deal with?

Record these results independently:

1. Whether the Copilot source citation uses the branded LevyTate icon.
2. Whether the connector/source listing uses the branded LevyTate icon.
3. Whether federated-source citations continue to use Microsoft's generated initials.

Do not claim that the package replaces the small citation badge until this live Microsoft test proves it. Microsoft currently documents the colour icon as the representation for packaged agents in Microsoft 365 Copilot, but individual federated-source citation rendering remains a host-controlled behaviour.

## Rollback

If package installation or branding fails, leave the existing custom federated connector enabled and remove or disable only this branded pilot package. Do not change the MCP endpoint, Entra application, SSO registration, connector permissions or LevyTate Production environment.
