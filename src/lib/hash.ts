import { createHash } from 'crypto';
import { canonicalizeToBuffer } from './canonicalize.js';

/**
 * Compute SHA-256 hash of the canonical JSON representation
 */
export function hashPayload(payload: Record<string, unknown>): Buffer {
  const canonical = canonicalizeToBuffer(payload);
  return createHash('sha256').update(canonical).digest();
}

/**
 * Compute SHA-256 hash of a string (for idempotency keys)
 */
export function hashString(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Compute chain hash: SHA-256(sequence_num || payload_hash || prev_chain_hash)
 * 
 * @param sequenceNum - 8-byte big-endian representation
 * @param payloadHash - 32-byte SHA-256 of canonical payload
 * @param prevChainHash - 32-byte previous chain hash, or null for first record
 */
export function computeChainHash(
  sequenceNum: bigint,
  payloadHash: Buffer,
  prevChainHash: Buffer | null
): Buffer {
  const seqBuffer = Buffer.alloc(8);
  seqBuffer.writeBigInt64BE(sequenceNum);

  // If no previous hash (first record), use 32 zero bytes
  const prevHash = prevChainHash ?? Buffer.alloc(32, 0);

  const combined = Buffer.concat([seqBuffer, payloadHash, prevHash]);
  return createHash('sha256').update(combined).digest();
}

/**
 * Encode buffer as base64 for API responses
 */
export function toBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Decode base64 string to buffer
 */
export function fromBase64(value: string): Buffer {
  return Buffer.from(value, 'base64');
}

/**
 * Compare two buffers for equality (constant-time)
 */
export function buffersEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return a.compare(b) === 0;
}
