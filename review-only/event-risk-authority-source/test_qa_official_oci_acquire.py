"""Disconnected boundary checks for the pinned public OCI acquisition helper."""

import hashlib
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("qa_official_oci_acquire.py")
SPEC = importlib.util.spec_from_file_location("qa_official_oci_acquire", MODULE_PATH)
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)


class OfficialOciAcquireTests(unittest.TestCase):
    def test_unapproved_scratch_path_is_rejected_before_network(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(qa.QAImageError, "QA_OCI_SCRATCH_PATH_UNSAFE"):
                qa.run(directory)

    def test_private_file_rejects_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "target"
            target.write_bytes(b"public")
            target.chmod(0o600)
            link = Path(directory) / "link"
            link.symlink_to(target)
            with self.assertRaisesRegex(qa.QAImageError, "QA_OCI_FILE_NOT_PRIVATE_LOCAL"):
                qa.private_file(link, 100)

    def test_non_arm64_or_incomplete_inventory_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest_path = root / "supabase-postgres-arm64-manifest-raw.json.part"
            config_path = root / "supabase-postgres-arm64-config.json.part"
            config = {"architecture": "amd64", "os": "linux",
                      "rootfs": {"type": "layers", "diff_ids": []}}
            config_bytes = json.dumps(config).encode()
            manifest = {"schemaVersion": 2,
                        "mediaType": "application/vnd.oci.image.manifest.v1+json",
                        "config": {"digest": "sha256:" + hashlib.sha256(config_bytes).hexdigest(),
                                   "size": len(config_bytes)}, "layers": []}
            manifest_bytes = json.dumps(manifest).encode()
            config_path.write_bytes(config_bytes)
            manifest_path.write_bytes(manifest_bytes)
            os.chmod(config_path, 0o600)
            os.chmod(manifest_path, 0o600)
            with patch.object(qa, "MANIFEST_SHA", hashlib.sha256(manifest_bytes).hexdigest()), \
                 patch.object(qa, "CONFIG_SHA", hashlib.sha256(config_bytes).hexdigest()):
                with self.assertRaisesRegex(qa.QAImageError,
                                            "QA_OCI_ARM64_LAYER_INVENTORY_INVALID"):
                    qa.load_pinned_metadata(root)


if __name__ == "__main__":
    unittest.main()
