# GlassPanel

The basic container: a Liquid Glass panel with a mono header.

- `.panel` = `--panel` fill, `blur(22px) saturate(175%)`, 1px `--rim`, inset `--hl` top highlight, soft `--shadow`, a 155° `--sheen` gradient and `--r-xl` (30px squircle / 20px fallback).
- Header: `.ph > h2` in JetBrains Mono 12px uppercase `--muted`, with optional actions or a count on the right.
- Panels sit over the drifting `.aurora` glow; don't nest a panel inside a panel (use `.raised` cards inside).
- On a mouse, `Playground.glint('.panel')` adds the accent glint.
