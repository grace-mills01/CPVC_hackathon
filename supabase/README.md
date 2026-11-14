# Database outline

The proposed entities and relationships are described in [PROJECT_PLAN.md](../PROJECT_PLAN.md#database-outline). JavaScript shapes live in `src/lib/models.js`.

No migration or live database is included yet. Before creating tables, implement the access policies and transactional join/capacity rules described in the plan together with the schema, and test permissions and concurrent joins. Never expose a Supabase secret or service-role key to the browser. Migrations will live in `migrations/` and database tests in `tests/`.
