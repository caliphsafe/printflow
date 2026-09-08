43 Build patch — SanMar catalog TypeScript brand-list fix

Replace only:
lib/sanmar-catalog.ts

Fixes Vercel TypeScript error at the SanMar cached-catalog brand sort where Set/Array inference produced unknown.
No other behavior is changed.
