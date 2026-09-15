# DesignerApp.tsx — GitHub Web edits

The large `components/DesignerApp.tsx` file is deliberately not replaced wholesale in this patch because the current file contains the full ordering workflow and we do not want to overwrite unrelated work.

Use `DesignerApp.tsx.patch` as the source of truth. In GitHub Web:

1. Open `components/DesignerApp.tsx` and click Edit.
2. Find `function assetUrl` and apply the first hunk.
3. Find `function garmentImageFor` and insert `garmentColorFallback` immediately after it.
4. Find the `useEffect` that posts `printflow:resize` and replace it with the stabilized observer hunk.
5. Find `ctx.fillStyle = color.hex` and apply that one-line replacement.
6. Find the SVG fallback path using `fill={color?.hex ...}` and apply that one-line replacement.
7. Find the `Garment color` WizardSection and replace only its `.map((item) => (` block with the final hunk.
8. Commit the file with the other PrintFlow storefront changes.

All six hunks are against the current PrintFlow `main` version reviewed for this build (DesignerApp blob SHA `853ae3ad4c3255d1a93b4a7999e0672d1e484fae`). If GitHub shows that file has changed substantially before you apply this build, do not overwrite the newer file blindly; re-open the patch against the new version.
