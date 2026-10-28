import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDockerlessRootfsLayers, inspectDockerlessRootfsMetadata } from
  "./dockerless-rootfs-preflight.mjs";

const layers = () => Array.from({ length: 29 }, (_, index) => ({
  path: `layers/${String(index).padStart(2, "0")}/layer.tar`, entries: [] }));
const meta = { uid: 0, gid: 0, mode: 0o644 };
const file = path => ({ path, type: "File", size: 1, ...meta });
const directory = path => ({ path, type: "Directory", size: 0, ...meta });
const symlink = (path, linkpath) => ({ path, type: "SymbolicLink", linkpath,
  size: 0, ...meta });

test("metadata contract remains non-executable and enforces 29 ordered layers", () => {
  const input = layers();
  input[0].entries.push(directory("usr"), file("usr/base"));
  input[1].entries.push(symlink("bin", "/usr/bin"));
  const result = evaluateDockerlessRootfsLayers(input);
  assert.equal(result.status, "OFFLINE_METADATA_ONLY");
  assert.equal(result.extractionAuthorized, false);
  assert.equal(result.layerCount, 29);
  assert.equal(result.symlinks, 1);
  assert.throws(() => evaluateDockerlessRootfsLayers(input.slice(0, 28)),
    /QA_ROOTFS_LAYER_COUNT_INVALID/);
  input[1].path = "layers/02/layer.tar";
  assert.throws(() => evaluateDockerlessRootfsLayers(input),
    /QA_ROOTFS_LAYER_ORDER_INVALID/);
});

test("path traversal, special nodes and duplicate members fail closed", () => {
  for (const entry of [
    file("../escape"), file("/etc/passwd"), file("a/../../escape"),
    file("a//b"), file("a/./b"), file("a\\b"),
    { path: "dev/mem", type: "CharacterDevice", size: 0, ...meta },
    { path: "pipe", type: "FIFO", size: 0, ...meta }
  ]) {
    const input = layers();
    input[0].entries.push(entry);
    assert.throws(() => evaluateDockerlessRootfsLayers(input),
      /QA_ROOTFS_(PATH|SPECIAL_NODE)/);
  }
  const duplicate = layers();
  duplicate[0].entries.push(file("same"), file("same"));
  assert.throws(() => evaluateDockerlessRootfsLayers(duplicate),
    /QA_ROOTFS_DUPLICATE_MEMBER/);
});

test("symlink escape and writes through a symlink parent are denied", () => {
  const escape = layers();
  escape[0].entries.push(symlink("var/link", "../../../host"));
  assert.throws(() => evaluateDockerlessRootfsLayers(escape), /QA_ROOTFS_LINK_ESCAPE/);
  const parent = layers();
  parent[0].entries.push(symlink("bin", "/usr/bin"));
  parent[1].entries.push(file("bin/untrusted"));
  assert.throws(() => evaluateDockerlessRootfsLayers(parent),
    /QA_ROOTFS_SYMLINK_PARENT_WRITE/);
  const hardlink = layers();
  hardlink[0].entries.push({ path: "escape", type: "Link", linkpath: "../host",
    size: 0, ...meta });
  assert.throws(() => evaluateDockerlessRootfsLayers(hardlink),
    /QA_ROOTFS_PATH_TRAVERSAL/);
});

test("whiteouts and opaque directories affect only lower layers", () => {
  const input = layers();
  input[0].entries.push(directory("data"), file("data/old"), file("data/another"));
  input[1].entries.push(file("data/.wh..wh..opq"), file("data/new"));
  input[1].entries[0].size = 0;
  const result = evaluateDockerlessRootfsLayers(input);
  assert.equal(result.whiteouts, 1);
  assert.equal(result.finalPaths, 2); // data directory and new file

  const deletion = layers();
  deletion[0].entries.push(directory("data"), file("data/old"));
  deletion[1].entries.push({ path: "data/.wh.old", type: "File", size: 0, ...meta });
  assert.equal(evaluateDockerlessRootfsLayers(deletion).finalPaths, 1);
  deletion[1].entries[0].size = 1;
  assert.throws(() => evaluateDockerlessRootfsLayers(deletion),
    /QA_ROOTFS_WHITEOUT_SIZE_INVALID/);
});

test("ownership, privileged modes and byte bounds are explicit metadata gates", () => {
  const input = layers();
  input[0].entries.push({ ...file("bin/tool"), mode: 0o4755 });
  assert.equal(evaluateDockerlessRootfsLayers(input).privilegedModes, 1);
  for (const bad of [
    { uid: -1 }, { gid: 70_000 }, { mode: 0o10000 },
    { size: 256 * 1024 ** 2 + 1 }
  ]) {
    input[0].entries[0] = { ...file("bin/tool"), ...bad };
    assert.throws(() => evaluateDockerlessRootfsLayers(input),
      /QA_ROOTFS_METADATA_INVALID/);
  }
  input[0].entries = Array.from({ length: 9 }, (_, index) => ({
    ...file(`bulk/${index}`), size: 256 * 1024 ** 2 }));
  assert.throws(() => evaluateDockerlessRootfsLayers(input),
    /QA_ROOTFS_BYTE_CAP_EXCEEDED/);
});

test("actual archive inspection requires a previously verified outer Docker-save", async () => {
  await assert.rejects(inspectDockerlessRootfsMetadata({ tarPath: "/nonexistent" }),
    /QA_ROOTFS_OUTER_ARCHIVE_UNVERIFIED/);
});
