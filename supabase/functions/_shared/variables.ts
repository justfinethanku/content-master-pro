/**
 * Automatic Variable Resolution System
 *
 * Resolves prompt variables from manual overrides passed at call time.
 *
 * NOTE: The database-driven variable registry (prompt_variables table) and
 * content pipeline tables (content_sessions, content_brain_dumps, etc.) were
 * removed in the dead features cleanup (Feb 2026). Variable resolution now
 * works purely from manual overrides and template extraction.
 */

/**
 * Extract variable names from a prompt template
 * Finds all {{variable_name}} patterns
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

/**
 * Main function: Resolve all variables for a prompt template
 *
 * @param template - The prompt template with {{variable_name}} placeholders
 * @param _sessionId - Deprecated, unused (content pipeline tables removed)
 * @param _userId - Deprecated, unused (content pipeline tables removed)
 * @param overrides - Manual variable values passed at call time
 * @returns Record of variable_name -> resolved_value
 */
export async function resolveVariables(
  template: string,
  _sessionId: string,
  _userId: string,
  overrides?: Record<string, string>
): Promise<Record<string, string>> {
  const variableNames = extractVariables(template);

  if (variableNames.length === 0) {
    return {};
  }

  const resolved: Record<string, string> = {};

  for (const varName of variableNames) {
    if (overrides && varName in overrides) {
      resolved[varName] = overrides[varName];
    } else {
      // No database-driven resolution available — leave empty
      resolved[varName] = "";
    }
  }

  return resolved;
}
