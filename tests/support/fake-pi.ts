import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * A minimal, typed test double for Pi's `ExtensionAPI`.
 *
 * We test the extension against pi's *public* surface rather than a third-party
 * runtime harness: this tracks the latest pi types (typecheck catches drift) and
 * avoids coupling to pi internals. `createFakePi()` captures everything the
 * extension registers so tests can assert registrations and invoke the captured
 * tools / event handlers directly with synthetic events.
 */
export interface CapturedTool {
  name: string;
  execute: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface FakePi {
  api: ExtensionAPI;
  tools: Map<string, CapturedTool>;
  commands: Map<string, unknown>;
  handlers: Map<string, unknown[]>;
}

export function createFakePi(): FakePi {
  const tools = new Map<string, CapturedTool>();
  const commands = new Map<string, unknown>();
  const handlers = new Map<string, unknown[]>();

  const on = ((event: string, handler: unknown) => {
    const existing = handlers.get(event) ?? [];
    existing.push(handler);
    handlers.set(event, existing);
  }) as ExtensionAPI["on"];

  const registerTool = ((tool: CapturedTool) => {
    tools.set(tool.name, tool);
  }) as unknown as ExtensionAPI["registerTool"];

  const registerCommand = ((name: string, options: unknown) => {
    commands.set(name, options);
  }) as ExtensionAPI["registerCommand"];

  const noop = (() => undefined) as unknown;

  const api = {
    on,
    registerTool,
    registerCommand,
    registerShortcut: noop,
    registerFlag: noop,
    getFlag: noop,
    registerMessageRenderer: noop,
    registerEntryRenderer: noop,
    sendMessage: noop,
  } as unknown as ExtensionAPI;

  return { api, tools, commands, handlers };
}
