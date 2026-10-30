# Ali Raza Portfolio Setup

## Recommended stack

- Supabase Auth for the owner email/password login
- Supabase Postgres for blog posts and downloadable resource metadata
- Supabase Storage for PDFs and other public files
- Static hosting on Netlify, Vercel, or Cloudflare Pages
- A custom domain connected through the hosting provider

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase-schema.sql`.
3. In Authentication > Users, create your owner account with `alirazagcuf.ar@gmail.com`.
4. Copy the project URL and anon key into `supabase-config.js`.
5. Open the site normally. Visitors see the public archive and no editor.
6. Use **Owner login** to access the private writing tools.

The anon key is safe to expose in a frontend only when Row Level Security policies are enabled. Never put a Supabase service-role key in this folder or in browser code.

## Books library

1. In Supabase > SQL Editor, run `supabase-books.sql` (creates the `books` table, a public `books` storage bucket, policies, and the download counter).
2. Sign in with **Owner login**, scroll to **Books**, and drag a file into the upload box.
3. Free plan limits: 1 GB storage, 50 MB per file, 5 GB monthly bandwidth. Keep an eye on usage in Supabase > Reports.

## Hosting

Netlify, Vercel, and Cloudflare Pages can host the current static files. Upload the project folder, configure the custom domain, and enable HTTPS. Supabase remains the database, authentication service, and file storage.

For a custom domain, register a domain through Cloudflare Registrar, Namecheap, or Porkbun, then point its DNS records to the hosting provider. Use a domain such as `aliraza.dev` or `aliraza.blog` if available.
