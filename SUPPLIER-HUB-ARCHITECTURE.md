# Supplier Hub architecture

## Shared product model
All suppliers map into the same concepts:
- supplier/provider
- style
- brand and part number
- colors
- sizes
- SKU/GTIN
- front/back/swatch imagery
- wholesale cost snapshot
- inventory snapshot

## Live connectors
S&S remains the first live connector. SanMar and AlphaBroder cards are placeholders for later connectors.

## Safe order flow
Customer payment -> blank-order draft -> admin review -> live supplier submission.

The draft workflow works without an API key. Live one-click purchasing remains disabled unless an actual connected provider supports order submission.
