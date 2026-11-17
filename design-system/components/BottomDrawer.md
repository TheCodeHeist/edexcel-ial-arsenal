# BottomDrawer

The phone pattern (≤760px): a floating dock opens a glass bottom sheet, so items and their drop target are never a scroll apart.

- **Dock:** a floating glass pill at the bottom (safe-area aware) with one button per pane and an optional count; the button for the *next needed* item gets `.nudge` (accent fill + soft pulse).
- **Sheet:** glass, `--r-xl` top corners, up to 76svh; a grab handle, a segmented pane switch, a short mono tip and Done; panes scroll inside it. Close by swipe-down (>80px), Done, the backdrop or Esc.
- **Behaviour:** tapping a card adds it and closes the sheet; starting a long-press drag slides it away fast so the target shows. The page behind doesn't scroll while it's open.
- Use `Playground.drawer({dock, sheet, backdrop})` → `{open(pane), close(fast)}`; move the desktop side-list content into the panes at the breakpoint.
