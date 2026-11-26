/* GeoGebra Apps API wrapper implementing GraphEngine for Graph Lab.
   Lazily loads https://www.geogebra.org/apps/deployggb.js on the client and supports full two-way sync
   (edits, additions, deletions, renames, color/visibility changes in GeoGebra's Algebra/Graphics views
   flow back to the side UI), incremental expression diffing, setRepaintingActive batching, and rAF slider writes. */

import { hex2rgb } from '../../lib/util';
import {
  DEFAULT_WINDOW_2D,
  DEFAULT_WINDOW_3D,
  fmtNum,
  normalizeGGBCommand,
  type EquationTestOptions,
  type EquationTestReport,
  type Extremum2D,
  type ExprItem,
  type FeatureReport,
  type GraphAnalysis,
  type GraphEngine,
  type GraphMode,
  type GraphWindow,
  type IntersectionReport,
  type LineStyle,
  type LiveObject,
  type MountOptions,
  type Point2D,
  type PointCheckResult,
  type SliderSpec,
} from './engine';

const DEPLOY_GGB_URL = 'https://www.geogebra.org/apps/deployggb.js';
const SCRATCH_PREFIX = '_gl_';

interface GGBAPI {
  evalCommand(cmdString: string): boolean;
  evalCommandGetLabels(cmdString: string): string | null;
  getAllObjectNames(type?: string): string[];
  getObjectType(objName: string): string;
  getValueString(objName: string, useLocalizedInput?: boolean): string;
  getCommandString?(objName: string, useLocalizedInput?: boolean): string;
  getDefinitionString(objName: string): string;
  getLaTeXString(objName: string): string;
  getValue(objName: string): number;
  setValue(objName: string, value: number): void;
  getXcoord(objName: string): number;
  getYcoord(objName: string): number;
  getZcoord(objName: string): number;
  isDefined(objName: string): boolean;
  isIndependent?(objName: string): boolean;
  exists?(objName: string): boolean;
  getVisible?(objName: string, view?: number): boolean;
  getColor?(objName: string): string;
  setColor(objName: string, r: number, g: number, b: number): void;
  setLineStyle(objName: string, style: number): void;
  setLineThickness(objName: string, thickness: number): void;
  setVisible(objName: string, visible: boolean): void;
  setLabelVisible(objName: string, visible: boolean): void;
  setCaption(objName: string, caption: string): void;
  deleteObject(objName: string): void;
  newConstruction(): void;
  setCoordSystem(xmin: number, xmax: number, ymin: number, ymax: number, zmin?: number, zmax?: number, yVertical?: boolean): void;
  setAxesVisible(xAxis: boolean, yAxis: boolean, zAxis?: boolean): void;
  setGridVisible(visible: boolean): void;
  setErrorDialogsActive(flag: boolean): void;
  setRepaintingActive?(flag: boolean): void;
  setPerspective(perspective: string): void;
  showToolBar?(show: boolean): void;
  showAlgebraInput?(show: boolean): void;
  setSize(width: number, height: number): void;
  getXML(): string;
  getPNGBase64(exportScale: number, transparent: boolean, DPI: number): string;
  registerAddListener(cb: ((name: string) => void) | string): void;
  registerRemoveListener(cb: ((name: string) => void) | string): void;
  registerUpdateListener(cb: ((name: string) => void) | string): void;
  registerRenameListener?(cb: ((oldName: string, newName: string) => void) | string): void;
  registerClearListener(cb: (() => void) | string): void;
  remove(): void;
}

interface GGBAppletConstructor {
  new (params: Record<string, unknown>, html5NoWebSimple?: boolean | string): {
    inject(containerId: string): void;
  };
}

declare global {
  interface Window {
    GGBApplet?: GGBAppletConstructor;
  }
}

let scriptPromise: Promise<GGBAppletConstructor> | null = null;
let mountSeq = 0;
let extSeq = 0;

function loadDeployGGB(): Promise<GGBAppletConstructor> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('GeoGebra only runs in the browser.'));
  }
  if (window.GGBApplet) return Promise.resolve(window.GGBApplet);
  return (scriptPromise ??= new Promise<GGBAppletConstructor>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = DEPLOY_GGB_URL;
    s.async = true;
    const timer = window.setTimeout(() => fail('Timed out loading GeoGebra. Check your connection and try again.'), 15000);
    s.onload = () => {
      window.clearTimeout(timer);
      if (window.GGBApplet) resolve(window.GGBApplet);
      else fail('GeoGebra loaded, but GGBApplet was not found.');
    };
    s.onerror = () => fail('Could not load GeoGebra (you may be offline or an extension blocked cdn/geogebra.org).');
    document.head.append(s);

    function fail(msg: string) {
      window.clearTimeout(timer);
      scriptPromise = null;
      s.remove();
      reject(new Error(msg));
    }
  }));
}

/** Start fetching deployggb.js in the background as soon as Graph Lab loads on the client. */
export function preloadGeoGebra(): void {
  if (typeof window !== 'undefined') loadDeployGGB().catch(() => {});
}

const LINE_STYLE_CODE: Record<LineStyle, number> = { solid: 0, dashed: 1, dotted: 3 };

function defaultSliderSpec(v: number): SliderSpec {
  if (Math.abs(v) <= 5) return { min: -5, max: 5, step: 0.1 };
  return {
    min: Math.min(-10, Math.floor(v - 5)),
    max: Math.max(10, Math.ceil(v + 5)),
    step: 0.1,
  };
}

function dedupePoints(pts: Point2D[], eps = 1e-4): Point2D[] {
  const out: Point2D[] = [];
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < eps)) out.push(p);
  }
  return out.sort((a, b) => a.x - b.x || a.y - b.y);
}

