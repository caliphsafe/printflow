# 43 Build

“43 Build” is the standard complete delivery process for a production website, application, or tool.

Every 43 Build includes:

1. A complete replacement ZIP containing the current full project.
2. GitHub instructions identifying what to upload and what not to upload.
3. An additive Supabase migration when database or Storage changes are required.
4. An explicit “no Supabase migration required” statement when none is needed.
5. Exact Vercel environment-variable and deployment instructions.
6. TypeScript validation and a production build.
7. Release notes describing features, compatibility, and known provider dependencies.
8. An ordered test checklist from administrator setup through the customer transaction.
9. Honest integration states: Live, Test/Sandbox, Configured, or Roadmap.
10. No simulated or placeholder behavior presented as a production connection.

For production payment builds, 43 Build also requires:

- server-calculated totals
- hosted or PCI-appropriate checkout
- payment-reference persistence
- verified webhook or server confirmation
- paid-order status update
- retry/cancel behavior
- exact production-origin configuration
