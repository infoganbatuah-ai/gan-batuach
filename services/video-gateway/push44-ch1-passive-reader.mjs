import { constants, openSync, closeSync, fstatSync, readSync, realpathSync, lstatSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { CH1, CH1_LIMITS, validateCh1Playlist } from "./push44-ch1-private-media.mjs";
import { inspectHlsPlaybackPlaylist } from "./hls-playback-continuity.mjs";

// Reads an explicitly approved existing generation, never /playback or /hls:
// those installed Gateway routes can call ensureRelay and change relay state.
// Caller pins the generation directory after separate owner approval. No live
// directory is auto-discovered; no RTSP connection, grant redemption or writes.
export function createCh1PassiveReader({ directory, generation }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(generation || ""))
    throw new Error("CH1_GENERATION_REQUIRED");
  const root = resolve(directory);
  if (basename(root) !== `${CH1.streamId}-${generation}` || lstatSync(root).isSymbolicLink() || realpathSync(root) !== root)
    throw new Error("CH1_GENERATION_DIRECTORY_DENIED");
  return async ({ source, pathname, signal, maxBytes }) => {
    signal.throwIfAborted();
    if (source !== CH1 || !/^\/ch1\/(index\.m3u8|segment-\d{1,16}\.ts)$/.test(pathname) ||
      maxBytes !== CH1_LIMITS.objectBytes) throw new Error("CH1_READER_SCOPE_DENIED");
    const fd = openSync(join(root, basename(pathname)), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = fstatSync(fd);
      if (!before.isFile() || before.size < 1 || before.size > maxBytes) throw new Error("CH1_OBJECT_SIZE_DENIED");
      const body = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < body.length) {
        signal.throwIfAborted();
        const count = readSync(fd, body, offset, body.length - offset, offset);
        if (!count) throw new Error("CH1_OBJECT_INCOMPLETE"); offset += count;
      }
      const after = fstatSync(fd);
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino)
        throw new Error("CH1_OBJECT_CHANGED");
      let sequence;
      if (pathname.endsWith("m3u8")) {
        validateCh1Playlist(body);
        sequence = inspectHlsPlaybackPlaylist(body.toString())?.mediaSequence;
      }
      return { source: CH1, generation, producedAt: Math.floor(before.mtimeMs), sequence, body };
    } finally { closeSync(fd); }
  };
}
