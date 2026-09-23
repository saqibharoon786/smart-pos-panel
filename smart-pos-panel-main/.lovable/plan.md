# Thermal receipt printing

## What will be built
- Print a clean thermal receipt automatically after every completed POS sale.
- Match the provided sample with store details, item rows, totals, terms, receipt number, and date/time.
- Support both common 80mm and 58mm printer widths through a POS printer-size selector.
- Add a Print button in POS History so any receipt can be printed again.
- Ensure only the receipt is sent to print, with no app menus, extra pages, or duplicated print command.

## Technical details
- Create a dedicated receipt print helper using an isolated print frame and printer-specific page CSS.
- Keep the selected paper width in the browser and default to 80mm.
- Use compact typography, safe margins, fixed item columns, and page-break protection for thermal printers.
- Trigger printing only from the completed-sale action; retain browser/printer copy controls.
- Verify receipt layout and both sale and reprint flows in the preview.
