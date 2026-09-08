export {};

declare global {
  /** Injected at build time from `package.json`. */
  const __PKG_NAME__: string;
  /** Injected at build time from `package.json`. */
  const __PKG_VERSION__: string;
  /** Injected at build time from `package.json`. */
  const __PKG_HOMEPAGE__: string;
}
