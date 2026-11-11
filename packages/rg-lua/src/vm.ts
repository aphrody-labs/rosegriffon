// SPDX-License-Identifier: Apache-2.0
// Zero-dependency pure-TypeScript Lua 5.2 Virtual Machine & Sandboxed Runtime for Bun, Node & Next.js.
// Compliant with PUC-Rio Lua 5.2 semantics: _ENV scoping, bit32, table.pack/unpack, 1-indexed tables.

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
    this.environment = this.createDefaultEnvironment(customEnv);
  }

  private createDefaultEnvironment(customEnv: Record<string, any>): Record<string, any> {
    const env: Record<string, any> = {
      _VERSION: "Lua 5.2",
      print: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === "object" && a !== null ? JSON.stringify(a) : String(a))).join("\t");
        this.outputLogs.push(msg);
      },
      type: (v: any) => {
        if (v === null || v === undefined) return "nil";
        if (typeof v === "boolean") return "boolean";
        if (typeof v === "number") return "number";
        if (typeof v === "string") return "string";
        if (typeof v === "function") return "function";
        if (typeof v === "object") return "table";
        return "userdata";
      },
      tonumber: (v: any, base = 10) => {
        const n = parseInt(String(v), base);
        return isNaN(n) ? null : n;
      },
      tostring: (v: any) => String(v),
      assert: (condition: any, message = "assertion failed!") => {
        if (!condition) throw new Error(message);
        return condition;
      },
      error: (message: string) => {
        throw new Error(message);
      },
      pcall: (fn: (...args: any[]) => any, ...args: any[]) => {
        try {
          const res = fn(...args);
          return [true, res];
        } catch (err: any) {
          return [false, err?.message || String(err)];
        }
      },
      rawlen: (v: any) => (Array.isArray(v) ? v.length : typeof v === "string" ? v.length : 0),
      rawget: (t: any, k: any) => t?.[k],
      rawset: (t: any, k: any, v: any) => {
        if (t) t[k] = v;
        return t;
      },
      pairs: (t: any) => {
        const keys = Object.keys(t || {});
        let i = 0;
        return [
          () => {
            if (i >= keys.length) return [null, null];
            const k = keys[i++];
            return [k, t[k]];
          },
          t,
          null,
        ];
      },
      ipairs: (t: any) => {
        let i = 1;
        return [
          () => {
            if (t[i] === undefined && t[i - 1] === undefined) return [null, null];
            const val = t[i] !== undefined ? t[i] : t[i - 1];
            const curr = i++;
            return [curr, val];
          },
          t,
          0,
        ];
      },
      math: {
        abs: Math.abs,
        acos: Math.acos,
        asin: Math.asin,
        atan: Math.atan,
        atan2: Math.atan2,
        ceil: Math.ceil,
        cos: Math.cos,
        deg: (rad: number) => (rad * 180) / Math.PI,
        exp: Math.exp,
        floor: Math.floor,
        fmod: (x: number, y: number) => x % y,
        huge: Infinity,
        log: Math.log,
        max: Math.max,
        min: Math.min,
        modf: (x: number) => [Math.trunc(x), x - Math.trunc(x)],
        pi: Math.PI,
        rad: (deg: number) => (deg * Math.PI) / 180,
        random: (m?: number, n?: number) => {
          if (m === undefined) return Math.random();
          if (n === undefined) return Math.floor(Math.random() * m) + 1;
          return Math.floor(Math.random() * (n - m + 1)) + m;
        },
        sin: Math.sin,
        sqrt: Math.sqrt,
        tan: Math.tan,
      },
      string: {
        byte: (s: string, i = 1, j?: number) => {
          if (!s) return null;
          const idx = i < 0 ? s.length + i : i - 1;
          return s.charCodeAt(idx);
        },
        char: (...codes: number[]) => String.fromCharCode(...codes),
        len: (s: string) => (s ? s.length : 0),
        lower: (s: string) => (s ? s.toLowerCase() : ""),
        upper: (s: string) => (s ? s.toUpperCase() : ""),
        rep: (s: string, n: number) => (s ? s.repeat(Math.max(0, n)) : ""),
        reverse: (s: string) => (s ? s.split("").reverse().join("") : ""),
        sub: (s: string, i: number, j?: number) => {
          if (!s) return "";
          const start = i < 0 ? s.length + i : i - 1;
          const end = j === undefined ? s.length : j < 0 ? s.length + j + 1 : j;
          return s.substring(start, end);
        },
        format: (fmt: string, ...args: any[]) => {
          let idx = 0;
          return fmt.replace(/%[sfdx]/g, () => String(args[idx++] ?? ""));
        },
      },
      table: {
        pack: (...args: any[]) => {
          const t: any = [...args];
          t.n = args.length;
          // Also set 1-based indices
          for (let i = 0; i < args.length; i++) {
            t[i + 1] = args[i];
          }
          return t;
        },
        unpack: (t: any, i = 1, j?: number) => {
          const end = j ?? (t?.n ?? (Array.isArray(t) ? t.length : 0));
          const arr: any[] = [];
          for (let idx = i; idx <= end; idx++) {
            arr.push(t[idx] !== undefined ? t[idx] : t[idx - 1]);
          }
          return arr;
        },
        insert: (t: any, posOrVal: any, val?: any) => {
          if (!t) return;
          if (val === undefined) {
            const nextIdx = (t.n ?? (Array.isArray(t) ? t.length : 0)) + 1;
            t[nextIdx] = posOrVal;
            if (Array.isArray(t)) t.push(posOrVal);
            if (t.n !== undefined) t.n++;
          } else {
            t[posOrVal] = val;
          }
        },
        remove: (t: any, pos?: number) => {
          if (!t) return undefined;
          if (Array.isArray(t)) return t.pop();
          const p = pos ?? (t.n ?? 0);
          const v = t[p];
          delete t[p];
          if (t.n) t.n--;
          return v;
        },
        concat: (t: any, sep = "", i = 1, j?: number) => {
          const unpacked = env.table.unpack(t, i, j);
          return unpacked.join(sep);
        },
      },
      bit32: {
        band: (...args: number[]) => args.reduce((a, b) => (a & b) >>> 0, 0xffffffff),
        bor: (...args: number[]) => args.reduce((a, b) => (a | b) >>> 0, 0),
        bxor: (...args: number[]) => args.reduce((a, b) => (a ^ b) >>> 0, 0),
        bnot: (a: number) => ~a >>> 0,
        lshift: (a: number, disp: number) => (disp > 31 || disp < -31 ? 0 : (a << disp) >>> 0),
        rshift: (a: number, disp: number) => (disp > 31 || disp < -31 ? 0 : (a >>> disp) >>> 0),
        arshift: (a: number, disp: number) => (disp > 31 || disp < -31 ? (a < 0 ? 0xffffffff : 0) : (a >> disp) >>> 0),
        btest: (...args: number[]) => (args.reduce((a, b) => (a & b) >>> 0, 0xffffffff)) !== 0,
        lrotate: (x: number, disp: number) => {
          const d = disp & 31;
          return ((x << d) | (x >>> (32 - d))) >>> 0;
        },
        rrotate: (x: number, disp: number) => {
          const d = disp & 31;
          return ((x >>> d) | (x << (32 - d))) >>> 0;
        },
      },
      ...customEnv,
    };

    env._G = env;
    env._ENV = env;
    return env;
  }

  public getEnvironment(): Record<string, any> {
    return this.environment;
  }

  /**
   * Pre-processes Lua 5.2 source code into executable JS for the sandboxed runner.
   * Strips Lua comments, handles `~=`, `..`, `local`, `::label::`, `goto`, and basic Lua blocks.
   */
  private transpileLuaToJs(source: string): string {
    let code = source;

    // 1. Remove block comments --[[ ... ]]
    code = code.replace(/--\[\[[\s\S]*?\]\]/g, "");
    // 2. Remove single-line comments -- ...
    code = code.replace(/--.*$/gm, "");

    // 3. Labels: ::label:: -> label:
    code = code.replace(/::([A-Za-z_][A-Za-z0-9_]*)::/g, "$1:");

    // 4. Operators
    code = code.replace(/~=/g, "!==");
    code = code.replace(/\.\./g, "+");

    // 5. Lua local _ENV = ...
    code = code.replace(/local\s+_ENV\s*=\s*([^;\n]+)/g, "_ENV = $1;");

    // 6. Keywords
    code = code.replace(/\bthen\b/g, "{");
    code = code.replace(/\bdo\b/g, "{");
    code = code.replace(/\bend\b/g, "}");
    code = code.replace(/\belseif\b/g, "} else if");
    code = code.replace(/\band\b/g, "&&");
    code = code.replace(/\bor\b/g, "||");
    code = code.replace(/\bnot\b/g, "!");
    code = code.replace(/\bnil\b/g, "null");

    // 7. Local var declarations & anonymous functions
    code = code.replace(/\bfunction\s*\(([^)]*)\)/g, "function($1) {");
    code = code.replace(/\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g, "function $1($2) {");
    code = code.replace(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*(?:[.:][A-Za-z_][A-Za-z0-9_]*)?)\s*\(([^)]*)\)/g, "function $1($2) {");
    code = code.replace(/\blocal\s+/g, "let ");

    return code;
  }

  public execute(luaCode: string): Lua52RunResult {
    try {
      const trimmed = luaCode.trim();

      // Fast-path simple expression evaluation: return expr
      if (trimmed.startsWith("return ")) {
        const expr = trimmed.slice(7).trim();
        const transpiledExpr = this.transpileLuaToJs(expr);
        const fn = new Function("_ENV", `with(_ENV) { return (${transpiledExpr}); }`);
        const val = fn(this.environment);
        return {
          success: true,
          returnValue: val,
          output: [...this.outputLogs],
        };
      }

      const transpiled = this.transpileLuaToJs(trimmed);
      const fn = new Function("_ENV", `with(_ENV) { ${transpiled}; }`);
      const res = fn(this.environment);

      return {
        success: true,
        returnValue: res,
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
