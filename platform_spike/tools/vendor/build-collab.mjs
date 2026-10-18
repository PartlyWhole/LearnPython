// Build vendor/collab.js (shared rooms) from tools/vendor/collab-entry.js.
//   npm run vendor:collab
// - @automerge/automerge resolves to its base64 entry, which carries the wasm inline and initialises
//   itself, so no wasm loader is needed (the same choice as BotGineer's vite.config.ts).
// - @codemirror/* imports become imports of ./codemirror.js, the app's single CodeMirror bundle.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const fullfat = fileURLToPath(new URL("../../node_modules/@automerge/automerge/dist/mjs/entrypoints/fullfat_base64.js", import.meta.url));

const shareCodeMirror = {
  name: "share-codemirror",
  setup(b) {
    b.onResolve({ filter: /^@codemirror\// }, () => ({ path: "./codemirror.js", external: true }));
    b.onResolve({ filter: /^@automerge\/automerge$/ }, () => ({ path: fullfat }));
  },
};

await build({
  entryPoints: [fileURLToPath(new URL("./collab-entry.js", import.meta.url))],
  outfile: fileURLToPath(new URL("../../vendor/collab.js", import.meta.url)),
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2022",
  legalComments: "eof",
  plugins: [shareCodeMirror],
  logLevel: "info",
});
