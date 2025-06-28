declare module '@node-steam/vdf' {
  /**
   * Parses a VDF string into a JavaScript object.
   * @param text The VDF string to parse.
   * @returns The parsed JavaScript object.
   */
  export function parse<T = any>(text: string): T;

  /**
   * Converts a JavaScript object into a VDF string.
   * @param obj The JavaScript object to stringify.
   * @returns The VDF string.
   */
  export function stringify(obj: object): string;
}
