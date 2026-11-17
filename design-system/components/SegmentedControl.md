# SegmentedControl

A pill group for choosing one option inside a panel (layout, formula style, difficulty).

- `.seg[role=group]` of buttons with `aria-pressed`; the sliding pill is `--ink` with `--bg` text (tabs use `--accent`; segments stay neutral so they never compete with navigation).
- Same spring as Tabs; snaps first, slides after.
- At 480px and below, give long labels short twins (`.lg` / `.sm2` inside `.fmtseg`).
