# 43 Build

**43 Build** is the standard delivery process for future websites, apps, tools, and major releases.

## 1. Complete build package

- Deliver one downloadable ZIP containing the complete current project.
- Include all updated and unchanged files needed for a clean replacement deployment.
- Exclude generated folders and machine-specific files such as `node_modules`, `.next`, build caches, and local secrets.
- Production-build and type-check the project before packaging it.

## 2. GitHub steps

- Identify the exact folder inside the ZIP whose contents belong in the repository root.
- State whether the user should replace the repository or upload only selected files.
- Prefer full replacement instructions for major releases.
- Preserve required root files such as `.npmrc`.
- Use a copy/paste and browser-based GitHub workflow without requiring terminal commands.

## 3. Supabase steps

- Include a new additive migration only when database, Storage, RLS, function, or persistent configuration changes are required.
- Name migrations with a date and release description.
- Tell the user exactly which migration to run and which older migrations not to rerun.
- Explain every table, column, bucket, policy, or data update made by the migration.
- State clearly when no Supabase changes are required.

## 4. Vercel steps

- List new environment variables, changed variables, and variables that remain unchanged.
- Never place secret values inside the ZIP.
- Explain the GitHub-to-Vercel redeployment path.
- State whether build settings require changes.
- Confirm the production build passed before delivery.

## 5. Testing steps

- Give a focused test sequence in the order the feature should be validated.
- Start with one representative item or workflow before bulk configuration.
- Include expected success states and visible error states.
- Separate demo, configured, and fully live integrations honestly.

## 6. Delivery standard

Every 43 Build response should provide:

1. Downloadable ZIP
2. Summary of completed changes
3. GitHub upload instructions
4. Supabase instructions, or an explicit statement that none are needed
5. Vercel instructions
6. Ordered testing checklist
7. Important limitations or provider access still required
