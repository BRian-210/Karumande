# Supabase Migration

This project previously used MongoDB with Mongoose. The database bootstrap has been moved to PostgreSQL so the app can target a Supabase database.

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

## Important note

The app code still contains Mongoose-style model usage in the route layer. The new Postgres foundation is now in place, but each model and route needs to be moved from Mongoose queries to Supabase/Postgres queries before the application is fully database-runtime compatible.
