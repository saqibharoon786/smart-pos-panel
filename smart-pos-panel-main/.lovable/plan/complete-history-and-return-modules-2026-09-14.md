# Complete history and return modules

## What will be built
- Add POP History showing every product addition, deletion, stock-in, and vendor return with search.
- Add POS History showing every receipt, sold item, quantity, price, totals, and refunds with search.
- Add POP Return with product search/scan, quantity and reason; returning to vendor reduces stock automatically.
- Add POS Return with receipt search, per-item return quantities and reason; customer returns restore stock and update refunded totals.
- Add all four screens to the side menu and ensure the existing checkout records complete sale details.

## Technical details
- Keep the requested dummy/local browser storage approach.
- Reuse the existing POP, sale, and return records in the store.
- Create a separate TanStack route for each screen with unique page metadata.
- Validate quantities so stock cannot become negative and sold quantities cannot be returned twice.
- Verify route generation, type safety, and the main sale/return flow in the preview.
