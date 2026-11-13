// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  LEVEL5_NET_VERSION,
  NIE_NET_PROTOCOL_VERSION,
  TICK_RATE_HZ,
  TICK_DT,
  Inacode,
  SessionType,
  MatchMode,
  PlayerSlot,
  getTeamIndex,
  encodeTickInput,
  decodeTickInput,
  type PlayerTickInput,
} from "../src/protocol";
import {
  STEAM_APP_ID,
  EOS_TITLE_ID,
  resolveCloudConflict,
  validateRankedRosterLegal,
  type SaveSlotMetadata,
  type PlayerRosterMember,
} from "../src/cloud-sync";

describe("Achillea Online Protocol & Cloud Sync Suite", () => {
  test("verifies Level-5 network protocol constants", () => {
    expect(LEVEL5_NET_VERSION).toBe("NET_VER_2_3_0");
    expect(NIE_NET_PROTOCOL_VERSION).toBe("NIE_NET_1.0.0");
    expect(TICK_RATE_HZ).toBe(60);
    expect(TICK_DT).toBeCloseTo(0.0166666, 4);
    expect(SessionType.Game).toBe("Game");
    expect(SessionType.Town).toBe("Town");
    expect(MatchMode.Casual).toBe("Casual");
    expect(MatchMode.Ranked).toBe("Ranked");
    expect(MatchMode.Mode2v2).toBe("Mode2v2");
  });

  test("Inacode formats and seed generation", () => {
    const code1 = new Inacode("ina-7x29");
    expect(code1.code).toBe("INA-7X29");
    expect(code1.toString()).toBe("INA-7X29");

    const code2 = new Inacode("4k8m");
    expect(code2.code).toBe("INA-4K8M");

    const seedCode = Inacode.generateFromSeed(1337);
    expect(seedCode.code.startsWith("INA-")).toBeTrue();
    expect(seedCode.code.length).toBe(8); // INA-XXXX
  });

  test("PlayerSlot team mapping", () => {
    expect(getTeamIndex(PlayerSlot.Home)).toBe(0);
    expect(getTeamIndex(PlayerSlot.Home2)).toBe(0);
    expect(getTeamIndex(PlayerSlot.Away)).toBe(1);
    expect(getTeamIndex(PlayerSlot.Away2)).toBe(1);
    expect(getTeamIndex(PlayerSlot.Spectator)).toBeNull();
  });

  test("encodeTickInput and decodeTickInput roundtrip bitpacking", () => {
    const input: PlayerTickInput = {
      tick: 14400, // 4 minutes at 60Hz
      dx: 0.75,
      dy: -0.5,
      shoot: true,
      pass: false,
      skillId: 42,
    };

    const encoded = encodeTickInput(input);
    expect(encoded.length).toBe(12);

    const decoded = decodeTickInput(encoded);
    expect(decoded.tick).toBe(14400);
    expect(decoded.dx).toBeCloseTo(0.75, 1);
    expect(decoded.dy).toBeCloseTo(-0.5, 1);
    expect(decoded.shoot).toBe(true);
    expect(decoded.pass).toBe(false);
    expect(decoded.skillId).toBe(42);
  });

  test("resolveCloudConflict handles timestamps, byte equivalence and competitive locks", () => {
    expect(STEAM_APP_ID).toBe(3237890);
    expect(EOS_TITLE_ID).toBe("inazuma_victory_road");

    const localMeta: SaveSlotMetadata = {
      slotIndex: 0,
      fileName: "live_save_00.bin",
      magic: "L5SV",
      version: 1,
      playTimeSeconds: 3600,
      teamLevel: 45,
      characterCount: 16,
      chapter: 5,
      lastSavedAt: 1000,
      checksumSha256: "hash_local",
      isRankedLegal: true,
    };

    const remoteMeta: SaveSlotMetadata = {
      ...localMeta,
      lastSavedAt: 2000,
      checksumSha256: "hash_remote",
    };

    // 1. Cloud is newer -> CloudOverwritesLocal
    const res1 = resolveCloudConflict(localMeta, remoteMeta, false);
    expect(res1.decision).toBe("CloudOverwritesLocal");

    // 2. Active server competitive match -> ServerCompetitiveLock
    const res2 = resolveCloudConflict(localMeta, remoteMeta, true);
    expect(res2.decision).toBe("ServerCompetitiveLock");

    // 3. Hashes match -> IdenticalNoAction
    const res3 = resolveCloudConflict(
      { ...localMeta, checksumSha256: "same" },
      { ...remoteMeta, checksumSha256: "same" },
      false,
    );
    expect(res3.decision).toBe("IdenticalNoAction");
  });

  test("validateRankedRosterLegal enforces legal competitive bounds", () => {
    const validMember: PlayerRosterMember = {
      characterId: 1001,
      level: 50,
      stats: {
        kick: 200,
        body: 180,
        control: 190,
        guard: 150,
        speed: 210,
        stamina: 170,
        guts: 160,
      },
      equippedSkills: [10, 20, 30],
    };

    // 11 valid players
    const roster: PlayerRosterMember[] = Array.from({ length: 11 }, (_, i) => ({
      ...validMember,
      characterId: 1001 + i,
    }));

    const check1 = validateRankedRosterLegal(50, roster);
    expect(check1.isLegal).toBeTrue();
    expect(check1.violations.length).toBe(0);

    // Duplicate player exploit
    const hackedRoster = [...roster];
    hackedRoster[1] = { ...hackedRoster[0] };
    const check2 = validateRankedRosterLegal(50, hackedRoster);
    expect(check2.isLegal).toBeFalse();
    expect(
      check2.violations.some((v) => v.includes("Duplicate character ID")),
    ).toBeTrue();

    // Stat overflow exploit
    const overflowRoster = [...roster];
    overflowRoster[2] = {
      ...overflowRoster[2],
      stats: { ...overflowRoster[2].stats, kick: 9999 },
    };
    const check3 = validateRankedRosterLegal(50, overflowRoster);
    expect(check3.isLegal).toBeFalse();
    expect(
      check3.violations.some((v) => v.includes("stat overflow")),
    ).toBeTrue();
  });
});
