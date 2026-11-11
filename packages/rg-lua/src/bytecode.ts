// SPDX-License-Identifier: Apache-2.0
// Pure-TypeScript PUC-Rio Lua 5.2.4 Bytecode Parser, REA Disassembler & Cross-Bitness Transcoder.
// Conforms strictly to Lua 5.2.4 lundump.c and Level-5 Inazuma Eleven .lua.bin specs.

export const LUA_SIGNATURE = new Uint8Array([0x1b, 0x4c, 0x75, 0x61]); // "\x1bLua"
export const LUAC_VERSION_52 = 0x52;
export const LUAC_TAIL_52 = new Uint8Array([0x19, 0x93, 0x0d, 0x0a, 0x1a, 0x0a]);

export const LUA_52_OPCODES = [
  "MOVE", "LOADK", "LOADKX", "LOADBOOL", "LOADNIL", "GETUPVAL", "GETTABUP", "GETTABLE",
  "SETTABUP", "SETUPVAL", "SETTABLE", "NEWTABLE", "SELF", "ADD", "SUB", "MUL", "DIV",
  "MOD", "POW", "UNM", "NOT", "LEN", "CONCAT", "JMP", "EQ", "LT", "LE", "TEST", "TESTSET",
  "CALL", "TAILCALL", "RETURN", "FORLOOP", "FORPREP", "TFORCALL", "TFORLOOP", "SETLIST",
  "CLOSURE", "VARARG", "EXTRAARG",
] as const;

export type Lua52Opcode = typeof LUA_52_OPCODES[number];

export interface LuaBytecodeHeader {
  version: string;
  isOfficialFormat: boolean;
  isLittleEndian: boolean;
  sizeInt: number;
  sizeSizeT: number;
  sizeInstruction: number;
  sizeLuaNumber: number;
  isIntegralNumber: boolean;
}

export interface LuaDisassembledInstruction {
  pc: number;
  raw: number;
  opcode: Lua52Opcode;
  a: number;
  b?: number;
  c?: number;
  bx?: number;
  sbx?: number;
  ax?: number;
  formatted: string;
}

export interface LuaLocalVar {
  name: string;
  startPc: number;
  endPc: number;
}

export interface LuaUpvalueDesc {
  inStack: boolean;
  index: number;
  name?: string;
}

export interface LuaPrototypeAudit {
  source: string;
  lineDefined: number;
  lastLineDefined: number;
  numParams: number;
  isVararg: boolean;
  maxStackSize: number;
  instructionCount: number;
  instructions: LuaDisassembledInstruction[];
  rawCode: number[];
  constants: string[];
  upvaluesCount: number;
  upvalues: LuaUpvalueDesc[];
  locals: LuaLocalVar[];
  lineInfo: number[];
  subPrototypesCount: number;
  subPrototypes: LuaPrototypeAudit[];
}

export interface LuaGlobalAccess {
  pc: number;
  kind: "read" | "write";
  symbol: string;
  protoPath: string;
}

export interface Lua52BytecodeAudit {
  header: LuaBytecodeHeader;
  totalInstructions: number;
  totalPrototypes: number;
  globalAccesses: LuaGlobalAccess[];
  mainPrototype: LuaPrototypeAudit;
}

export function isLua52Bytecode(bytes: Uint8Array): boolean {
  if (bytes.length < 18) return false;
  return (
    bytes[0] === 0x1b &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x75 &&
    bytes[3] === 0x61 &&
    bytes[4] === 0x52
  );
}

class ByteReader {
  private offset = 0;
  private view: DataView;
  private littleEndian = true;

  constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  get pos(): number {
    return this.offset;
  }

  set pos(p: number) {
    this.offset = p;
  }

  setLittleEndian(le: boolean) {
    this.littleEndian = le;
  }

  readByte(): number {
    if (this.offset >= this.buffer.length) throw new Error("Unexpected EOF reading byte");
    return this.buffer[this.offset++];
  }

