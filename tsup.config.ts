import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  name: string;
  version: string;
  homepage: string;
};

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  // The bundle is dominated by the inlined Wikidata tables, so a source map
  // would nearly double the install size while mapping almost nothing useful.
  sourcemap: false,
  treeshake: true,
  target: "node20",
  platform: "neutral",
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  define: {
    __PKG_NAME__: JSON.stringify(pkg.name),
    __PKG_VERSION__: JSON.stringify(pkg.version),
    __PKG_HOMEPAGE__: JSON.stringify(pkg.homepage)
  }
});
