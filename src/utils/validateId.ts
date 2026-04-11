/**
 * MongoDB ObjectId validation utility
 * Validates that URL path params are well-formed before sending API requests.
 * ObjectIds are 24-character hexadecimal strings.
 */

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_REGEX.test(id);
}

/**
 * Throws if the given value is not a valid ObjectId.
 * Use this before building API URLs with untrusted IDs.
 */
export function assertObjectId(id: unknown, label = 'ID'): asserts id is string {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ${label}: must be a 24-character hex string`);
  }
}
