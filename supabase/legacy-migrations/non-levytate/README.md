# Non-LevyTate legacy migrations

These SQL files are retained unchanged for audit history, but they are not part of the canonical LevyTate Production migration sequence and must not be included in LevyTate `db push` operations.

- `001`–`004` belong to legacy subscriber and public-site infrastructure.
- `005` belongs to an undeployed stock-signal subsystem.

None of these versions should be described or recorded as applied LevyTate migrations. The canonical LevyTate migration history starts at version `006`.

If the subscriber/public-site or stock products are revived, they require a separately reviewed database or project strategy. Do not move these files back into `supabase/migrations` or apply them to the LevyTate Production project without that review.
