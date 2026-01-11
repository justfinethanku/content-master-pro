/**
 * Partner API Key Generation and Hashing
 *
 * Key format: pk_live_<base64url-encoded-random-bytes>
 * Invite format: INV_<16-char-alphanumeric>
 *
 * IMPORTANT: Never store plaintext API keys. Always hash with SHA-256.
 */

import { createHash, randomBytes } from "crypto";

// Key prefixes
const API_KEY_PREFIX_LIVE = "pk_live_";
const API_KEY_PREFIX_TEST = "pk_test_";
const INVITE_CODE_PREFIX = "INV_";

// Key lengths
const API_KEY_RANDOM_BYTES = 32; // 32 bytes = 256 bits of entropy
const INVITE_CODE_LENGTH = 16; // 16 alphanumeric characters
const KEY_PREFIX_DISPLAY_LENGTH = 16; // How many chars to show in UI

/**
 * Generate a new API key
 * Returns the full key (shown once), hash (for storage), and prefix (for display)
 */
export function generateApiKey(
  isTest = false
): { fullKey: string; keyHash: string; keyPrefix: string } {
  // Generate random bytes
  const randomPart = randomBytes(API_KEY_RANDOM_BYTES);

  // Encode as base64url (URL-safe base64)
  const encodedRandom = randomPart
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Construct full key
  const prefix = isTest ? API_KEY_PREFIX_TEST : API_KEY_PREFIX_LIVE;
  const fullKey = `${prefix}${encodedRandom}`;

  // Hash for storage
  const keyHash = hashApiKey(fullKey);

  // Prefix for display (first 16 chars including pk_live_ prefix)
  const keyPrefix = fullKey.substring(0, KEY_PREFIX_DISPLAY_LENGTH);

  return { fullKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256
 * Used for both storage and lookup
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate an invite code
 * Format: INV_<16-char-alphanumeric-uppercase>
 * NOTE: Uses uppercase only for easier user input
 */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  // Generate random alphanumeric string (uppercase only)
  const randomBuffer = randomBytes(INVITE_CODE_LENGTH);
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += chars[randomBuffer[i] % chars.length];
  }

  return `${INVITE_CODE_PREFIX}${code}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Must start with pk_live_ or pk_test_
  if (!key.startsWith(API_KEY_PREFIX_LIVE) && !key.startsWith(API_KEY_PREFIX_TEST)) {
    return false;
  }

  // Remove prefix and check remaining part
  const prefix = key.startsWith(API_KEY_PREFIX_LIVE)
    ? API_KEY_PREFIX_LIVE
    : API_KEY_PREFIX_TEST;
  const randomPart = key.substring(prefix.length);

  // Should be base64url encoded (alphanumeric + - _)
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  if (!base64urlRegex.test(randomPart)) {
    return false;
  }

  // Should be approximately 43 characters (32 bytes in base64url)
  if (randomPart.length < 40 || randomPart.length > 50) {
    return false;
  }

  return true;
}

/**
 * Validate invite code format
 * Accepts both upper and lowercase (will be normalized on lookup)
 */
export function isValidInviteCodeFormat(code: string): boolean {
  // Normalize to uppercase for validation
  const normalizedCode = code.toUpperCase();

  // Must start with INV_
  if (!normalizedCode.startsWith(INVITE_CODE_PREFIX)) {
    return false;
  }

  // Check the random part
  const randomPart = normalizedCode.substring(INVITE_CODE_PREFIX.length);

  // Should be alphanumeric (uppercase) and 16 characters
  const alphanumericRegex = /^[A-Z0-9]+$/;
  return alphanumericRegex.test(randomPart) && randomPart.length === INVITE_CODE_LENGTH;
}

/**
 * Extract the Bearer token from an Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Mask an API key for display (show prefix only)
 */
export function maskApiKey(key: string): string {
  if (key.length <= KEY_PREFIX_DISPLAY_LENGTH) {
    return key;
  }
  return `${key.substring(0, KEY_PREFIX_DISPLAY_LENGTH)}...`;
}
