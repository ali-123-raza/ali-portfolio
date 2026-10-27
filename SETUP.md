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

## Hosting

Netlify, Vercel, and Cloudflare Pages can host the current static files. Upload the project folder, configure the custom domain, and enable HTTPS. Supabase remains the database, authentication service, and file storage.

For a custom domain, register a domain through Cloudflare Registrar, Namecheap, or Porkbun, then point its DNS records to the hosting provider. Use a domain such as `aliraza.dev` or `aliraza.blog` if available.
