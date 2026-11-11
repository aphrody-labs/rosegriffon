// SPDX-License-Identifier: Apache-2.0
// Steam Cloud & Epic Online Services (EOS) to RoseGriffon Sovereign Cloud Sync & Verification Engine

/** Steam App ID for Inazuma Eleven: Victory Road. */
export const STEAM_APP_ID = 3237890;

/** Epic Online Services Title Storage identifier. */
export const EOS_TITLE_ID = "inazuma_victory_road";

/** 4-byte Magic header identifying valid Level-5 save files ("L5SV" = 0x5653354C in LE). */
export const L5SV_MAGIC = new Uint8Array([0x4c, 0x35, 0x53, 0x56]); // "L5SV"

export interface SaveSlotMetadata {
  slotIndex: number;
  fileName: string;
  magic: string;
  version: number;
  playTimeSeconds: number;
  teamLevel: number;
  characterCount: number;
  chapter: number;
  lastSavedAt: number; // Unix timestamp in seconds
  checksumSha256: string;
  isRankedLegal: boolean;
}

export type ConflictResolutionDecision =
  | "CloudOverwritesLocal"
  | "LocalOverwritesCloud"
  | "IdenticalNoAction"
  | "ServerCompetitiveLock";

export interface CloudConflictReport {
  decision: ConflictResolutionDecision;
  reason: string;
  localTimestamp: number;
  remoteTimestamp: number;
}

/**
 * Resolves cloud synchronization conflicts between local Steam/console save and remote RoseGriffon cloud.
 */
export function resolveCloudConflict(
  localMeta: SaveSlotMetadata,
  remoteMeta: SaveSlotMetadata,
  hasActiveServerCompetitiveLock = false
): CloudConflictReport {
  if (hasActiveServerCompetitiveLock) {
    return {
      decision: "ServerCompetitiveLock",
      reason: "Account is currently in an active Achilléa Ranked match. Cloud sync is locked until match completion.",
      localTimestamp: localMeta.lastSavedAt,
      remoteTimestamp: remoteMeta.lastSavedAt,
    };
  }

  if (localMeta.checksumSha256 && localMeta.checksumSha256 === remoteMeta.checksumSha256) {
    return {
      decision: "IdenticalNoAction",
      reason: "Local and cloud saves are identical byte-for-byte.",
      localTimestamp: localMeta.lastSavedAt,
      remoteTimestamp: remoteMeta.lastSavedAt,
    };
  }

  if (remoteMeta.lastSavedAt > localMeta.lastSavedAt) {
    return {
      decision: "CloudOverwritesLocal",
      reason: "Remote cloud save has a newer timestamp.",
      localTimestamp: localMeta.lastSavedAt,
      remoteTimestamp: remoteMeta.lastSavedAt,
    };
  }

  return {
    decision: "LocalOverwritesCloud",
    reason: "Local save has a newer timestamp or progressive local offline progress.",
    localTimestamp: localMeta.lastSavedAt,
    remoteTimestamp: remoteMeta.lastSavedAt,
  };
}

export interface PlayerRosterMember {
  characterId: number;
  level: number;
  stats: {
    kick: number;
    body: number;
    control: number;
    guard: number;
    speed: number;
    stamina: number;
    guts: number;
  };
  equippedSkills: number[];
}

export interface RankedRosterValidationResult {
  isLegal: boolean;
  violations: string[];
}

/**
 * Validates that a player's team roster conforms to Achilléa Ranked competitive regulations.
 * Prevents hacked save parameters, stat overflows, or duplicate move exploits.
 */
export function validateRankedRosterLegal(
  teamLevel: number,
  roster: PlayerRosterMember[]
): RankedRosterValidationResult {
  const violations: string[] = [];

  if (teamLevel < 1 || teamLevel > 99) {
    violations.push(`Team level ${teamLevel} is out of legal bounds [1..99].`);
  }

  if (roster.length < 11 || roster.length > 16) {
    violations.push(`Roster size ${roster.length} is invalid (must have 11-16 players).`);
  }

  const seenCharIds = new Set<number>();

  for (let i = 0; i < roster.length; i++) {
    const member = roster[i];
    if (seenCharIds.has(member.characterId)) {
      violations.push(`Duplicate character ID ${member.characterId} detected in team roster.`);
    }
    seenCharIds.add(member.characterId);

    if (member.level < 1 || member.level > 99) {
      violations.push(`Character ${member.characterId} has illegal level ${member.level}.`);
    }

    // Individual stat sanity checks (max legal stat in Victory Road is 999 with gear/training)
    const { kick, body, control, guard, speed, stamina, guts } = member.stats;
    if (kick > 999 || body > 999 || control > 999 || guard > 999 || speed > 999 || stamina > 999 || guts > 999) {
      violations.push(`Character ${member.characterId} has stat overflow exceeding competitive limit 999.`);
    }

    // Maximum 6 equipped skills/hissatsus per player
    if (member.equippedSkills.length > 6) {
      violations.push(`Character ${member.characterId} has ${member.equippedSkills.length} skills (max 6 allowed).`);
    }
  }

  return {
    isLegal: violations.length === 0,
    violations,
  };
}
