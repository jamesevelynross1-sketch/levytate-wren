# LevyTate Early Access Terms acceptance

## Purpose and boundary

LevyTate records explicit, versioned organisation-level acceptance of the published Early Access Terms before a real employer operational workspace is opened. The Privacy Notice is informational and is not treated as a contract or clickwrap document.

Only a currently authenticated, active member whose canonical role resolves server-side as `Apprenticeship Lead` can accept on behalf of an employer organisation. Email domain is not authority. Platform Admin can inspect safe status but cannot accept for an employer. Employee and Line Manager roles remain gated until their organisation has a current acceptance.

## Organisation access gate

- An Apprenticeship Lead without current acceptance is sent to `/levytate/accept-terms`.
- Employee and Line Manager users see a safe waiting state with Support and Account Help links. The state does not identify the expected acceptor.
- A current acceptance unlocks the normal role destination for all active members of that organisation.
- Public trust pages and login remain public.
- Live membership, role, Auth binding and prospect-access checks remain authoritative. Historic acceptance never reactivates revoked, expired or inactive access.

## Version and deterministic content hash

The current document comes from the `early-access-terms` entry in `lib/levytate/public-trust-content.ts`. The server builds a JSON representation in a fixed property order containing:

1. document type;
2. public version;
3. effective date;
4. title and summary;
5. every section heading, paragraph and bullet in published order.

UTF-8 bytes of that exact representation are hashed using SHA-256 and stored as 64 lowercase hexadecimal characters. The hash changes if the version or material published content changes. Both version and hash must match for the organisation gate. Previous rows are never overwritten; a changed version or hash requires a new explicit acceptance. Content releases should always increment the public version even though the hash independently protects content integrity.

## Database model

Migration `023_create_early_access_terms_acceptances.sql` creates `levytate_early_access_terms_acceptances` with UUID identity, organisation and LevyTate-user foreign keys, document type, version, content hash, server timestamps, acceptance method and role snapshot.

The table is append-only for application use:

- RLS is enabled and forced;
- browser roles have no privileges;
- service role has `SELECT` and `INSERT` only;
- service role has no update, delete or truncate privilege;
- no browser-accessible mutation route exists;
- duplicate and concurrent submissions use a unique evidence key and idempotent insert handling.

Historical evidence is intentionally protected by restrictive foreign keys. Any lawful erasure or evidence-retention conflict requires an approved database-owner process rather than an application delete path.

## Server acceptance and audit

The POST endpoint accepts only an explicit acknowledgement flag. Organisation, user, role, document version and content hash are ignored if supplied by a browser and are always resolved server-side. Safe audit events cover viewed, accepted, duplicate and denied attempts without storing the terms body, session values or network identifiers. View evidence is rate-bounded to avoid repeated refresh events.

## Internal beta behaviour

Internal fictional beta sessions bypass the persistent legal gate so demonstrations remain usable. They cannot create acceptance records. This bypass is based on signed session authentication mode, not an email supplied by the browser. Production internal beta login remains independently disabled by its existing environment boundary. A real Supabase-authenticated employer session never receives this bypass.

## Platform Admin visibility

The existing Platform Admin-only publication metadata endpoint returns organisation name, current version, accepted state, timestamp, safe accepting-user display identifier, role snapshot and reacceptance requirement. It exposes no token, network identifier, provider payload or unrelated employer record and has no write method.

## Go-live gate

Technical acceptance does not constitute professional legal approval. Real employer invitations remain prohibited until the operator identity, controller/processor position, lawful bases, organisation processing terms, retention, transfers, liability and governing-law wording are approved and the published version is confirmed for issue. Supabase Pro and confirmed daily backups remain separate mandatory gates before real employer or employee data is loaded.
