/**
 * Partner API Module
 *
 * Provides all functionality for the Partner API system:
 * - API key generation and validation
 * - Request authentication
 * - Rate limiting
 * - Namespace permissions
 * - Usage logging
 */

// Key management
export {
  generateApiKey,
  generateInviteCode,
  hashApiKey,
  isValidApiKeyFormat,
  isValidInviteCodeFormat,
  extractBearerToken,
  maskApiKey,
} from "./keys";

// Authentication
export {
  authenticateApiKey,
  hasReadAccess,
  hasWriteAccess,
  getReadableNamespaces,
  getWritableNamespaces,
  filterAllowedNamespaces,
  getClientIp,
} from "./auth";
export type { AuthResult } from "./auth";

// Rate limiting
export {
  checkRateLimit,
  getRateLimitHeaders,
  getRateLimitExceededHeaders,
} from "./rate-limit";
export type { RateLimitResult } from "./rate-limit";

// Permissions
export {
  getPartnerPermissions,
  getNamespacesWithPermissions,
  setNamespacePermission,
  removeNamespacePermission,
  grantDefaultPermissions,
  revokeAllPermissions,
  bulkUpdatePermissions,
} from "./permissions";

// Usage logging
export {
  logApiUsage,
  getPartnerUsageStats,
  getDailyUsage,
  getRecentCalls,
  getUsageCounts,
} from "./usage";
