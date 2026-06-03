// WUX — a modern, native "React Native Windows" core on Bun.
//
// JSX renders to REAL WinUI 3 controls (not a WebView), via the out-of-process
// XAML host (xaml.ts / Winclean.XamlHost). The JS runs in Bun (no Hermes),
// bundling is Bun-native (no Metro), and the bridge is JSON-stdio (no C++).
//
// Usage (classic JSX pragma so tag constants resolve to WinUI element names):
//   /** @jsx h */
//   /** @jsxFrag Fragment */
//   import { h, Fragment, createRoot, signal, StackPanel, TextBlock, Button } from "winclean-framework/wux";
//   const count = signal(0);
//   const App = () => (
//     <StackPanel padding="32" spacing="16">
//       <TextBlock fontSize="48">{String(count.value)}</TextBlock>
//       <Button onClick={() => count.value++}>+1</Button>
//     </StackPanel>
//   );
//   await createRoot().mount(() => <App/>, { title: "App", width: 480, height: 320 });
//
// NB: re-render currently re-serializes the whole subtree to XAML (no diffing).
// True per-node reconciliation would need retained element ops on the host;
// this PoC proves the JSX→native-WinUI + reactive-state model.

import { XamlApp, type XamlEvent } from "./xaml";

// WinUI control tags as string constants, so Capitalized JSX tags resolve.
export const StackPanel = "StackPanel";
export const Grid = "Grid";
export const Border = "Border";
export const ScrollViewer = "ScrollViewer";
export const TextBlock = "TextBlock";
export const Button = "Button";
export const TextBox = "TextBox";
export const ToggleSwitch = "ToggleSwitch";
export const CheckBox = "CheckBox";
export const ProgressBar = "ProgressBar";
export const Fragment = "#fragment";

export type Props = Record<string, unknown> & { children?: unknown };
export interface VNode {
  type: string | ((props: Props) => unknown);
  props: Props;
}

export function h(type: VNode["type"], props: Props | null, ...children: unknown[]): VNode {
  return { type, props: { ...props, children: children.flat(Infinity) } };
}

const escapeXml = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pascal = (k: string): string => k.charAt(0).toUpperCase() + k.slice(1);

function serialize(node: unknown, nextName: () => string, handlers: Map<string, () => void>): string {
  if (node == null || node === false || node === true) {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return escapeXml(String(node));
  }
  if (Array.isArray(node)) {
    return node.map((n) => serialize(n, nextName, handlers)).join("");
  }

  const vnode = node as VNode;
  if (typeof vnode.type === "function") {
    return serialize(vnode.type(vnode.props), nextName, handlers);
  }
  const { children, ...props } = vnode.props;
  if (vnode.type === Fragment) {
    return serialize(children, nextName, handlers);
  }

  const tag = vnode.type;
  let attrs = "";
  let name: string | undefined;
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) {
      continue;
    }
    if (key === "onClick" && typeof value === "function") {
      name ??= nextName();
      handlers.set(name, value as () => void);
      continue;
    }
    if (key === "name") {
      name = String(value);
      continue;
    }
    attrs += ` ${pascal(key)}="${escapeXml(String(value))}"`;
  }
  if (name) {
    attrs += ` x:Name="${name}"`;
  }
  return `<${tag}${attrs}>${serialize(children, nextName, handlers)}</${tag}>`;
}

let active: WuxRoot | undefined;

const XMLNS =
  'xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" ' +
  'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"';

export class WuxRoot {
  readonly #app: XamlApp;
  #render?: () => unknown;
  #ready = false;
  readonly #handlers = new Map<string, () => void>();

  constructor() {
    this.#app = new XamlApp();
  }

  get app(): XamlApp {
    return this.#app;
  }

  get pid(): number {
    return this.#app.pid;
  }

  async mount(
    render: () => unknown,
    opts?: { title?: string; width?: number; height?: number },
  ): Promise<void> {
    this.#render = render;
    // Module-level "current root" registry (like React's current dispatcher) so
    // signal() can trigger re-render without each signal holding a root ref.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    active = this;
    // First mount only: boot the host + window and wire events once. On a
    // `bun --hot` reload the root is reused from globalThis (see createRoot),
    // so we skip re-booting and just re-paint with the new render() — the
    // window/host persist → Fast-Refresh-like live UI.
    if (!this.#ready) {
      await this.#app.ready();
      if (opts?.title) {
        await this.#app.setTitle(opts.title);
      }
      if (opts?.width && opts?.height) {
        await this.#app.resize(opts.width, opts.height);
      }
      this.#app.on("click", (e: XamlEvent) => this.#handlers.get(e.name)?.());
      this.#ready = true;
    }
    await this.#paint();
  }

  rerender(): void {
    void this.#paint();
  }

  async #paint(): Promise<void> {
    if (!this.#render) {
      return;
    }
    this.#handlers.clear();
    let id = 0;
    const inner = serialize(this.#render(), () => `wux${id++}`, this.#handlers);
    await this.#app.setContent(`<Grid ${XMLNS} Background="#FF1B1B1F">${inner}</Grid>`);
  }
}

// Under `bun --hot`, globalThis persists across reloads, so we reuse the same
// root (and its already-spawned host window) — editing the .tsx live re-renders
// into the existing window instead of opening a new one. A global-registry
// Symbol survives both reloads and realm boundaries without polluting names.
const ROOT_KEY = Symbol.for("winclean.wux.root");
const registry = globalThis as unknown as { [ROOT_KEY]?: WuxRoot };

export function createRoot(): WuxRoot {
  return (registry[ROOT_KEY] ??= new WuxRoot());
}

// Minimal reactive cell: setting .value re-renders the active root.
export function signal<T>(initial: T): { value: T } {
  let val = initial;
  return {
    get value() {
      return val;
    },
    set value(next: T) {
      val = next;
      active?.rerender();
    },
  };
}
