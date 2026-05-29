/**
 * @file vfs/lru.ts
 * @description LRU cache size-bounded (par bytes pour assets, par count pour JSON).
 */

export class ByteLru<V extends { byteLength: number }> {
  private map = new Map<string, V>();
  private currentBytes = 0;
  constructor(private readonly maxBytes: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (!v) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      this.currentBytes -= existing.byteLength;
      this.map.delete(key);
    }
    this.map.set(key, value);
    this.currentBytes += value.byteLength;
    while (this.currentBytes > this.maxBytes && this.map.size > 0) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.map.get(oldestKey);
      if (oldest) this.currentBytes -= oldest.byteLength;
      this.map.delete(oldestKey);
    }
  }

  get bytes(): number {
    return this.currentBytes;
  }

  get count(): number {
    return this.map.size;
  }
}

export class CountLru<V> {
  private map = new Map<string, V>();
  constructor(private readonly maxCount: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (!v) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxCount) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
    }
  }

  get count(): number {
    return this.map.size;
  }
}
