import type {
  ExecOptions,
  ExecResult,
  ExtensionAPI,
  ExtensionContext,
  RegisteredCommand,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";

/**
 * A strict, typed test double for Pi's `ExtensionAPI`.
 *
 * We drive the extension against pi's *public* API rather than a third-party runtime harness
 * (see docs/SPEC.md §7.2). Two properties make this more than a bag of spies:
 *
 * 1. **It is strict.** Reading any member we have not deliberately modelled throws, naming the
 *    member. Without this, a fake that stubs everything as a no-op lets the extension call
 *    anything and still "pass" — the tests quietly stop testing. Adding a member here should be
 *    a conscious act that comes with an assertion about how it behaves.
 * 2. **It validates registrations.** `registerTool` enforces pi's real `ToolDefinition` contract,
 *    so a tool pi would reject at load time fails in tests instead of at runtime.
 *
 * `MODELLED` is the whole surface this double implements. Everything else throws.
 */
export const MODELLED = ["on", "registerTool", "registerCommand", "exec"] as const;

export type CapturedCommand = Omit<RegisteredCommand, "name" | "sourceInfo">;
export type CapturedHandler = (event: unknown, ctx: ExtensionContext) => unknown;

export interface ExecCall {
  command: string;
  args: string[];
  options?: ExecOptions;
}

export interface FakePi {
  api: ExtensionAPI;
  tools: Map<string, ToolDefinition>;
  commands: Map<string, CapturedCommand>;
  handlers: Map<string, CapturedHandler[]>;
  /** `ExtensionAPI` members the subject touched, in order. */
  touched: string[];
  execCalls: ExecCall[];
  /** Queue the result of the next `pi.exec` call. */
  stubExec(result: Partial<ExecResult>): void;
  /** Invoke every handler registered for an event, the way pi dispatches. */
  emit(event: string, payload: unknown): Promise<unknown[]>;
}

const DEFAULT_EXEC: ExecResult = { stdout: "", stderr: "", code: 0, killed: false };

/**
 * Wrap `impl` so that reading anything it does not define throws instead of yielding
 * `undefined`. Property reads are appended to `log` when supplied.
 */
function strict<T extends object>(label: string, impl: T, log?: string[]): T {
  return new Proxy(impl, {
    get(target, prop, receiver) {
      // Test runners and `await` probe these; answering honestly avoids spurious failures.
      if (typeof prop !== "string" || prop === "then" || prop === "constructor") {
        return Reflect.get(target, prop, receiver);
      }
      if (!(prop in target)) {
        throw new Error(
          `${label}: touched unmodelled member \`${prop}\`. Model it in ` +
            "tests/support/fake-pi.ts and assert how it should behave under test.",
        );
      }
      log?.push(prop);
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function createFakePi(): FakePi {
  const tools = new Map<string, ToolDefinition>();
  const commands = new Map<string, CapturedCommand>();
  const handlers = new Map<string, CapturedHandler[]>();
  const touched: string[] = [];
  const execCalls: ExecCall[] = [];
  const execResults: ExecResult[] = [];

  function registerTool(tool: ToolDefinition): void {
    for (const field of ["name", "label", "description"] as const) {
      const value = tool?.[field];
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`registerTool: \`${field}\` must be a non-empty string`);
      }
    }
    if (typeof tool.parameters !== "object" || tool.parameters === null) {
      throw new Error(`registerTool(${tool.name}): \`parameters\` must be a TypeBox schema`);
    }
    if (typeof tool.execute !== "function") {
      throw new Error(`registerTool(${tool.name}): \`execute\` must be a function`);
    }
    if (tools.has(tool.name)) {
      throw new Error(`registerTool(${tool.name}): already registered — pi would collide`);
    }
    tools.set(tool.name, tool);
  }

  const impl = {
    on(event: string, handler: CapturedHandler): void {
      const existing = handlers.get(event) ?? [];
      existing.push(handler);
      handlers.set(event, existing);
    },
    registerTool,
    registerCommand(name: string, options: CapturedCommand): void {
      if (commands.has(name)) {
        throw new Error(`registerCommand(${name}): already registered — pi would collide`);
      }
      commands.set(name, options);
    },
    async exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult> {
      execCalls.push({ command, args, options });
      return execResults.shift() ?? DEFAULT_EXEC;
    },
  };

  return {
    api: strict("ExtensionAPI", impl, touched) as unknown as ExtensionAPI,
    tools,
    commands,
    handlers,
    touched,
    execCalls,
    stubExec(result) {
      execResults.push({ ...DEFAULT_EXEC, ...result });
    },
    async emit(event, payload) {
      const registered = handlers.get(event) ?? [];
      if (registered.length === 0) {
        throw new Error(`emit("${event}"): nothing subscribed to that event`);
      }
      const ctx = strict("ExtensionContext", {}) as unknown as ExtensionContext;
      const results: unknown[] = [];
      for (const handler of registered) {
        results.push(await handler(payload, ctx));
      }
      return results;
    },
  };
}
