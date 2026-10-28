// Review-only metadata inspection. This module never extracts, chroots, starts
// PostgreSQL, or grants a guest-runner capability.
import assert from "node:assert/strict";
import { posix } from "node:path";
import * as tar from "tar";

const LAYER_COUNT = 29;
const MAX_MEMBERS = 100_000;
const MAX_MEMBER_BYTES = 256 * 1024 ** 2;
const MAX_REGULAR_BYTES = 2 * 1024 ** 3;
const TYPES = new Set(["File", "Directory", "SymbolicLink", "Link"]);

function memberPath(value) {
  assert.ok(typeof value === "string" && value.length > 0 && value.length < 4096 &&
    !value.startsWith("/") && !value.includes("\\") && !/[\x00-\x1f\x7f]/.test(value),
  "QA_ROOTFS_PATH_INVALID");
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  assert.ok(normalized && normalized.split("/").every(part =>
    part !== "" && part !== "." && part !== ".."), "QA_ROOTFS_PATH_TRAVERSAL");
  return normalized;
}

function linkTarget(path, value, absoluteAllowed) {
  assert.ok(typeof value === "string" && value.length > 0 && value.length < 4096 &&
    !value.includes("\\") && !/[\x00-\x1f\x7f]/.test(value),
  "QA_ROOTFS_LINK_INVALID");
  if (value.startsWith("/")) assert.ok(absoluteAllowed, "QA_ROOTFS_HARDLINK_ABSOLUTE");
  const resolved = value.startsWith("/")
    ? posix.normalize(value.slice(1))
    : posix.normalize(posix.join(posix.dirname(path), value));
  assert.ok(resolved !== ".." && !resolved.startsWith("../") &&
    !resolved.startsWith("/"), "QA_ROOTFS_LINK_ESCAPE");
  return resolved;
}

function assertNoSymlinkParent(path, state) {
  const parts = path.split("/");
  for (let end = 1; end < parts.length; end++) {
    const parent = parts.slice(0, end).join("/");
    assert.notEqual(state.get(parent)?.type, "SymbolicLink",
      "QA_ROOTFS_SYMLINK_PARENT_WRITE");
  }
}

export function evaluateDockerlessRootfsLayers(layers) {
  assert.ok(Array.isArray(layers) && layers.length === LAYER_COUNT,
    "QA_ROOTFS_LAYER_COUNT_INVALID");
  const state = new Map();
  let members = 0, symlinks = 0, hardlinks = 0, whiteouts = 0;
  let regularBytes = 0, privilegedModes = 0;
  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    assert.equal(layer?.path, `layers/${String(index).padStart(2, "0")}/layer.tar`,
      "QA_ROOTFS_LAYER_ORDER_INVALID");
    assert.ok(Array.isArray(layer.entries), "QA_ROOTFS_LAYER_ENTRIES_MISSING");
    const seen = new Set();
    const ordinary = [];
    const lower = new Map(state);
    for (const entry of layer.entries) {
      assert.ok(++members <= MAX_MEMBERS, "QA_ROOTFS_MEMBER_CAP_EXCEEDED");
      const path = memberPath(entry?.path);
      assert.ok(!seen.has(path), "QA_ROOTFS_DUPLICATE_MEMBER");
      seen.add(path);
      assert.ok(TYPES.has(entry.type), "QA_ROOTFS_SPECIAL_NODE_DENIED");
      assert.ok(Number.isSafeInteger(entry.uid) && entry.uid >= 0 && entry.uid <= 65535 &&
        Number.isSafeInteger(entry.gid) && entry.gid >= 0 && entry.gid <= 65535 &&
        Number.isSafeInteger(entry.mode) && entry.mode >= 0 && entry.mode <= 0o7777 &&
        Number.isSafeInteger(entry.size) && entry.size >= 0 &&
        entry.size <= MAX_MEMBER_BYTES, "QA_ROOTFS_METADATA_INVALID");
      if (entry.type === "File") {
        regularBytes += entry.size;
        assert.ok(regularBytes <= MAX_REGULAR_BYTES, "QA_ROOTFS_BYTE_CAP_EXCEEDED");
      }
      if (entry.mode & 0o6000) privilegedModes++;
      const basename = posix.basename(path);
      if (basename.startsWith(".wh.")) {
        assertNoSymlinkParent(path, state);
        assert.equal(entry.type, "File", "QA_ROOTFS_WHITEOUT_TYPE_INVALID");
        assert.equal(entry.size, 0, "QA_ROOTFS_WHITEOUT_SIZE_INVALID");
        whiteouts++;
        const parent = posix.dirname(path);
        if (basename === ".wh..wh..opq") {
          const prefix = parent === "." ? "" : `${parent}/`;
          for (const key of lower.keys()) if (key.startsWith(prefix)) state.delete(key);
        } else {
          assert.ok(basename.length > 4, "QA_ROOTFS_WHITEOUT_TARGET_INVALID");
          const victim = parent === "." ? basename.slice(4)
            : `${parent}/${basename.slice(4)}`;
          memberPath(victim);
          for (const key of lower.keys())
            if (key === victim || key.startsWith(`${victim}/`)) state.delete(key);
        }
        continue;
      }
      ordinary.push({ ...entry, path });
    }
    for (const entry of ordinary) {
      assertNoSymlinkParent(entry.path, state);
      if (entry.type === "SymbolicLink") {
        linkTarget(entry.path, entry.linkpath, true);
        symlinks++;
      }
      if (entry.type === "Link") {
        const target = memberPath(entry.linkpath);
        assert.equal(state.get(target)?.type, "File", "QA_ROOTFS_HARDLINK_TARGET_INVALID");
        hardlinks++;
      }
      state.set(entry.path, { type: entry.type });
    }
  }
  return Object.freeze({ status: "OFFLINE_METADATA_ONLY", extractionAuthorized: false,
    layerCount: LAYER_COUNT, members, symlinks, hardlinks, whiteouts,
    finalPaths: state.size, regularBytes, privilegedModes });
}

export async function inspectDockerlessRootfsMetadata(checked) {
  assert.equal(checked?.archiveIntegrity, "STRUCTURE_AND_DIFF_IDS_VERIFIED",
    "QA_ROOTFS_OUTER_ARCHIVE_UNVERIFIED");
  const layers = Array.from({ length: LAYER_COUNT }, (_, index) => ({
    path: `layers/${String(index).padStart(2, "0")}/layer.tar`, entries: [] }));
  const pending = [];
  let memberCount = 0;
  let overflow = false;
  await tar.t({ file: checked.tarPath, strict: true, noResume: true,
    onReadEntry(outer) {
      const match = /^layers\/(0[0-9]|1[0-9]|2[0-8])\/layer\.tar$/.exec(outer.path);
      if (!match) { outer.resume(); return; }
      const layer = layers[Number(match[1])];
      const parser = new tar.Parser({ strict: true, onReadEntry(inner) {
        if (++memberCount <= MAX_MEMBERS) layer.entries.push({
          path: inner.path, type: inner.type,
          linkpath: inner.linkpath, size: inner.size,
          uid: inner.uid, gid: inner.gid, mode: inner.mode });
        else overflow = true;
        inner.resume();
      } });
      pending.push(new Promise((accept, reject) => {
        parser.on("end", accept);
        parser.on("error", reject);
        outer.on("error", reject);
      }));
      outer.pipe(parser);
    }
  });
  await Promise.all(pending);
  assert.equal(overflow, false, "QA_ROOTFS_MEMBER_CAP_EXCEEDED");
  return Object.freeze({ ...evaluateDockerlessRootfsLayers(layers),
    sourceSha256: checked.sha256 });
}
