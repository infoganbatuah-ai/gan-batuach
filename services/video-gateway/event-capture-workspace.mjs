import { constants, closeSync, fstatSync, lstatSync, mkdtempSync, openSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const prefix = "gan-batuach-anchored-event-";
const markerName = ".evidence-owner.json";
const namespace = "gan-batuach:event-capture:v1";
const allowed = name => [markerName, "evidence.m3u8", "clip.mp4", "thumbnail.jpg"].includes(name) || /^segment-[0-9]{1,18}\.ts$/.test(name);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; } };

/** Reap only privately marked directories produced by this module. Never
 * traverse symlinks, unknown files or unmarked directories; never delete a
 * broad tmp root. All cleanup is bounded and isolated from relay storage. */
export function createEventCaptureWorkspace({ root = tmpdir(), now = Date.now, pid = process.pid,
  uid = process.getuid?.(), isProcessAlive = alive, maxAgeMs = 300_000 } = {}) {
  const owned = new Map();
  let scanCursor = 0;
  function inspect(path) {
    if (dirname(path) !== root || !basename(path).startsWith(prefix)) return null;
    try {
      const dir = lstatSync(path);
      if (!dir.isDirectory() || dir.isSymbolicLink() || uid !== undefined && dir.uid !== uid || (dir.mode & 0o077) !== 0) return null;
      const fd = openSync(join(path, markerName), constants.O_RDONLY | constants.O_NOFOLLOW);
      let marker;
      try {
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.size > 1024 || stat.size < 1 || uid !== undefined && stat.uid !== uid || (stat.mode & 0o077) !== 0) return null;
        marker = JSON.parse(readFileSync(fd, "utf8"));
      } finally { closeSync(fd); }
      if (marker.namespace !== namespace || typeof marker.token !== "string" || !/^[0-9a-f-]{36}$/.test(marker.token)
        || !Number.isSafeInteger(marker.pid) || marker.pid <= 0 || !Number.isFinite(marker.created_at)
        || !Number.isFinite(marker.expires_at) || marker.expires_at <= marker.created_at || marker.expires_at - marker.created_at > maxAgeMs) return null;
      const names = readdirSync(path);
      if (names.length > 128 || !names.every(allowed)) return null;
      let total = 0;
      for (const name of names) {
        const stat = lstatSync(join(path, name));
        if (!stat.isFile() || stat.isSymbolicLink() || uid !== undefined && stat.uid !== uid) return null;
        total += stat.size;
      }
      if (total > 32 * 1024 * 1024) return null;
      return { marker, names, dir };
    } catch { return null; }
  }
  function remove(path, token) {
    const checked = inspect(path);
    if (!checked || token && checked.marker.token !== token) return false;
    try {
      // Individual known files only; no recursive deletion or link traversal.
      for (const name of checked.names.filter(name => name !== markerName)) unlinkSync(join(path, name));
      unlinkSync(join(path, markerName));
      rmdirSync(path);
      owned.delete(path);
      return true;
    } catch {
      // A child that was just cancelled might finish writing between inspect
      // and rmdir. Keep the ownership marker so the next sweep can retry.
      try {
        const current = lstatSync(path);
        if (current.isDirectory() && !current.isSymbolicLink() && current.ino === checked.dir.ino && current.dev === checked.dir.dev)
          writeFileSync(join(path, markerName), JSON.stringify(checked.marker), {mode:0o600,flag:"wx"});
      } catch {}
      return false;
    }
  }
  return {
    create() {
      const path = mkdtempSync(join(root, prefix)), token = randomUUID();
      try {
        const createdAt = now();
        writeFileSync(join(path, markerName), JSON.stringify({namespace,token,pid,created_at:createdAt,expires_at:createdAt+maxAgeMs}), {mode:0o600,flag:"wx"});
        owned.set(path,token);
        return path;
      } catch (error) { try { rmdirSync(path); } catch {} throw error; }
    },
    dispose(path) { const token = owned.get(path); return Boolean(token) && remove(path, token); },
    reap() {
      let candidates;
      try {
        const all = readdirSync(root).filter(name=>name.startsWith(prefix));
        const count = Math.min(all.length,100);
        candidates = Array.from({length:count},(_,index)=>all[(scanCursor+index)%all.length]);
        scanCursor = all.length ? (scanCursor+count)%all.length : 0;
      } catch { return {removed:0,skipped:0}; }
      let removed = 0, skipped = 0;
      for (const name of candidates) {
        const path = join(root,name), checked = inspect(path);
        if (!checked || checked.marker.expires_at > now() && isProcessAlive(checked.marker.pid)) { skipped++; continue; }
        if (remove(path, checked.marker.token)) removed++; else skipped++;
      }
      return {removed,skipped};
    }
  };
}