function stripEqPrefix(valueStr: string, prefixLabel: string): string {
  const re = new RegExp(`^${prefixLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\([^)]*\\))?\\s*[:=]\\s*`);
  return valueStr.replace(re, '').trim();
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sameMeta(a: ExprItem, b: ExprItem): boolean {
  return a.id === b.id
    && a.cmd === b.cmd
    && (a.color ?? '') === (b.color ?? '')
    && (a.visible !== false) === (b.visible !== false)
    && (a.style ?? 'solid') === (b.style ?? 'solid')
    && (a.label ?? '') === (b.label ?? '');
}

const cleanGGBText = (s: string) => s.replace(/\u212f/g, 'e').trim();

interface GGBSnap {
  type: string;
  def: string;
  val: string;
  vis: boolean;
  col: string;
  indep: boolean;
  numVal?: number;
  sig: string;
  mathSig: string;
}

export class GeoGebraEngine implements GraphEngine {
  readonly kind = 'geogebra' as const;
  private _mode: GraphMode = '2d';
  private _ready = false;
  private api: GGBAPI | null = null;
  private container: HTMLElement | null = null;
  private appletId = '';
  private hostId = '';
  private objects: LiveObject[] = [];
  private items: ExprItem[] = [];
  private ggbSig = new Map<string, { sig: string; mathSig: string }>();
  private dirtyLabels = new Set<string>();
  private pendingClear = false;
  private lastWindow: GraphWindow = { ...DEFAULT_WINDOW_2D };
  private lastWidth = 0;
  private lastHeight = 0;
  private showAxes = true;
  private showGrid = true;
  private showTools = false;
  private suppressEvents = false;
  private notifyTimer: number | null = null;
  private listeners = new Set<(objects: LiveObject[], external: boolean) => void>();

  get mode(): GraphMode { return this._mode; }
  get ready(): boolean { return this._ready; }

  private withRepaintPaused<T>(fn: () => T): T {
    try { this.api?.setRepaintingActive?.(false); } catch { /* ignore */ }
    try {
      return fn();
    } finally {
      try { this.api?.setRepaintingActive?.(true); } catch { /* ignore */ }
    }
  }

  private readSnap(lbl: string): GGBSnap {
    const type = this.api?.getObjectType(lbl) || 'object';
    let def = '';
    try {
      def = cleanGGBText(this.api!.getCommandString?.(lbl, true) || '');
      if (!def) def = cleanGGBText(this.api!.getDefinitionString(lbl) || '');
    } catch { /* ignore */ }
    let val = '';
    try {
      val = cleanGGBText(this.api!.getValueString(lbl) || '');
    } catch { /* ignore */ }
    let vis = true;
    try {
      if (typeof this.api!.getVisible === 'function') vis = this.api!.getVisible(lbl);
    } catch { /* ignore */ }
    let col = '';
    try {
      const c = this.api!.getColor?.(lbl) || '';
      if (/^#[0-9a-f]{6}$/i.test(c)) col = c.toLowerCase();
    } catch { /* ignore */ }
    let indep = true;
    try {
      if (typeof this.api!.isIndependent === 'function') indep = this.api!.isIndependent(lbl);
    } catch { /* ignore */ }
    let numVal: number | undefined;
    if (type === 'numeric') {
      try {
        const v = this.api!.getValue(lbl);
        if (Number.isFinite(v)) numVal = v;
      } catch { /* ignore */ }
    }
    const mathSig = JSON.stringify([type, def, val, indep]);
    const sig = JSON.stringify([type, def, val, vis, col, indep]);
    return { type, def, val, vis, col, indep, numVal, sig, mathSig };
  }

  private buildCmdFromGGB(lbl: string, snap: GGBSnap): string {
    const def = snap.def;
    const val = snap.val;
    if (def) {
      const ownHead = new RegExp(`^${escapeReg(lbl)}(?:\\s*\\([^)]*\\))?\\s*[:=]`);
      if (ownHead.test(def)) return def;
      if (def.includes('=')) return `${lbl}: ${def}`;
      const sigMatch = new RegExp(`^${escapeReg(lbl)}\\s*(\\([^)]*\\))\\s*[:=]`).exec(val);
      const lhs = sigMatch ? `${lbl}${sigMatch[1]}` : lbl;
      return `${lhs} = ${def}`;
    }
    return val || lbl;
  }

  async mount(container: HTMLElement, opts: MountOptions): Promise<void> {
    this.destroy();
    this._mode = opts.mode;
    this.showAxes = opts.showAxes ?? true;
    this.showGrid = opts.showGrid ?? true;
    this.showTools = opts.showNativeTools ?? false;
    this.lastWindow = opts.window
      ? { ...opts.window }
      : opts.mode === '3d'
        ? { ...DEFAULT_WINDOW_3D }
        : { ...DEFAULT_WINDOW_2D };

    const GGBApplet = await loadDeployGGB();
    const seq = ++mountSeq;
    this.hostId = `ggb-host-${seq}`;
    this.appletId = `ggbApp_${seq}`;
    this.container = container;
    this.lastWidth = Math.max(300, Math.round(opts.width));
    this.lastHeight = Math.max(320, Math.round(opts.height));

    const host = document.createElement('div');
    host.id = this.hostId;
    host.className = 'ggb-host';
    container.innerHTML = '';
    container.append(host);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('GeoGebra took too long to initialise.'));
      }, 20000);

      const perspective = this._mode === '3d'
        ? (this.showTools ? 'AT' : 'T')
        : (this.showTools ? 'AG' : 'G');

      const applet = new GGBApplet({
        id: this.appletId,
        appName: this._mode === '3d' ? '3d' : 'graphing',
        perspective,
        width: this.lastWidth,
        height: this.lastHeight,
        showToolBar: this.showTools,
        showAlgebraInput: this.showTools,
        showMenuBar: false,
        showResetIcon: false,
        showZoomButtons: true,
        showFullscreenButton: false,
        enableUndoRedo: false,
        showLogging: false,
        enableRightClick: true,
        enableShiftDragZoom: true,
        enableLabelDrag: true,
        enableLabelDrags: true,
        errorDialogsActive: false,
        preventFocus: true,
        borderColor: 'transparent',
        language: 'en',
        appletOnLoad: (api: GGBAPI) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          this.api = api;
          this._ready = true;
          try { api.setErrorDialogsActive(false); } catch { /* ignore */ }
          this.withRepaintPaused(() => {
            this.applyAxesAndGrid();
            this.setWindow(this.lastWindow);
          });
          this.registerListeners();
          resolve();
        },
      }, true);

      try {
        applet.inject(this.hostId);
      } catch (e) {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          reject(e instanceof Error ? e : new Error('Failed to inject GeoGebra applet.'));
        }
      }
    });
  }

  private scheduleRefresh() {
    if (this.notifyTimer !== null) window.clearTimeout(this.notifyTimer);
    this.notifyTimer = window.setTimeout(() => {
      this.notifyTimer = null;
      this.refreshFromConstruction();
    }, 150);
  }

  private registerListeners() {
    if (!this.api) return;
    const onMutate = (name?: string) => {
      if (this.suppressEvents) return;
      if (name && name.startsWith(SCRATCH_PREFIX)) return;
      if (name) this.dirtyLabels.add(name);
      this.scheduleRefresh();
    };
    try {
      this.api.registerAddListener((name) => onMutate(name));
      this.api.registerRemoveListener((name) => onMutate(name));
      this.api.registerUpdateListener((name) => onMutate(name));
      this.api.registerRenameListener?.((oldName, newName) => {
        if (this.suppressEvents) return;
        for (const obj of this.objects) {
          const i = obj.ggbLabels.indexOf(oldName);
          if (i >= 0) obj.ggbLabels[i] = newName;
        }
        this.dirtyLabels.add(newName);
        this.scheduleRefresh();
      });
      this.api.registerClearListener(() => {
        if (this.suppressEvents) return;
        this.pendingClear = true;
        this.scheduleRefresh();
      });
    } catch { /* ignore */ }
  }

  private applyAxesAndGrid() {
    if (!this.api) return;
    try {
      if (this._mode === '3d') this.api.setAxesVisible(this.showAxes, this.showAxes, this.showAxes);
      else this.api.setAxesVisible(this.showAxes, this.showAxes);
      this.api.setGridVisible(this.showGrid);
    } catch { /* ignore */ }
  }

  private refreshFromConstruction() {
    if (!this.api || !this._ready) return;
    let allNames: string[];
    try {
      allNames = this.api.getAllObjectNames().filter((n) => !n.startsWith(SCRATCH_PREFIX));
    } catch {
      return;
    }
    const allSet = new Set(allNames);
    const dirty = new Set(this.dirtyLabels);
    this.dirtyLabels.clear();

    if (this.pendingClear || (allNames.length === 0 && this.objects.some((o) => !o.error))) {
      this.pendingClear = false;
      const errObjs = this.objects.filter((o) => !!o.error);
      const errIds = new Set(errObjs.map((o) => o.id));
      const nextItems = this.items.filter((it) => errIds.has(it.id));
      if (errObjs.length !== this.objects.length) {
        this.objects = errObjs;
        this.items = nextItems;
        this.ggbSig.clear();
        this.emitChange(true);
      }
      return;
    }

    let changed = false;
    const nextObjects: LiveObject[] = [];
    const nextItems: ExprItem[] = [];
    const claimedLabels = new Set<string>();
    const prevItemsById = new Map(this.items.map((x) => [x.id, x]));

    // 1. Reconcile tracked objects (keep errors untouched, drop deleted ones, update surviving ones)
    for (const obj of this.objects) {
      const prevItem = prevItemsById.get(obj.id);
      if (obj.error) {
        nextObjects.push(obj);
        if (prevItem) nextItems.push(prevItem);
        continue;
      }

      const surviving = obj.ggbLabels.filter((l) => allSet.has(l));
      if (!surviving.length) {
        this.ggbSig.delete(obj.id);
        changed = true;
        continue;
      }
      if (surviving.length !== obj.ggbLabels.length) {
        obj.ggbLabels = surviving;
        changed = true;
      }
      for (const l of surviving) claimedLabels.add(l);

      const primary = surviving[0];
      const snap = this.readSnap(primary);
      const prevRec = this.ggbSig.get(obj.id);

      const newColor = snap.col || obj.color;
      const newSlider = snap.type === 'numeric' && snap.indep && snap.numVal !== undefined
        ? (obj.slider ?? defaultSliderSpec(snap.numVal))
        : undefined;

      if (!prevRec || prevRec.sig !== snap.sig || dirty.has(primary)) {
        const mathChanged = !prevRec || prevRec.mathSig !== snap.mathSig;
        obj.type = snap.type;
        obj.valueString = snap.val;
        obj.visible = snap.vis;
        obj.color = newColor;
        obj.numericValue = snap.numVal;
        obj.slider = newSlider;

        if (mathChanged) {
          obj.cmd = this.buildCmdFromGGB(primary, snap);
        }

        if (prevItem) {
          prevItem.cmd = obj.cmd;
          prevItem.visible = obj.visible;
          prevItem.color = obj.color;
        }
        this.ggbSig.set(obj.id, { sig: snap.sig, mathSig: snap.mathSig });
        changed = true;
      } else if (!!obj.slider !== !!newSlider) {
        obj.slider = newSlider;
        changed = true;
      }

      nextObjects.push(obj);
      if (prevItem) {
        nextItems.push(prevItem);
      } else {
        nextItems.push({
          id: obj.id,
          cmd: obj.cmd,
          ...(obj.label ? { label: obj.label } : {}),
          color: obj.color,
          visible: obj.visible,
        });
      }
    }

    // 2. Pick up any newly created objects from GeoGebra's Algebra/Graphics tools
    for (const lbl of allNames) {
      if (claimedLabels.has(lbl)) continue;
      claimedLabels.add(lbl);
      const snap = this.readSnap(lbl);
      const cmd = this.buildCmdFromGGB(lbl, snap);
      const color = snap.col || '#1e66f5';
      const id = `ggb_${++extSeq}_${Date.now().toString(36).slice(-3)}`;
      const slider = snap.type === 'numeric' && snap.indep && snap.numVal !== undefined
        ? defaultSliderSpec(snap.numVal)
        : undefined;

      const obj: LiveObject = {
        id,
        ggbLabels: [lbl],
        cmd,
        type: snap.type,
        valueString: snap.val,
        color,
        visible: snap.vis,
        numericValue: snap.numVal,
        slider,
      };
      const item: ExprItem = { id, cmd, color, visible: snap.vis };
      this.ggbSig.set(id, { sig: snap.sig, mathSig: snap.mathSig });
      nextObjects.push(obj);
      nextItems.push(item);
      changed = true;
    }

    if (changed) {
      this.objects = nextObjects;
      this.items = nextItems;
      this.emitChange(true);
    }
  }

  private emitChange(external: boolean) {
    const snap = this.getExpressions();
    for (const fn of this.listeners) {
      try { fn(snap, external); } catch { /* ignore */ }
    }
  }

  private applyItemStyle(labels: string[], item: ExprItem) {
    if (!this.api) return;
    const color = item.color ?? '#1e66f5';
    const visible = item.visible !== false;
    const [r, g, b] = hex2rgb(color.startsWith('#') && color.length === 7 ? color : '#1e66f5');
    const styleCode = LINE_STYLE_CODE[item.style ?? 'solid'] ?? 0;

    for (const lbl of labels) {
      try {
        this.api.setColor(lbl, r, g, b);
        this.api.setVisible(lbl, visible);
        this.api.setLineStyle(lbl, styleCode);
        if (item.label) {
          this.api.setCaption(lbl, item.label);
          this.api.setLabelVisible(lbl, true);
        } else {
          this.api.setLabelVisible(lbl, false);
        }
      } catch { /* ignore per-object style quirk */ }
    }
  }

  private evalSingleItem(item: ExprItem): LiveObject {
    const color = item.color ?? '#1e66f5';
    const visible = item.visible !== false;
    const norm = normalizeGGBCommand(item.cmd);
    if (!norm) {
      this.ggbSig.delete(item.id);
      return { id: item.id, ggbLabels: [], cmd: item.cmd, label: item.label, type: 'empty', valueString: '', color, visible, error: 'Empty expression.' };
    }

    let rawLabels: string | null = null;
    try {
      rawLabels = this.api!.evalCommandGetLabels(norm);
    } catch {
      rawLabels = null;
    }

    const labels = rawLabels ? rawLabels.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (!labels.length) {
      this.ggbSig.delete(item.id);
      return {
        id: item.id,
        ggbLabels: [],
        cmd: item.cmd,
        label: item.label,
        type: 'error',
        valueString: '',
        color,
        visible,
        error: 'GeoGebra could not parse this expression.',
      };
    }

    this.applyItemStyle(labels, item);

    const primary = labels[0];
    const snap = this.readSnap(primary);
    this.ggbSig.set(item.id, { sig: snap.sig, mathSig: snap.mathSig });

    const slider = snap.type === 'numeric' && snap.indep && snap.numVal !== undefined
      ? defaultSliderSpec(snap.numVal)
      : undefined;

    return {
      id: item.id,
      ggbLabels: labels,
      cmd: item.cmd,
      label: item.label,
      type: snap.type,
      valueString: snap.val,
      color,
      visible,
      numericValue: snap.numVal,
      slider,
    };
  }

  async setExpressions(items: ExprItem[]): Promise<LiveObject[]> {
    const nextItems = items.map((x) => ({ ...x }));
    if (!this.api || !this._ready) {
      this.items = nextItems;
      this.objects = nextItems.map((it) => ({
        id: it.id,
        ggbLabels: [],
        cmd: it.cmd,
        label: it.label,
        type: 'pending',
        valueString: '',
        color: it.color ?? '#1e66f5',
        visible: it.visible !== false,
      }));
      return this.getExpressions();
    }

    const prevItems = this.items;
    const prevObjects = this.objects;

    this.suppressEvents = true;
    try {
      this.withRepaintPaused(() => {
        // Fast path 1: same ids & commands — only update style/visibility/label on existing labels
        if (
          nextItems.length === prevItems.length
          && prevObjects.length === prevItems.length
          && nextItems.every((it, i) => it.id === prevItems[i].id && it.cmd === prevItems[i].cmd)
        ) {
          for (let i = 0; i < nextItems.length; i++) {
            const it = nextItems[i], old = prevItems[i], obj = prevObjects[i];
            if (!sameMeta(it, old) && !obj.error && obj.ggbLabels.length) {
              this.applyItemStyle(obj.ggbLabels, it);
              obj.color = it.color ?? '#1e66f5';
              obj.visible = it.visible !== false;
              obj.label = it.label;
              const snap = this.readSnap(obj.ggbLabels[0]);
              this.ggbSig.set(obj.id, { sig: snap.sig, mathSig: snap.mathSig });
            }
          }
          this.items = nextItems;
          return;
        }

        // Fast path 2: pure append — keep existing objects untouched and evaluate only new tail items
        if (
          prevItems.length > 0
          && nextItems.length > prevItems.length
          && prevObjects.length === prevItems.length
          && prevItems.every((old, i) => sameMeta(nextItems[i], old))
        ) {
          const added = nextItems.slice(prevItems.length).map((it) => this.evalSingleItem(it));
          this.objects = [...prevObjects, ...added];
          this.items = nextItems;
          return;
        }

        // Fast path 3: independent single removal — delete only that item's GeoGebra labels
        if (
          nextItems.length === prevItems.length - 1
          && prevObjects.length === prevItems.length
        ) {
          let remIdx = -1;
          let j = 0;
          for (let i = 0; i < prevItems.length; i++) {
            if (j < nextItems.length && sameMeta(prevItems[i], nextItems[j])) {
              j++;
            } else if (remIdx === -1) {
              remIdx = i;
            } else {
              remIdx = -2;
              break;
            }
          }
          if (remIdx >= 0 && j === nextItems.length) {
            const remObj = prevObjects[remIdx];
            const tailCmds = prevItems.slice(remIdx + 1).map((x) => normalizeGGBCommand(x.cmd));
            const hasDep = remObj.ggbLabels.some((lbl) => {
              const re = new RegExp(`\\b${escapeReg(lbl)}\\b`);
              return tailCmds.some((c) => re.test(c));
            });
            if (!hasDep) {
              for (const lbl of remObj.ggbLabels) {
                try { this.api!.deleteObject(lbl); } catch { /* ignore */ }
              }
              this.ggbSig.delete(remObj.id);
              this.objects = [...prevObjects.slice(0, remIdx), ...prevObjects.slice(remIdx + 1)];
              this.items = nextItems;
              return;
            }
          }
        }

        // Fallback: full atomic rebuild with repainting paused
        this.ggbSig.clear();
        this.api!.newConstruction();
        this.applyAxesAndGrid();
        this.setWindow(this.lastWindow);
        this.objects = nextItems.map((it) => this.evalSingleItem(it));
        this.items = nextItems;
      });
    } finally {
      this.suppressEvents = false;
    }

    this.emitChange(false);
    return this.getExpressions();
  }

  getExpressions(): LiveObject[] {
    return this.objects.map((o) => ({ ...o, ggbLabels: [...o.ggbLabels], slider: o.slider ? { ...o.slider } : undefined }));
  }

  setNumericValue(ggbLabel: string, value: number, commit = false): void {
    if (!this.api || !this._ready || !Number.isFinite(value)) return;
    this.suppressEvents = true;
    try {
      this.api.setValue(ggbLabel, value);
      for (const obj of this.objects) {
        if (obj.ggbLabels.includes(ggbLabel)) {
          obj.numericValue = value;
          if (commit) {
            const snap = this.readSnap(ggbLabel);
            obj.valueString = snap.val;
            obj.cmd = this.buildCmdFromGGB(ggbLabel, snap);
            const item = this.items.find((x) => x.id === obj.id);
            if (item) item.cmd = obj.cmd;
            this.ggbSig.set(obj.id, { sig: snap.sig, mathSig: snap.mathSig });
          }
        } else if (commit && obj.ggbLabels[0]) {
          const primary = obj.ggbLabels[0];
          const snap = this.readSnap(primary);
          obj.valueString = snap.val;
          this.ggbSig.set(obj.id, { sig: snap.sig, mathSig: snap.mathSig });
        }
      }
    } finally {
      this.suppressEvents = false;
    }
    if (commit) this.emitChange(false);
  }

  setVisible(id: string, visible: boolean): void {
    const obj = this.objects.find((o) => o.id === id);
    if (!obj) return;
    obj.visible = visible;
    const item = this.items.find((x) => x.id === id);
    if (item) item.visible = visible;
    if (this.api && this._ready) {
      this.suppressEvents = true;
      try {
        for (const lbl of obj.ggbLabels) this.api.setVisible(lbl, visible);
        if (obj.ggbLabels[0]) {
          const snap = this.readSnap(obj.ggbLabels[0]);
          this.ggbSig.set(obj.id, { sig: snap.sig, mathSig: snap.mathSig });
        }
      } finally {
        this.suppressEvents = false;
      }
    }
    this.emitChange(false);
  }

  setColor(id: string, hex: string): void {
    const obj = this.objects.find((o) => o.id === id);
    if (!obj) return;
    obj.color = hex;
    const item = this.items.find((x) => x.id === id);
    if (item) item.color = hex;
    if (this.api && this._ready && hex.startsWith('#') && hex.length === 7) {
      const [r, g, b] = hex2rgb(hex);
      this.suppressEvents = true;
      try {
        for (const lbl of obj.ggbLabels) this.api.setColor(lbl, r, g, b);
        if (obj.ggbLabels[0]) {
          const snap = this.readSnap(obj.ggbLabels[0]);
          this.ggbSig.set(obj.id, { sig: snap.sig, mathSig: snap.mathSig });
        }
      } finally {
        this.suppressEvents = false;
      }
    }
    this.emitChange(false);
  }

  setWindow(win: GraphWindow): void {
    if (!Number.isFinite(win.xmin) || !Number.isFinite(win.xmax) || !Number.isFinite(win.ymin) || !Number.isFinite(win.ymax)) return;
    if (win.xmin >= win.xmax || win.ymin >= win.ymax) return;
    this.lastWindow = { ...win };
    if (!this.api || !this._ready) return;
    this.suppressEvents = true;
    try {
      if (this._mode === '3d') {
        const zmin = Number.isFinite(win.zmin) ? win.zmin! : -5;
        const zmax = Number.isFinite(win.zmax) ? win.zmax! : 5;
        this.api.setCoordSystem(win.xmin, win.xmax, win.ymin, win.ymax, zmin, zmax, false);
      } else {
        this.api.setCoordSystem(win.xmin, win.xmax, win.ymin, win.ymax);
      }
    } catch { /* ignore */ } finally {
      this.suppressEvents = false;
    }
  }

  getWindow(): GraphWindow {
    if (!this.api || !this._ready || this._mode === '3d') return { ...this.lastWindow };
    try {
      const xml = this.api.getXML();
      const evMatch = /<euclidianView>([\s\S]*?)<\/euclidianView>/.exec(xml);
      if (evMatch) {
        const ev = evMatch[1];
        const sizeM = /<size\b[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/.exec(ev);
        const csM = /<coordSystem\b[^>]*xZero="([-+\d.eE]+)"[^>]*yZero="([-+\d.eE]+)"[^>]*scale="([-+\d.eE]+)"[^>]*yscale="([-+\d.eE]+)"/.exec(ev);
        if (sizeM && csM) {
          const w = Number(sizeM[1]), h = Number(sizeM[2]);
          const xz = Number(csM[1]), yz = Number(csM[2]);
          const xs = Number(csM[3]), ys = Number(csM[4]);
          if (xs > 0 && ys > 0 && w > 0 && h > 0) {
            const xmin = -xz / xs;
            const xmax = (w - xz) / xs;
            const ymax = yz / ys;
            const ymin = (yz - h) / ys;
            if ([xmin, xmax, ymin, ymax].every(Number.isFinite) && xmin < xmax && ymin < ymax) {
              this.lastWindow = { xmin, xmax, ymin, ymax };
            }
          }
        }
      }
    } catch { /* fall back to cached window */ }
    return { ...this.lastWindow };
  }

  setAxesAndGrid(axes: boolean, grid: boolean): void {
    this.showAxes = axes;
    this.showGrid = grid;
    this.applyAxesAndGrid();
  }

  setNativeTools(show: boolean): void {
    this.showTools = show;
    if (!this.api || !this._ready) return;
    try {
      this.api.showToolBar?.(show);
      this.api.showAlgebraInput?.(show);
      this.api.setPerspective(this._mode === '3d' ? (show ? 'AT' : 'T') : (show ? 'AG' : 'G'));
    } catch { /* ignore */ }
  }

  clear(): void {
    this.items = [];
    this.objects = [];
    this.ggbSig.clear();
    if (this.api && this._ready) {
      this.suppressEvents = true;
      try {
        this.withRepaintPaused(() => {
          this.api!.newConstruction();
          this.applyAxesAndGrid();
          this.setWindow(this.lastWindow);
        });
      } finally {
        this.suppressEvents = false;
      }
    }
    this.emitChange(false);
  }

  analyze(): GraphAnalysis {
    const win = this.getWindow();
    const objs = this.getExpressions();
    if (!this.api || !this._ready || this._mode !== '2d') {
      return { mode: this._mode, window: win, objects: objs, features: [], intersections: [] };
    }

    const scratch: string[] = [];
    const evalScratch = (cmd: string): string[] => {
      try {
        const res = this.api!.evalCommandGetLabels(cmd);
        if (!res) return [];
        const lbls = res.split(',').map((s) => s.trim()).filter(Boolean);
        for (const l of lbls) {
          scratch.push(l);
          try { this.api!.setVisible(l, false); } catch { /* ignore */ }
        }
        return lbls;
      } catch {
        return [];
      }
    };

    const readPoint = (lbl: string): Point2D | null => {
      try {
        if (this.api!.getObjectType(lbl) !== 'point' || !this.api!.isDefined(lbl)) return null;
        const x = this.api!.getXcoord(lbl);
        const y = this.api!.getYcoord(lbl);
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      } catch {
        return null;
      }
    };

    const lo = Math.max(-100, Math.floor(win.xmin - 1));
    const hi = Math.min(100, Math.ceil(win.xmax + 1));
    const features: FeatureReport[] = [];
    const intersections: IntersectionReport[] = [];

    this.suppressEvents = true;
    try {
      this.withRepaintPaused(() => {
        for (const obj of objs) {
          if (!obj.visible || obj.error || !obj.ggbLabels.length) continue;
          const lbl = obj.ggbLabels[0];
          if (obj.type !== 'function') continue;

          // Y-intercept
          let yIntercept: Point2D | null = null;
          const y0Lbl = `${SCRATCH_PREFIX}y0`;
          scratch.push(y0Lbl);
          if (evalScratch(`${y0Lbl} = ${lbl}(0)`).length && this.api!.isDefined(y0Lbl)) {
            const y0 = this.api!.getValue(y0Lbl);
            if (Number.isFinite(y0)) yIntercept = { x: 0, y: y0 };
          }
          this.deleteLabels(scratch);

          // Roots
          let rootLbls = evalScratch(`Root(${lbl})`);
          let rootPts = rootLbls.map(readPoint).filter((p): p is Point2D => p !== null);
          this.deleteLabels(scratch);
          if (!rootPts.length) {
            rootLbls = evalScratch(`Roots(${lbl}, ${lo}, ${hi})`);
            rootPts = rootLbls.map(readPoint).filter((p): p is Point2D => p !== null);
            this.deleteLabels(scratch);
          }
          const roots = dedupePoints(rootPts);

          // Extrema
          let extLbls = evalScratch(`Extremum(${lbl})`);
          let extRaw = extLbls.map(readPoint).filter((p): p is Point2D => p !== null);
          this.deleteLabels(scratch);
          if (!extRaw.length) {
            extLbls = evalScratch(`Extremum(${lbl}, ${lo}, ${hi})`);
            extRaw = extLbls.map(readPoint).filter((p): p is Point2D => p !== null);
            this.deleteLabels(scratch);
          }
          const h = Math.max(1e-3, (win.xmax - win.xmin) * 1e-4);
          const extrema: Extremum2D[] = dedupePoints(extRaw).map((pt) => {
            let kind: Extremum2D['kind'] = 'turning';
            const lLbl = `${SCRATCH_PREFIX}el`;
            const rLbl = `${SCRATCH_PREFIX}er`;
            scratch.push(lLbl, rLbl);
            evalScratch(`${lLbl} = ${lbl}(${pt.x - h})`);
            evalScratch(`${rLbl} = ${lbl}(${pt.x + h})`);
            if (this.api!.isDefined(lLbl) && this.api!.isDefined(rLbl)) {
              const yl = this.api!.getValue(lLbl);
              const yr = this.api!.getValue(rLbl);
              if (Number.isFinite(yl) && Number.isFinite(yr)) {
                if (yl < pt.y - 1e-9 && yr < pt.y - 1e-9) kind = 'max';
                else if (yl > pt.y + 1e-9 && yr > pt.y + 1e-9) kind = 'min';
              }
            }
            this.deleteLabels(scratch);
            return { ...pt, kind };
          });

          // Asymptotes
          const asymptotes: string[] = [];
          const asymLbl = `${SCRATCH_PREFIX}asym`;
          scratch.push(asymLbl);
          if (evalScratch(`${asymLbl} = Asymptote(${lbl})`).length && this.api!.isDefined(asymLbl)) {
            const vs = this.api!.getValueString(asymLbl).replace(/^[^=]*=\s*/, '').trim();
            const inner = vs.replace(/^\{|\}$/g, '').trim();
            if (inner) {
              for (const part of inner.split(',')) {
                const p = part.trim();
                if (p && !p.includes('?')) asymptotes.push(p);
              }
            }
          }
          this.deleteLabels(scratch);

          // Derivative
          let derivative: string | undefined;
          const derLbl = `${SCRATCH_PREFIX}der`;
          scratch.push(derLbl);
          if (evalScratch(`${derLbl} = Derivative(${lbl})`).length && this.api!.isDefined(derLbl)) {
            const rhs = stripEqPrefix(this.api!.getValueString(derLbl), derLbl);
            if (rhs && !rhs.includes('?')) derivative = `${lbl}'(x) = ${rhs}`;
          }
          this.deleteLabels(scratch);

          features.push({
            id: obj.id,
            ggbLabel: lbl,
            cmd: obj.cmd,
            type: obj.type,
            roots,
            yIntercept,
            extrema,
            asymptotes,
            derivative,
          });
        }

        // Pairwise intersections among the first 6 visible curves/lines/conics
        const curveKinds = new Set(['function', 'line', 'conic', 'ray', 'segment']);
        const curves = objs.filter((o) => o.visible && !o.error && o.ggbLabels.length && curveKinds.has(o.type)).slice(0, 6);
        for (let i = 0; i < curves.length; i++) {
          for (let j = i + 1; j < curves.length; j++) {
            const la = curves[i].ggbLabels[0], lb = curves[j].ggbLabels[0];
            let pts = evalScratch(`Intersect(${la}, ${lb})`).map(readPoint).filter((p): p is Point2D => p !== null);
            this.deleteLabels(scratch);
            if (!pts.length && curves[i].type === 'function' && curves[j].type === 'function') {
              pts = evalScratch(`Intersect(${la}, ${lb}, ${lo}, ${hi})`).map(readPoint).filter((p): p is Point2D => p !== null);
              this.deleteLabels(scratch);
            }
            const clean = dedupePoints(pts);
            if (clean.length) intersections.push({ a: la, b: lb, points: clean });
          }
        }
      });
    } finally {
      this.deleteLabels(scratch);
      this.suppressEvents = false;
    }

    return { mode: this._mode, window: win, objects: objs, features, intersections };
  }

  private deleteLabels(labels: string[]) {
    if (!this.api) { labels.length = 0; return; }
    while (labels.length) {
      const l = labels.pop()!;
      try { this.api.deleteObject(l); } catch { /* ignore */ }
    }
  }

  testEquation(exprOrLabel: string, opts: EquationTestOptions): EquationTestReport {
    const raw = exprOrLabel.trim();
    if (!raw) {
      return { expression: raw, passed: 0, total: 0, allPassed: false, results: [], parseError: 'Enter an equation or pick a plotted curve first.' };
    }
    if (!this.api || !this._ready) {
      return { expression: raw, passed: 0, total: 0, allPassed: false, results: [], parseError: 'GeoGebra is still loading.' };
    }

    const tol = opts.tolerance ?? 1e-3;
    const targets: { point: Point2D; kind: 'point' | 'root' | 'stationary' }[] = [
      ...(opts.points ?? []).map((point) => ({ point, kind: 'point' as const })),
      ...(opts.roots ?? []).map((x) => ({ point: { x, y: 0 }, kind: 'root' as const })),
      ...(opts.stationary ?? []).map((point) => ({ point, kind: 'stationary' as const })),
    ];
    if (!targets.length) {
      return { expression: raw, passed: 0, total: 0, allPassed: false, results: [], parseError: 'Add at least one point, root, or stationary point to check.' };
    }

    const scratch: string[] = [];
    const evalS = (cmd: string): string[] => {
      try {
        const res = this.api!.evalCommandGetLabels(cmd);
        if (!res) return [];
        const lbls = res.split(',').map((s) => s.trim()).filter(Boolean);
        for (const l of lbls) {
          scratch.push(l);
          try { this.api!.setVisible(l, false); } catch { /* ignore */ }
        }
        return lbls;
      } catch {
        return [];
      }
    };

    const results: PointCheckResult[] = [];
    let earlyReport: EquationTestReport | null = null;
    this.suppressEvents = true;
    try {
      this.withRepaintPaused(() => {
        let fnLbl = '';
        let curveLbl = '';
        let derivLbl = '';

        const allNames = this.api!.getAllObjectNames();
        if (allNames.includes(raw)) {
          const t = this.api!.getObjectType(raw);
          if (t === 'function') fnLbl = raw;
          else curveLbl = raw;
        } else {
          const norm = normalizeGGBCommand(raw);
          const eqIdx = norm.indexOf('=');
          let isExplicit = false;
          let rhsExpr = norm;

          if (eqIdx >= 0) {
            const lhs = norm.slice(0, eqIdx).trim();
            const rhs = norm.slice(eqIdx + 1).trim();
            if ((/^y$/i.test(lhs) || /^[a-zA-Z]\w*\(x\)$/.test(lhs)) && !/\by\b/i.test(rhs)) {
              isExplicit = true;
              rhsExpr = rhs;
            }
          } else if (!/\by\b/i.test(norm)) {
            isExplicit = true;
          }

          if (isExplicit) {
            const cand = `${SCRATCH_PREFIX}tf`;
            scratch.push(cand);
            if (!evalS(`${cand}(x) = ${rhsExpr}`).length || !this.api!.isDefined(cand)) {
              earlyReport = { expression: raw, passed: 0, total: targets.length, allPassed: false, results: [], parseError: 'GeoGebra could not evaluate that function of x.' };
              return;
            }
            fnLbl = cand;
          } else {
            const cand = `${SCRATCH_PREFIX}tc`;
            scratch.push(cand);
            if (!evalS(`${cand}: ${norm}`).length || !this.api!.isDefined(cand)) {
              earlyReport = { expression: raw, passed: 0, total: targets.length, allPassed: false, results: [], parseError: 'GeoGebra could not evaluate that equation.' };
              return;
            }
            curveLbl = cand;
          }
        }

        if (fnLbl && targets.some((t) => t.kind === 'stationary')) {
          const dCand = `${SCRATCH_PREFIX}td`;
          scratch.push(dCand);
          if (evalS(`${dCand} = Derivative(${fnLbl})`).length && this.api!.isDefined(dCand)) {
            derivLbl = dCand;
          }
        }

        for (const t of targets) {
          const { x, y } = t.point;
          const ptStr = `(${fmtNum(x)}, ${fmtNum(y)})`;

          if (fnLbl) {
            const yLbl = `${SCRATCH_PREFIX}vy`;
            scratch.push(yLbl);
            evalS(`${yLbl} = ${fnLbl}(${x})`);
            if (!this.api!.isDefined(yLbl)) {
              results.push({ point: t.point, kind: t.kind, pass: false, message: `Undefined at x = ${fmtNum(x)} (cannot check ${ptStr}).` });
              this.deleteLabels(scratch);
              continue;
            }
            const actualY = this.api!.getValue(yLbl);
            this.deleteLabels(scratch);

            if (!Number.isFinite(actualY)) {
              results.push({ point: t.point, kind: t.kind, pass: false, message: `Not finite at x = ${fmtNum(x)}.` });
              continue;
            }

            const err = actualY - y;
            const yOk = Math.abs(err) <= tol;

            if (t.kind === 'stationary') {
              let slope: number | undefined;
              if (derivLbl) {
                const sLbl = `${SCRATCH_PREFIX}vs`;
                scratch.push(sLbl);
                evalS(`${sLbl} = ${derivLbl}(${x})`);
                if (this.api!.isDefined(sLbl)) {
                  const sv = this.api!.getValue(sLbl);
                  if (Number.isFinite(sv)) slope = sv;
                }
                this.deleteLabels(scratch);
              }
              const slopeTol = Math.max(tol * 2, 0.02);
              const slopeOk = slope !== undefined && Math.abs(slope) <= slopeTol;
              const pass = yOk && slopeOk;
              let message = '';
              if (pass) {
                message = `Stationary point at ${ptStr} confirmed (y = ${fmtNum(actualY)}, f′ = ${fmtNum(slope ?? 0, 4)}).`;
              } else if (!yOk && slope !== undefined && !slopeOk) {
                message = `Misses ${ptStr}: gives y = ${fmtNum(actualY)} (off by ${fmtNum(err)}) and f′(${fmtNum(x)}) = ${fmtNum(slope)} ≠ 0.`;
              } else if (!yOk) {
                message = `Misses ${ptStr}: at x = ${fmtNum(x)}, your curve gives y = ${fmtNum(actualY)} instead of ${fmtNum(y)} (off by ${fmtNum(err)}).`;
              } else {
                message = `Passes through ${ptStr}, but not stationary there: f′(${fmtNum(x)}) = ${slope !== undefined ? fmtNum(slope) : '?'} ≠ 0.`;
              }
              results.push({ point: t.point, kind: t.kind, pass, actualY, derivative: slope, error: err, message });
            } else {
              const label = t.kind === 'root' ? `root at x = ${fmtNum(x)}` : ptStr;
              const message = yOk
                ? `Passes through ${label} (y = ${fmtNum(actualY)}).`
                : `Misses ${label}: at x = ${fmtNum(x)}, your curve gives y = ${fmtNum(actualY)} instead of ${fmtNum(y)} (off by ${fmtNum(err)}).`;
              results.push({ point: t.point, kind: t.kind, pass: yOk, actualY, error: err, message });
            }
          } else {
            const pLbl = `${SCRATCH_PREFIX}tp`;
            const dLbl = `${SCRATCH_PREFIX}dist`;
            scratch.push(pLbl, dLbl);
            evalS(`${pLbl} = (${x}, ${y})`);
            evalS(`${dLbl} = Distance(${pLbl}, ${curveLbl})`);
            const dist = this.api!.isDefined(dLbl) ? this.api!.getValue(dLbl) : NaN;
            this.deleteLabels(scratch);

            if (!Number.isFinite(dist)) {
              results.push({ point: t.point, kind: t.kind, pass: false, message: `Could not measure distance from ${ptStr} to the curve.` });
              continue;
            }
            const pass = dist <= tol;
            const message = t.kind === 'stationary'
              ? (pass
                ? `Lies on curve at ${ptStr} (distance ${fmtNum(dist, 4)}); rewrite explicitly y = f(x) to verify zero gradient.`
                : `Misses ${ptStr} by perpendicular distance ${fmtNum(dist, 4)}.`)
              : (pass
                ? `Passes through ${ptStr}.`
                : `Misses ${ptStr} by perpendicular distance ${fmtNum(dist, 4)}.`);
            results.push({ point: t.point, kind: t.kind, pass, error: dist, message });
          }
        }
      });
    } finally {
      this.deleteLabels(scratch);
      this.suppressEvents = false;
    }

    if (earlyReport) return earlyReport;
    const passed = results.filter((r) => r.pass).length;
    return { expression: raw, passed, total: results.length, allPassed: passed === results.length, results };
  }

  snapshot(scale = 1): string | null {
    if (!this.api || !this._ready) return null;
    try {
      const b64 = this.api.getPNGBase64(scale, false, 72);
      return b64 ? `data:image/png;base64,${b64}` : null;
    } catch {
      return null;
    }
  }

  resize(width: number, height: number): void {
    if (!this.api || !this._ready) return;
    const w = Math.max(300, Math.round(width));
    const h = Math.max(320, Math.round(height));
    if (Math.abs(w - this.lastWidth) < 2 && Math.abs(h - this.lastHeight) < 2) return;
    this.lastWidth = w;
    this.lastHeight = h;
    try {
      this.api.setSize(w, h);
    } catch { /* ignore */ }
  }

  onChange(fn: (objects: LiveObject[], external: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  destroy(): void {
    if (this.notifyTimer !== null) {
      window.clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }
    this._ready = false;
    this.ggbSig.clear();
    this.dirtyLabels.clear();
    this.pendingClear = false;
    if (this.api) {
      try { this.api.remove(); } catch { /* ignore */ }
      this.api = null;
    }
    if (this.appletId && typeof window !== 'undefined') {
      try { delete (window as unknown as Record<string, unknown>)[this.appletId]; } catch { /* ignore */ }
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
