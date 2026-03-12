import { POST_INSERT_BUCKET_SIZE } from "../config/defaults.js";

export class EventAccumulator {
  private insertedRegions = new Map<string, Set<number>>();

  isPostInsertEdit(fileHash: string, bucket: number): boolean {
    return this.insertedRegions.get(fileHash)?.has(bucket) ?? false;
  }

  recordInsertion(fileHash: string, startLine: number, linesInserted: number): void {
    if (linesInserted <= 0) return;

    if (!this.insertedRegions.has(fileHash)) {
      this.insertedRegions.set(fileHash, new Set());
    }

    const buckets = this.insertedRegions.get(fileHash)!;
    const startBucket = Math.floor(startLine / POST_INSERT_BUCKET_SIZE);
    const endBucket = Math.floor((startLine + linesInserted) / POST_INSERT_BUCKET_SIZE);

    for (let b = startBucket; b <= endBucket; b++) {
      buckets.add(b);
    }
  }

  reset(): void {
    this.insertedRegions.clear();
  }
}
