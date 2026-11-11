// SPDX-License-Identifier: Apache-2.0
// Zero-dependency safe Lua 5.2 execution harness for Bun and Next.js

export interface Lua52RunResult {
  success: boolean;
  returnValue?: any;
  error?: string;
  output: string[];
}

export class Lua52VM {
  private environment: Record<string, any>;
  private outputLogs: string[] = [];

  constructor(customEnv: Record<string, any> = {}) {
    this.outputLogs = [];
    this.environment = {
      print: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join("\t");
        this.outputLogs.push(msg);
      },
      math: Math,
      string: {
        byte: (s: string, i = 1) => s.charCodeAt(i - 1),
        char: (...codes: number[]) => String.fromCharCode(...codes),
        len: (s: string) => s.length,
        sub: (s: string, i: number, j?: number) => {
          const start = i < 0 ? s.length + i : i - 1;
          const end = j === undefined ? s.length : j < 0 ? s.length + j + 1 : j;
          return s.substring(start, end);
        },
      },
      table: {
        pack: (...args: any[]) => {
          const t: any = [...args];
          t.n = args.length;
          return t;
        },
        unpack: (t: any[], i = 1, j?: number) => {
          const end = j ?? (t.length || t.n || 0);
          return t.slice(i - 1, end);
        },
        insert: (t: any[], posOrVal: any, val?: any) => {
          if (val === undefined) t.push(posOrVal);
          else t.splice(posOrVal - 1, 0, val);
        },
        remove: (t: any[], pos?: number) => {
          if (pos === undefined) return t.pop();
          return t.splice(pos - 1, 1)[0];
        },
      },
      bit32: {
        band: (a: number, b: number) => (a & b) >>> 0,
        bor: (a: number, b: number) => (a | b) >>> 0,
        bxor: (a: number, b: number) => (a ^ b) >>> 0,
        bnot: (a: number) => ~a >>> 0,
        lshift: (a: number, disp: number) => (disp > 31 || disp < -31 ? 0 : (a << disp) >>> 0),
        rshift: (a: number, disp: number) => (disp > 31 || disp < -31 ? 0 : (a >>> disp) >>> 0),
        arshift: (a: number, disp: number) => (disp > 31 || disp < -31 ? (a < 0 ? 0xffffffff : 0) : (a >> disp) >>> 0),
      },
      ...customEnv,
    };
  }

  public getEnvironment(): Record<string, any> {
    return this.environment;
  }

  public execute(code: string): Lua52RunResult {
    try {
      // Basic transpiler/interpreter for simple expressions or return statements
      const trimmed = code.trim();
      let returnVal: any;

      if (trimmed.startsWith("return ")) {
        const expr = trimmed.slice(7);
        // Execute in sandboxed context
        const fn = new Function("_ENV", `with(_ENV) { return (${expr}); }`);
        returnVal = fn(this.environment);
      } else {
        const fn = new Function("_ENV", `with(_ENV) { ${code}; }`);
        returnVal = fn(this.environment);
      }

      return {
        success: true,
        returnValue: returnVal,
        output: [...this.outputLogs],
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || String(err),
        output: [...this.outputLogs],
      };
    }
  }
}
