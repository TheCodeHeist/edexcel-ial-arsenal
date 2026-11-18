/* Shapes the flight scene (Scene.svelte) is drawn from. */
import type { Flight } from './physics';

export interface Shot { f: Flight; color: string }
export interface Ball { f: Flight; t: number; color: string }
/** A dimension line in metres; off moves it sideways (vertical lines) or down (horizontal lines), in pixels. */
export interface Dim { a: [number, number]; b: [number, number]; label: string; off?: number }
/** The labels on a question's set-up: launch speed, angle and height (the unknown left out or shown as “?”). */
export interface Annot { u?: string; deg?: string; h?: string }
export interface Target { x: number; y: number; w: number }
export interface Wall { x: number; h: number }
