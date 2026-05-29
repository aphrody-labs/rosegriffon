/**
 * @file vfs/types.ts
 * @description Types pour le streaming des data IEVR depuis les CPKs natifs.
 */

export interface VfsIndexEntry {
  p: string;
  s: number;
}

export interface VfsIndex {
  cpks: Record<string, VfsIndexEntry[]>;
}

export interface VfsResolvedAsset {
  cpk: string;
  internalPath: string;
  size: number;
}

export interface VfsConfig {
  gameDataDir: string;
  cpksDir: string;
  indexPath: string;
  iecodeBin: string;
  cacheBytesMax: number;
  cacheCfgBinMax: number;
}
