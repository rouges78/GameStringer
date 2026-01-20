/**
 * Array Protection Utilities
 * 
 * Provides safe array operations to prevent "is not a function" errors
 * when working with potentially undefined, null, or non-array values.
 */

/**
 * Ensures that a value is always returned as an array
 * @param value - The value to convert to an array
 * @returns A valid array, empty if input is invalid
 */
export function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  
  if (value === null || value === undefined) {
    return [];
  }
  
  // If it's an object but not an array, return empty array
  if (typeof value === 'object') {
    return [];
  }
  
  // For any other type, return empty array
  return [];
}

/**
 * Safely maps over an array-like value
 * @param array - The array or array-like value to map over
 * @param mapper - The mapping function
 * @returns Mapped array or empty array if input is invalid
 */
export function safeMap<T, R>(
  array: unknown, 
  mapper: (item: T, index: number) => R
): R[] {
  const safeArray = ensureArray<T>(array);
  return safeArray.map(mapper);
}

/**
 * Safely filters an array-like value
 * @param array - The array or array-like value to filter
 * @param predicate - The filter predicate function
 * @returns Filtered array or empty array if input is invalid
 */
export function safeFilter<T>(
  array: unknown,
  predicate: (item: T, index: number) => boolean
): T[] {
  const safeArray = ensureArray<T>(array);
  return safeArray.filter(predicate);
}

/**
 * Safely reduces an array-like value
 * @param array - The array or array-like value to reduce
 * @param reducer - The reducer function
 * @param initialValue - The initial value for the reduction
 * @returns Reduced value or initial value if input is invalid
 */
export function safeReduce<T, R>(
  array: unknown,
  reducer: (accumulator: R, currentValue: T, currentIndex: number) => R,
  initialValue: R
): R {
  const safeArray = ensureArray<T>(array);
  return safeArray.reduce(reducer, initialValue);
}

/**
 * Safely finds an item in an array-like value
 * @param array - The array or array-like value to search
 * @param predicate - The search predicate function
 * @returns Found item or undefined if not found or input is invalid
 */
export function safeFind<T>(
  array: unknown,
  predicate: (item: T, index: number) => boolean
): T | undefined {
  const safeArray = ensureArray<T>(array);
  return safeArray.find(predicate);
}

/**
 * Safely gets the length of an array-like value
 * @param array - The array or array-like value
 * @returns Length of array or 0 if input is invalid
 */
export function safeLength(array: unknown): number {
  const safeArray = ensureArray(array);
  return safeArray.length;
}

/**
 * Safely checks if an array-like value is empty
 * @param array - The array or array-like value to check
 * @returns True if empty or invalid, false if has items
 */
export function isEmpty(array: unknown): boolean {
  return safeLength(array) === 0;
}

/**
 * Safely gets an item at a specific index
 * @param array - The array or array-like value
 * @param index - The index to access
 * @returns Item at index or undefined if invalid array or index
 */
export function safeGet<T>(array: unknown, index: number): T | undefined {
  const safeArray = ensureArray<T>(array);
  if (index < 0 || index >= safeArray.length) {
    return undefined;
  }
  return safeArray[index];
}

/**
 * Validates that a value is an array and logs warning if not
 * @param value - The value to validate
 * @param context - Context string for logging
 * @returns True if valid array, false otherwise
 */
export function validateArray(value: unknown, context: string = 'Unknown'): boolean {
  if (!Array.isArray(value)) {
    console.warn(`[Array Validation] Expected array in ${context}, got:`, typeof value, value);
    return false;
  }
  return true;
}

/**
 * Creates a safe array setter function that validates input
 * @param setter - The original setter function
 * @param context - Context for logging
 * @returns Safe setter function that ensures array input
 */
export function createSafeArraySetter<T>(
  setter: (value: T[]) => void,
  context: string = 'Array Setter'
): (value: unknown) => void {
  return (value: unknown) => {
    const safeArray = ensureArray<T>(value);
    
    if (!validateArray(value, context)) {
      console.warn(`[${context}] Converting non-array value to empty array`);
    }
    
    setter(safeArray);
  };
}