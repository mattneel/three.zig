import * as esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "es2020",
  sourcemap: false,
  minify: false,
  external: [],
  supported: { "top-level-await": true },
  entryPoints: ["app.js"],
  outfile: "dist/app-bundle.js",
});

console.log("Bundle written to dist/app-bundle.js");