  readBytes(count: number): Uint8Array {
    if (this.offset + count > this.buffer.length) throw new Error("Unexpected EOF reading bytes");
    const slice = this.buffer.subarray(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  }

  readInt(size: number): number {
    if (size === 4) {
      const v = this.view.getInt32(this.offset, this.littleEndian);
      this.offset += 4;
      return v;
    } else if (size === 8) {
      const v = Number(this.view.getBigInt64(this.offset, this.littleEndian));
      this.offset += 8;
      return v;
    }
    throw new Error(`Unsupported int size: ${size}`);
  }

  readSizeT(size: number): number {
    if (size === 4) {
      const v = this.view.getUint32(this.offset, this.littleEndian);
      this.offset += 4;
      return v;
    } else if (size === 8) {
      const v = Number(this.view.getBigUint64(this.offset, this.littleEndian));
      this.offset += 8;
      return v;
    }
    throw new Error(`Unsupported size_t size: ${size}`);
  }

  readUint32(): number {
    const v = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return v;
  }

  readFloat64(): number {
    const v = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return v;
  }

  readLuaString(sizeSizeT: number): string {
    const len = this.readSizeT(sizeSizeT);
    if (len === 0) return "";
    const raw = this.readBytes(len);
    // Remove trailing NUL byte if present
    const end = raw.length > 0 && raw[raw.length - 1] === 0 ? raw.length - 1 : raw.length;
    return new TextDecoder("utf-8", { fatal: false }).decode(raw.subarray(0, end));
  }
}

export function decodeLua52Instruction(pc: number, raw: number): LuaDisassembledInstruction {
  const opcodeNum = raw & 0x3f;
  const opcode: Lua52Opcode = LUA_52_OPCODES[opcodeNum] || (`OP_${opcodeNum}` as any);
  const a = (raw >>> 6) & 0xff;
  const c = (raw >>> 14) & 0x1ff;
  const b = (raw >>> 23) & 0x1ff;
  const bx = (raw >>> 14) & 0x3ffff;
  const sbx = bx - 131071;
  const ax = (raw >>> 6) & 0x3ffffff;

  let formatted = "";

  switch (opcode) {
    case "MOVE":
      formatted = `R[${a}] = R[${b}]`;
      break;
    case "LOADK":
      formatted = `R[${a}] = K[${bx}]`;
      break;
    case "LOADKX":
      formatted = `R[${a}] = K[extra]`;
      break;
    case "LOADBOOL":
      formatted = `R[${a}] = ${b !== 0}${c !== 0 ? " (pc++)" : ""}`;
      break;
    case "LOADNIL":
      formatted = `R[${a}..${a + b}] = nil`;
      break;
    case "GETUPVAL":
      formatted = `R[${a}] = Upvalue[${b}]`;
      break;
    case "GETTABUP":
      formatted = `R[${a}] = Upvalue[${b}][${c & 256 ? `K[${c & 255}]` : `R[${c}]`}]`;
      break;
    case "GETTABLE":
      formatted = `R[${a}] = R[${b}][${c & 256 ? `K[${c & 255}]` : `R[${c}]`}]`;
      break;
    case "SETTABUP":
      formatted = `Upvalue[${a}][${b & 256 ? `K[${b & 255}]` : `R[${b}]`}] = ${c & 256 ? `K[${c & 255}]` : `R[${c}]`}`;
      break;
    case "SETUPVAL":
      formatted = `Upvalue[${b}] = R[${a}]`;
      break;
    case "SETTABLE":
      formatted = `R[${a}][${b & 256 ? `K[${b & 255}]` : `R[${b}]`}] = ${c & 256 ? `K[${c & 255}]` : `R[${c}]`}`;
      break;
    case "NEWTABLE":
      formatted = `R[${a}] = {} (array: ${b}, hash: ${c})`;
      break;
    case "CALL":
      formatted = `R[${a}](...) (args: ${b > 0 ? b - 1 : "var"}, rets: ${c > 0 ? c - 1 : "var"})`;
      break;
    case "RETURN":
      formatted = `return R[${a}..${a + Math.max(0, b - 2)}]`;
      break;
    case "JMP":
      formatted = `jump ${sbx >= 0 ? "+" : ""}${sbx} -> PC ${pc + 1 + sbx}`;
      break;
    case "CLOSURE":
      formatted = `R[${a}] = closure(Proto[${bx}])`;
      break;
    default:
      formatted = `A=${a} B=${b} C=${c} Bx=${bx}`;
      break;
  }

  return {
    pc,
    raw,
    opcode,
    a,
    b,
    c,
    bx,
    sbx,
    ax,
    formatted,
  };
}

export function auditLua52Bytecode(bytes: Uint8Array): Lua52BytecodeAudit {
  if (!isLua52Bytecode(bytes)) {
    throw new Error("Invalid Lua 5.2 bytecode signature or version");
  }

  const reader = new ByteReader(bytes);
  reader.pos = 4; // skip \x1bLua

  const versionByte = reader.readByte();
  const formatByte = reader.readByte();
  const endianByte = reader.readByte();
  const sizeInt = reader.readByte();
  const sizeSizeT = reader.readByte();
  const sizeInstruction = reader.readByte();
  const sizeLuaNumber = reader.readByte();
  const integralFlag = reader.readByte();

  const isLittleEndian = endianByte === 1;
  reader.setLittleEndian(isLittleEndian);

  // Read LUAC_TAIL (6 bytes)
  const tail = reader.readBytes(6);
  let isOfficial = formatByte === 0;
  for (let i = 0; i < 6; i++) {
    if (tail[i] !== LUAC_TAIL_52[i]) {
      isOfficial = false;
      break;
    }
  }

  const header: LuaBytecodeHeader = {
    version: versionByte === 0x52 ? "5.2" : `0x${versionByte.toString(16)}`,
    isOfficialFormat: isOfficial,
    isLittleEndian,
    sizeInt,
    sizeSizeT,
    sizeInstruction,
    sizeLuaNumber,
    isIntegralNumber: integralFlag !== 0,
  };

  let totalInstructions = 0;
  let totalPrototypes = 0;
  const globalAccesses: LuaGlobalAccess[] = [];

  function parsePrototype(protoPath: string): LuaPrototypeAudit {
    totalPrototypes++;
    const lineDefined = reader.readInt(sizeInt);
    const lastLineDefined = reader.readInt(sizeInt);
    const numParams = reader.readByte();
    const isVararg = reader.readByte() !== 0;
    const maxStackSize = reader.readByte();

    // Code
    const codeLen = reader.readInt(sizeInt);
    totalInstructions += codeLen;
    const instructions: LuaDisassembledInstruction[] = [];
    const rawCode: number[] = [];

    for (let pc = 0; pc < codeLen; pc++) {
      const raw = reader.readUint32();
      rawCode.push(raw);
      instructions.push(decodeLua52Instruction(pc, raw));
    }

    // Constants
    const constantsLen = reader.readInt(sizeInt);
    const constants: string[] = [];

    for (let k = 0; k < constantsLen; k++) {
      const tag = reader.readByte();
      switch (tag) {
        case 0: // LUA_TNIL
          constants.push("nil");
          break;
        case 1: // LUA_TBOOLEAN
          constants.push(reader.readByte() !== 0 ? "true" : "false");
          break;
        case 3: // LUA_TNUMBER
          constants.push(String(reader.readFloat64()));
          break;
        case 4: // LUA_TSTRING (short)
        case 0x14: // LUA_TLNGSTR
          constants.push(JSON.stringify(reader.readLuaString(sizeSizeT)));
          break;
        default:
          constants.push(`[unknown tag ${tag}]`);
          break;
      }
    }

    // Sub-prototypes
    const subProtoLen = reader.readInt(sizeInt);
    const subPrototypes: LuaPrototypeAudit[] = [];
    for (let p = 0; p < subProtoLen; p++) {
      subPrototypes.push(parsePrototype(`${protoPath}.${p}`));
    }

    // Upvalues
    const upvalsLen = reader.readInt(sizeInt);
    const upvalues: LuaUpvalueDesc[] = [];
    for (let u = 0; u < upvalsLen; u++) {
      const inStack = reader.readByte() !== 0;
      const index = reader.readByte();
      upvalues.push({ inStack, index });
    }

    // Debug section: source string, lineinfo, locvars, upval names
    let source = "";
    if (reader.pos < bytes.length) {
      source = reader.readLuaString(sizeSizeT);
    }

    const lineInfo: number[] = [];
    if (reader.pos < bytes.length) {
      const lineLen = reader.readInt(sizeInt);
      for (let l = 0; l < lineLen; l++) {
        lineInfo.push(reader.readInt(sizeInt));
      }
    }

    const locals: LuaLocalVar[] = [];
    if (reader.pos < bytes.length) {
      const locLen = reader.readInt(sizeInt);
      for (let l = 0; l < locLen; l++) {
        const name = reader.readLuaString(sizeSizeT);
        const startPc = reader.readInt(sizeInt);
        const endPc = reader.readInt(sizeInt);
        locals.push({ name, startPc, endPc });
      }
    }

    if (reader.pos < bytes.length) {
      const upvalNamesLen = reader.readInt(sizeInt);
      for (let u = 0; u < upvalNamesLen; u++) {
        const name = reader.readLuaString(sizeSizeT);
        if (upvalues[u]) {
          upvalues[u].name = name;
        }
      }
    }

    // Audit _ENV global reads & writes
    for (const instr of instructions) {
      if (instr.opcode === "GETTABUP") {
        const c = instr.c ?? 0;
        if (c & 256) {
          const kIdx = c & 255;
          const rawK = constants[kIdx];
          const sym = rawK ? rawK.replace(/^"|"$/g, "") : `K[${kIdx}]`;
          globalAccesses.push({
            pc: instr.pc,
            kind: "read",
            symbol: sym,
            protoPath,
          });
        }
      } else if (instr.opcode === "SETTABUP") {
        const b = instr.b ?? 0;
        if (b & 256) {
          const kIdx = b & 255;
          const rawK = constants[kIdx];
          const sym = rawK ? rawK.replace(/^"|"$/g, "") : `K[${kIdx}]`;
          globalAccesses.push({
            pc: instr.pc,
            kind: "write",
            symbol: sym,
            protoPath,
          });
        }
      }
    }

    return {
      source,
      lineDefined,
      lastLineDefined,
      numParams,
      isVararg,
      maxStackSize,
      instructionCount: codeLen,
      instructions,
      rawCode,
      constants,
      upvaluesCount: upvalsLen,
      upvalues,
      locals,
      lineInfo,
      subPrototypesCount: subProtoLen,
      subPrototypes,
    };
  }

  const mainPrototype = parsePrototype("main");

  return {
    header,
    totalInstructions,
    totalPrototypes,
    globalAccesses,
    mainPrototype,
  };
}

export function transcodeLua52Bytecode(
  sourceBytes: Uint8Array,
  targetIntSize = 4,
  targetSizeTSize = 4
): Uint8Array {
  if (!isLua52Bytecode(sourceBytes)) {
    throw new Error("Invalid Lua 5.2 chunk");
  }

  const inReader = new ByteReader(sourceBytes);
  inReader.pos = 4;
  inReader.readByte(); // version 0x52
  inReader.readByte(); // format 0
  const endian = inReader.readByte();
  const srcInt = inReader.readByte();
  const srcSizeT = inReader.readByte();
  const srcInstr = inReader.readByte();
  const srcNum = inReader.readByte();
  const srcIntegral = inReader.readByte();
  inReader.readBytes(6); // tail

  const out: number[] = [0x1b, 0x4c, 0x75, 0x61, 0x52, 0x00, endian, targetIntSize, targetSizeTSize, srcInstr, srcNum, srcIntegral];
  out.push(...LUAC_TAIL_52);

  function writeInt(val: number) {
    if (targetIntSize === 4) {
      out.push(val & 0xff, (val >>> 8) & 0xff, (val >>> 16) & 0xff, (val >>> 24) & 0xff);
    } else {
      out.push(val & 0xff, (val >>> 8) & 0xff, (val >>> 16) & 0xff, (val >>> 24) & 0xff, 0, 0, 0, 0);
    }
  }

  function writeSizeT(val: number) {
    if (targetSizeTSize === 4) {
      out.push(val & 0xff, (val >>> 8) & 0xff, (val >>> 16) & 0xff, (val >>> 24) & 0xff);
    } else {
      out.push(val & 0xff, (val >>> 8) & 0xff, (val >>> 16) & 0xff, (val >>> 24) & 0xff, 0, 0, 0, 0);
    }
  }

  function transcodeProto() {
    const lineDefined = inReader.readInt(srcInt);
    const lastLineDefined = inReader.readInt(srcInt);
    writeInt(lineDefined);
    writeInt(lastLineDefined);

    out.push(inReader.readByte()); // num_params
    out.push(inReader.readByte()); // is_vararg
    out.push(inReader.readByte()); // max_stack

    // Instructions
    const codeLen = inReader.readInt(srcInt);
    writeInt(codeLen);
    for (let i = 0; i < codeLen; i++) {
      const instr = inReader.readUint32();
      out.push(instr & 0xff, (instr >>> 8) & 0xff, (instr >>> 16) & 0xff, (instr >>> 24) & 0xff);
    }

    // Constants
    const kLen = inReader.readInt(srcInt);
    writeInt(kLen);
    for (let k = 0; k < kLen; k++) {
      const tag = inReader.readByte();
      out.push(tag);
      if (tag === 0) {
        // nil
      } else if (tag === 1) {
        out.push(inReader.readByte());
      } else if (tag === 3) {
        const numBytes = inReader.readBytes(8);
        out.push(...numBytes);
      } else if (tag === 4 || tag === 0x14) {
        const sLen = inReader.readSizeT(srcSizeT);
        writeSizeT(sLen);
        if (sLen > 0) {
          const sBytes = inReader.readBytes(sLen);
          out.push(...sBytes);
        }
      }
    }

    // Sub-prototypes
    const subLen = inReader.readInt(srcInt);
    writeInt(subLen);
    for (let p = 0; p < subLen; p++) {
      transcodeProto();
    }

    // Upvalues
    const upvLen = inReader.readInt(srcInt);
    writeInt(upvLen);
    for (let u = 0; u < upvLen; u++) {
      out.push(inReader.readByte());
      out.push(inReader.readByte());
    }

    // Debug
    if (inReader.pos < sourceBytes.length) {
      const srcLen = inReader.readSizeT(srcSizeT);
      writeSizeT(srcLen);
      if (srcLen > 0) {
        out.push(...inReader.readBytes(srcLen));
      }
    }

    if (inReader.pos < sourceBytes.length) {
      const linesCount = inReader.readInt(srcInt);
      writeInt(linesCount);
      for (let l = 0; l < linesCount; l++) {
        writeInt(inReader.readInt(srcInt));
      }
    }

    if (inReader.pos < sourceBytes.length) {
      const locCount = inReader.readInt(srcInt);
      writeInt(locCount);
      for (let l = 0; l < locCount; l++) {
        const nameLen = inReader.readSizeT(srcSizeT);
        writeSizeT(nameLen);
        if (nameLen > 0) {
          out.push(...inReader.readBytes(nameLen));
        }
        writeInt(inReader.readInt(srcInt));
        writeInt(inReader.readInt(srcInt));
      }
    }

    if (inReader.pos < sourceBytes.length) {
      const upvNames = inReader.readInt(srcInt);
      writeInt(upvNames);
      for (let u = 0; u < upvNames; u++) {
        const nameLen = inReader.readSizeT(srcSizeT);
        writeSizeT(nameLen);
        if (nameLen > 0) {
          out.push(...inReader.readBytes(nameLen));
        }
      }
    }
  }

  transcodeProto();
  return new Uint8Array(out);
}
