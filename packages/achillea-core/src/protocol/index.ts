// SPDX-License-Identifier: Apache-2.0
// Level-5 Inazuma Eleven: Victory Road Exact Online Protocol Specifications
// Mirrors Level-5 EOS attributes (NET_VER_2_3_0, SESSION_TYPE_GAME, SESSION_TYPE_TOWN, MODE_2V2)
// and defines the deterministic 60Hz lockstep / rollback network wire contracts.

/** Canonical Level-5 native network compatibility version string extracted from nie.exe. */
export const LEVEL5_NET_VERSION = "NET_VER_2_3_0" as const;

/** Sovereign nie online protocol identifier. */
export const NIE_NET_PROTOCOL_VERSION = "NIE_NET_1.0.0" as const;

/** Authoritative simulation tick rate in Hertz (60 Hz). */
export const TICK_RATE_HZ = 60;

/** Simulation tick delta time in seconds (1/60s ~ 16.666ms). */
export const TICK_DT = 1 / 60;

/** Maximum frames retained in the rollback prediction history ring buffer. */
export const ROLLBACK_MAX_FRAMES = 64;

/** Session types matching Level-5 game attributes. */
export type SessionType = "Game" | "Town";

export const SessionType = {
  /** Football match simulation (11 vs 11 or 2 vs 2). */
  Game: "Game" as SessionType,
  /** Kizuna Town multiplayer social hub (SESSION_TYPE_TOWN). */
  Town: "Town" as SessionType,
};

/** Match mode categories. */
export type ProtocolMatchMode = "Casual" | "Ranked" | "PrivateRoom" | "Mode2v2";

export const ProtocolMatchMode = {
  /** Casual exhibition match (flag_enjoy_match). */
  Casual: "Casual" as ProtocolMatchMode,
  /** Competitive ranked ladder match (flag_rank_match). */
  Ranked: "Ranked" as ProtocolMatchMode,
  /** Private custom room (flag_room_match). */
  PrivateRoom: "PrivateRoom" as ProtocolMatchMode,
  /** 2 vs 2 co-op team match (MODE_2V2). */
  Mode2v2: "Mode2v2" as ProtocolMatchMode,
};

/** Assigned player slot in an active match or room. */
export type PlayerSlot = "Home" | "Away" | "Home2" | "Away2" | "Spectator";

export const PlayerSlot = {
  Home: "Home" as PlayerSlot,
  Away: "Away" as PlayerSlot,
  Home2: "Home2" as PlayerSlot,
  Away2: "Away2" as PlayerSlot,
  Spectator: "Spectator" as PlayerSlot,
};

export function getTeamIndex(slot: PlayerSlot): 0 | 1 | null {
  switch (slot) {
    case "Home":
    case "Home2":
      return 0;
    case "Away":
    case "Away2":
      return 1;
    case "Spectator":
      return null;
  }
}

/** Inacode room identifier (e.g. INA-7X29). */
export class Inacode {
  public readonly code: string;

  constructor(code: string) {
    const cleaned = code.trim().toUpperCase();
    if (cleaned.startsWith("INA-")) {
      this.code = cleaned;
    } else if (cleaned.startsWith("INA") && cleaned.length > 3) {
      this.code = `INA-${cleaned.slice(3)}`;
    } else {
      this.code = `INA-${cleaned}`;
    }
  }

  public static generateFromSeed(seed: number): Inacode {
    const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let s = seed >>> 0;
    let res = "";
    for (let i = 0; i < 4; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      res += CHARSET[s % CHARSET.length];
    }
    return new Inacode(`INA-${res}`);
  }

  public toString(): string {
    return this.code;
  }
}

/** Atomic player input for a specific simulation tick. */
export interface PlayerTickInput {
  tick: number;
  dx: number;
  dy: number;
  shoot: boolean;
  pass: boolean;
  skillId?: number;
}

/**
 * Encodes atomic tick input into a compact 12-byte binary wire payload:
 * - [0..7] tick (BigInt64 / Uint32 le)
 * - [8] dx signed int8 (-128 to 127 mapped from -1.0 to 1.0)
 * - [9] dy signed int8 (-128 to 127 mapped from -1.0 to 1.0)
 * - [10] flags bitfield: bit 0 = shoot, bit 1 = pass, bit 2 = has_skill
 * - [11] skillId low byte (or 0)
 */
export function encodeTickInput(input: PlayerTickInput): Uint8Array {
  const buf = new Uint8Array(12);
  const view = new DataView(buf.buffer);

  // Tick as uint32 low, uint32 high
  view.setUint32(0, input.tick >>> 0, true);
  view.setUint32(4, Math.floor(input.tick / 0x100000000) >>> 0, true);

  // Clamped stick coordinates
  const clampedX = Math.max(-1, Math.min(1, input.dx));
  const clampedY = Math.max(-1, Math.min(1, input.dy));
  view.setInt8(8, Math.round(clampedX * 127));
  view.setInt8(9, Math.round(clampedY * 127));

  let flags = 0;
  if (input.shoot) flags |= 1 << 0;
  if (input.pass) flags |= 1 << 1;
  if (input.skillId !== undefined && input.skillId > 0) flags |= 1 << 2;
  view.setUint8(10, flags);

  view.setUint8(11, input.skillId ? input.skillId & 0xff : 0);
  return buf;
}

/**
 * Decodes atomic tick input from a compact 12-byte wire payload.
 */
export function decodeTickInput(bytes: Uint8Array): PlayerTickInput {
  if (bytes.length < 12) {
    throw new Error(
      `Invalid tick packet length: ${bytes.length} bytes (expected >= 12)`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const low = view.getUint32(0, true);
  const high = view.getUint32(4, true);
  const tick = high * 0x100000000 + low;

  const rawX = view.getInt8(8);
  const rawY = view.getInt8(9);
  const dx = rawX / 127;
  const dy = rawY / 127;

  const flags = view.getUint8(10);
  const shoot = (flags & (1 << 0)) !== 0;
  const pass = (flags & (1 << 1)) !== 0;
  const hasSkill = (flags & (1 << 2)) !== 0;
  const skillByte = view.getUint8(11);

  return {
    tick,
    dx,
    dy,
    shoot,
    pass,
    skillId: hasSkill ? skillByte : undefined,
  };
}
