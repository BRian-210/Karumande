# Supabase Migration

This project previously used MongoDB with Mongoose. The runtime API layer now targets PostgreSQL/Supabase instead of MongoDB.

## Environment

Set these values in your `.env` file:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

`DATABASE_URL` should be the pooled Supabase Postgres connection string.

## Apply the schema

1. Open your Supabase project SQL editor.
2. Paste the contents of `supabase/schema.sql`.
3. Run the script once to create the base tables, indexes, and `updated_at` triggers.

## Current status

The main Express runtime and helper/admin scripts have been moved to Postgres-backed repositories, and the old unused `src/routes/change-pasword.js` route has been removed.
