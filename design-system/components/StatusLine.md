# StatusLine

The line under the top bar on every tab: mode and hint on the left, stat pills on the right.

- **Left:** `<p class="sb-l"><b>Mode</b> · one-line hint</p>`, hint in `--muted`, verb first.
- **Right:** `.sb-r` of `.stat` pills: a mono uppercase `<small>` label and a tabular `<b>` number.
- When a number changes, call `Playground.bump(b)`: a short spring scale in `--accent`.
- The mode text crossfades when the tab changes; stats never live in the top bar.
