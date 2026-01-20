/**
 * Utility functions for sanitizing user input to prevent XSS attacks
 */

/**
 * Sanitizes a string by escaping HTML special characters
 * @param input The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeHtml(input: string): string {
  if (!input) return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Removes potentially dangerous characters from input
 * @param input The string to clean
 * @returns The cleaned string
 */
export function removeScriptTags(input: string): string {
  if (!input) return input;
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Validates and sanitizes profile name input
 * @param name The profile name to sanitize
 * @returns The sanitized profile name
 */
export function sanitizeProfileName(name: string): string {
  if (!name) return name;
  
  // Remove HTML tags and dangerous characters
  let sanitized = sanitizeHtml(name);
  sanitized = removeScriptTags(sanitized);
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Comprehensive input sanitization for general text input
 * @param input The input to sanitize
 * @returns The sanitized input
 */
export function sanitizeInput(input: string): string {
  if (!input) return input;
  
  let sanitized = sanitizeHtml(input);
  sanitized = removeScriptTags(sanitized);
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Validates that input doesn't contain malicious patterns
 * @param input The input to validate
 * @returns True if input is safe, false otherwise
 */
export function isInputSafe(input: string): boolean {
  if (!input) return true;
  
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}