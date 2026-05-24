/**
 * JSON Canonicalization following RFC 8785 (JCS) principles.
 * 
 * This implementation:
 * - Sorts object keys lexicographically (Unicode code point order)
 * - Recursively processes nested objects and arrays
 * - Uses ES6 number serialization (no exponent for integers in safe range)
 * - UTF-8 encoding with minimal escaping
 * - No whitespace
 * 
 * For production use with strict RFC 8785 compliance, consider
 * using a dedicated library like 'canonicalize' npm package.
 */

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  // Primitives (string, number, boolean) pass through
  // JSON.stringify handles number serialization per ES6 spec
  return value;
}

/**
 * Returns the canonical JSON as a UTF-8 Buffer for hashing
 */
export function canonicalizeToBuffer(value: unknown): Buffer {
  return Buffer.from(canonicalize(value), 'utf8');
}
