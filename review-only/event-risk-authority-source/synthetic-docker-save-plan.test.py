"""Small hostile Docker-save fixtures; never opens an actual QA archive."""

import hashlib
import importlib.util
import io
import json
import pathlib
import sys
import tarfile
import unittest


MODULE = pathlib.Path(__file__).with_name("synthetic-docker-save-plan.py")
SPEC = importlib.util.spec_from_file_location("synthetic_docker_save_plan", MODULE)
planner = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = planner
SPEC.loader.exec_module(planner)


def tar_bytes(entries):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w") as archive:
        for name, data, kind in entries:
            info = tarfile.TarInfo(name)
            info.type = kind
            info.size = len(data) if kind == tarfile.REGTYPE else 0
            archive.addfile(info, io.BytesIO(data) if kind == tarfile.REGTYPE else None)
    return output.getvalue()


def fixture(*, config_change=None, manifest_change=None, extra=(), replace=None):
    layer = tar_bytes([("fixture", b"x", tarfile.REGTYPE)])
    digest = hashlib.sha256(layer).hexdigest()
    names = [f"layers/{index:064x}/layer.tar" for index in range(29)]
    config = {"architecture": "arm64", "os": "linux",
              "rootfs": {"type": "layers", "diff_ids": ["sha256:" + digest] * 29}}
    if config_change:
        config_change(config)
    config_data = json.dumps(config, separators=(",", ":")).encode()
    config_name = hashlib.sha256(config_data).hexdigest() + ".json"
    manifest = [{"Config": config_name, "RepoTags": [planner.SYNTHETIC_TAG],
                 "Layers": names}]
    if manifest_change:
        manifest_change(manifest)
    manifest_data = json.dumps(manifest, separators=(",", ":")).encode()
    entries = [("manifest.json", manifest_data, tarfile.REGTYPE),
               (config_name, config_data, tarfile.REGTYPE)]
    entries += [(name, layer, tarfile.REGTYPE) for name in names]
    if replace:
        entries = [replace.get(name, (name, data, kind)) for name, data, kind in entries]
    archive = tar_bytes(entries + list(extra))
    return archive, hashlib.sha256(archive).hexdigest()


class PlannerTest(unittest.TestCase):
    def plan(self, data, digest, purpose="synthetic-fixture-only"):
        return planner.plan_synthetic_docker_save(data, digest, purpose=purpose)

    def test_valid_order_and_digest_pin(self):
        data, digest = fixture()
        plan = self.plan(data, digest)
        self.assertEqual(plan["status"], "SYNTHETIC_PLAN_ONLY")
        self.assertEqual([item.index for item in plan["layers"]], list(range(29)))
        self.assertEqual(plan["layer_count"], 29)
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "ARCHIVE_DIGEST"):
            self.plan(data, "0" * 64)
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "SYNTHETIC_PURPOSE"):
            self.plan(data, digest, "real-qa")

    def test_wrong_architecture_and_diff_id(self):
        for change, expected in [
            (lambda c: c.update(architecture="amd64"), "CONFIG_SHAPE"),
            (lambda c: c["rootfs"]["diff_ids"].__setitem__(9, "sha256:" + "0" * 64),
             "LAYER_DIFF_ID"),
        ]:
            with self.subTest(expected=expected):
                data, digest = fixture(config_change=change)
                with self.assertRaisesRegex(planner.UnsafeDockerSave, expected):
                    self.plan(data, digest)

    def test_missing_duplicate_and_unexpected_entries(self):
        data, digest = fixture(extra=[("bad", b"x", tarfile.REGTYPE)])
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "ENTRY_UNEXPECTED"):
            self.plan(data, digest)
        data, digest = fixture(extra=[("manifest.json", b"x", tarfile.REGTYPE)])
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "ENTRY_INVALID"):
            self.plan(data, digest)
        data, digest = fixture(manifest_change=lambda m: m[0]["Layers"].pop())
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "MANIFEST_REFERENCE"):
            self.plan(data, digest)

    def test_symlink_and_traversal_are_denied(self):
        data, digest = fixture(replace={"manifest.json":
            ("manifest.json", b"", tarfile.SYMTYPE)})
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "ENTRY_INVALID"):
            self.plan(data, digest)

    def test_duplicate_json_key_and_tampered_layer_are_denied(self):
        data, digest = fixture(replace={"manifest.json":
            ("manifest.json", b'{"a":1,"a":2}', tarfile.REGTYPE)})
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "DUPLICATE_JSON_KEY"):
            self.plan(data, digest)
        first_layer = f"layers/{0:064x}/layer.tar"
        data, digest = fixture(replace={first_layer:
            (first_layer, b"tampered", tarfile.REGTYPE)})
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "LAYER_DIFF_ID_MISMATCH"):
            self.plan(data, digest)
        data, digest = fixture(extra=[("../escape", b"x", tarfile.REGTYPE)])
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "ENTRY_INVALID"):
            self.plan(data, digest)

    def test_large_input_is_rejected_before_tar_parse(self):
        data = b"x" * (planner.MAX_ARCHIVE_BYTES + 1)
        with self.assertRaisesRegex(planner.UnsafeDockerSave, "ARCHIVE_BUDGET"):
            self.plan(data, hashlib.sha256(data).hexdigest())


if __name__ == "__main__":
    unittest.main()
