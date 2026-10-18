// Everything shared rooms need from Automerge (docs/collab.md), bundled into vendor/collab.js by
// tools/vendor/build-collab.mjs. That bundle is imported only when someone shares or joins a room,
// so a solo learner never downloads it (about 2 MB with Automerge's wasm inline).
// @codemirror/* is NOT bundled here: build-collab.mjs points it at ./codemirror.js, the app's one
// copy (CLAUDE.md invariant 11: two copies of @codemirror/state break CodeMirror).
export { Repo, Presence, isValidAutomergeUrl } from "@automerge/automerge-repo";
export { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
export { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
export { automergeSyncPlugin } from "@automerge/automerge-codemirror";
export { getCursor, getCursorPosition } from "@automerge/automerge";
export { reconcileAnnotationType } from "@automerge/automerge-codemirror/dist/plugin.js"; // marks the plugin's own transactions
