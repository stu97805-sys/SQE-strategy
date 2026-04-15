# SQE Strategy Analysis Platform

This project is prepared for Cloudflare deployment with Cloudflare Pages, Pages Functions, D1, and backend-managed OpenAI secrets.

## Local development

1. `npm install`
2. `npm run dev`

## Cloudflare deployment

1. Create the Pages project:
   `npx wrangler pages project create sqe-strategy-analysis-platform --production-branch main`
2. Create the D1 database:
   `npx wrangler d1 create sqe-strategy-db`
3. Copy the returned `database_id` into `wrangler.toml`.
4. Apply the schema:
   `npx wrangler d1 execute sqe-strategy-db --remote --file=./schema.sql`
5. Add secrets:
   `npx wrangler pages secret put OPENAI_API_KEY --project-name sqe-strategy-analysis-platform`
   `npx wrangler pages secret put OPENAI_MODEL --project-name sqe-strategy-analysis-platform`
6. Build and deploy:
   `npm run build`
   `npx wrangler pages deploy dist --project-name sqe-strategy-analysis-platform --branch main`

## Storage

- `quality_cases` stores case details, generated reports, and uploaded attachment JSON
- `reference_docs` stores uploaded standard/reference files
