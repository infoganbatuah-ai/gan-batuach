"""Adversarial local fixtures only; never reads the approved QA archive."""

import hashlib
import importlib.util
import io
import os
import pathlib
import secrets
import shutil
import stat
import sys
import tarfile
import tempfile
import unittest
from unittest import mock


MODULE = pathlib.Path(__file__).with_name("synthetic-rootfs-extractor.py")
SPEC = importlib.util.spec_from_file_location("synthetic_rootfs_extractor", MODULE)
extractor = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = extractor
SPEC.loader.exec_module(extractor)


def layer(index, entries):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        for item in entries:
            name = item[0]
            kind = item[1]
            value = item[2] if len(item) > 2 else None
            info = tarfile.TarInfo(name)
            info.uid = item[4] if len(item) > 4 else 0
            info.gid = 0
            info.mode = item[3] if len(item) > 3 else 0o644
            if kind == "file":
                content = value if isinstance(value, bytes) else b"fixture"
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
            elif kind == "dir":
                info.type = tarfile.DIRTYPE
                archive.addfile(info)
            elif kind == "symlink":
                info.type = tarfile.SYMTYPE
                info.linkname = value
                archive.addfile(info)
            elif kind == "hardlink":
                info.type = tarfile.LNKTYPE
                info.linkname = value
                archive.addfile(info)
            elif kind == "fifo":
                info.type = tarfile.FIFOTYPE
                archive.addfile(info)
            elif kind == "device":
                info.type = tarfile.CHRTYPE
                archive.addfile(info)
            else:
                raise AssertionError(kind)
    data = buffer.getvalue()
    return extractor.SyntheticLayer(index, data, hashlib.sha256(data).hexdigest())


class ExtractorTest(unittest.TestCase):
    def setUp(self):
        self.parent = tempfile.mkdtemp(prefix="do-qa-synthetic-parent-")
        self.target = os.path.join(self.parent,
            "do-qa-synthetic-rootfs-" + secrets.token_hex(12))
        os.mkdir(self.target, 0o700)
        self.sentinel = os.path.join(self.parent, "outside-sentinel")
        pathlib.Path(self.sentinel).write_bytes(b"outside must stay unchanged")

    def tearDown(self):
        self.assertEqual(pathlib.Path(self.sentinel).read_bytes(),
                         b"outside must stay unchanged")
        shutil.rmtree(self.parent)

    def extract(self, *layers, fault_after=None):
        return extractor.extract_synthetic_layers(list(layers), self.parent,
            self.target, purpose="synthetic-fixture-only", fault_after=fault_after)

    def test_regular_hardlink_absolute_symlink_and_mode_stripping(self):
        receipt = self.extract(layer(0, [
            ("usr", "dir"), ("usr/bin", "dir"),
            ("usr/bin/tool", "file", b"safe", 0o7777),
            ("bin", "dir"),
            ("bin/tool-link", "symlink", "/usr/bin/tool"),
            ("bin/tool-relative", "symlink", "../usr/bin/tool"),
            ("bin/tool-hard", "hardlink", "usr/bin/tool")
        ]))
        self.assertEqual(receipt["status"], "SYNTHETIC_ONLY")
        self.assertEqual(pathlib.Path(self.target, "usr/bin/tool").read_bytes(), b"safe")
        self.assertEqual(os.readlink(os.path.join(self.target, "bin/tool-link")),
                         "../usr/bin/tool")
        self.assertEqual(pathlib.Path(self.target, "bin/tool-relative").read_bytes(), b"safe")
        self.assertEqual(os.stat(os.path.join(self.target, "bin/tool-hard")).st_ino,
                         os.stat(os.path.join(self.target, "usr/bin/tool")).st_ino)
        self.assertEqual(stat.S_IMODE(os.stat(os.path.join(self.target,
            "usr/bin/tool")).st_mode), 0o755)
        extractor.rollback_synthetic_target(self.parent, self.target,
            receipt["target_inode"], receipt["target_device"])
        self.assertFalse(os.path.exists(self.target))

    def test_whiteout_and_opaque_apply_only_to_lower_layers(self):
        self.extract(layer(0, [("data", "dir"), ("data/old", "file"),
                               ("data/keep", "file")]),
                     layer(1, [("data/.wh.old", "file", b""),
                               ("data/new", "file")]),
                     layer(2, [("data/.wh..wh..opq", "file", b""),
                               ("data/latest", "file")]))
        self.assertEqual(os.listdir(os.path.join(self.target, "data")), ["latest"])

    def test_same_layer_whiteout_precedes_new_file_and_symlink_can_be_replaced_by_dir(self):
        self.extract(layer(0, [("data", "dir"), ("data/old", "file"),
                               ("redir", "symlink", "/data")]),
                     layer(1, [("data/new", "file"),
                               ("data/.wh.old", "file", b""),
                               ("redir", "dir"),
                               ("redir/child", "file")]))
        self.assertEqual(os.listdir(os.path.join(self.target, "data")), ["new"])
        self.assertEqual(pathlib.Path(self.target, "redir/child").read_bytes(), b"fixture")

    def test_traversal_special_nodes_duplicate_order_and_wrong_digest_precede_writes(self):
        bad = [
            layer(0, [("../outside-sentinel", "file", b"evil")]),
            layer(0, [("/outside-sentinel", "file", b"evil")]),
            layer(0, [("a/../../outside-sentinel", "file", b"evil")]),
            layer(0, [("dev/evil", "device")]),
            layer(0, [("pipe", "fifo")]),
            layer(0, [("dup", "file"), ("dup", "file")]),
        ]
        for item in bad:
            with self.subTest(item=item.sha256):
                with self.assertRaises(extractor.UnsafeLayer):
                    self.extract(item)
                self.assertEqual(os.listdir(self.target), [])
        with self.assertRaisesRegex(extractor.UnsafeLayer, "LAYER_ORDER"):
            self.extract(layer(1, [("okay", "file")]))
        wrong = layer(0, [("okay", "file")])
        with self.assertRaisesRegex(extractor.UnsafeLayer, "DIGEST"):
            self.extract(extractor.SyntheticLayer(0, wrong.data, "0" * 64))

    def test_relative_and_absolute_symlink_escape_rejected(self):
        for link in ("../../outside-sentinel", "/../../outside-sentinel"):
            with self.subTest(link=link):
                with self.assertRaisesRegex(extractor.UnsafeLayer, "LINK_ESCAPE"):
                    self.extract(layer(0, [("a/link", "symlink", link)]))
                self.assertEqual(os.listdir(self.target), [])

    def test_write_through_symlink_parent_is_denied_and_rolled_back(self):
        for link in ("/usr", "usr"):
            with self.subTest(link=link):
                with self.assertRaises(OSError):
                    self.extract(layer(0, [("usr", "dir"),
                                          ("redir", "symlink", link)]),
                                 layer(1, [("redir/payload", "file", b"evil")]))
                self.assertFalse(os.path.exists(self.target))
                os.mkdir(self.target, 0o700)

    def test_hardlink_to_symlink_is_denied_and_rolled_back(self):
        with self.assertRaisesRegex(extractor.UnsafeLayer, "HARDLINK_SOURCE"):
            self.extract(layer(0, [("source", "symlink", "/usr"),
                                   ("copy", "hardlink", "source")]))
        self.assertFalse(os.path.exists(self.target))

    def test_mid_layer_fault_rolls_back_exact_target(self):
        with self.assertRaisesRegex(extractor.UnsafeLayer, "INJECTED_FAILURE"):
            self.extract(layer(0, [("one", "file"), ("two", "file")]),
                         fault_after=1)
        self.assertFalse(os.path.exists(self.target))

    def test_wrong_inode_cannot_clean_target(self):
        receipt = self.extract(layer(0, [("one", "file")]))
        with self.assertRaisesRegex(extractor.UnsafeLayer, "TARGET_CHANGED"):
            extractor.rollback_synthetic_target(self.parent, self.target,
                receipt["target_inode"] + 1, receipt["target_device"])
        self.assertTrue(os.path.exists(os.path.join(self.target, "one")))

    def test_nonempty_or_wrong_mode_target_is_denied_without_touching_it(self):
        pathlib.Path(self.target, "existing").write_bytes(b"keep")
        with self.assertRaisesRegex(extractor.UnsafeLayer, "TARGET_NOT_EMPTY"):
            self.extract(layer(0, [("new", "file")]))
        self.assertEqual(pathlib.Path(self.target, "existing").read_bytes(), b"keep")
        pathlib.Path(self.target, "existing").unlink()
        os.chmod(self.target, 0o777)
        with self.assertRaisesRegex(extractor.UnsafeLayer, "TARGET_NOT_EMPTY"):
            self.extract(layer(0, [("new", "file")]))

    def test_symlink_target_and_nonprivate_parent_are_rejected(self):
        shutil.rmtree(self.target)
        os.symlink(self.parent, self.target)
        with self.assertRaises(OSError):
            self.extract(layer(0, [("new", "file")]))
        os.unlink(self.target)
        os.mkdir(self.target, 0o700)
        os.chmod(self.parent, 0o777)
        with self.assertRaisesRegex(extractor.UnsafeLayer, "PARENT_NOT_PRIVATE"):
            self.extract(layer(0, [("new", "file")]))
        os.chmod(self.parent, 0o700)

    def test_resource_and_owner_bounds_deny_before_writes(self):
        with self.assertRaisesRegex(extractor.UnsafeLayer, "LAYER_SIZE"):
            self.extract(extractor.SyntheticLayer(0, b"x" * (8 * 1024 * 1024 + 1),
                hashlib.sha256(b"x" * (8 * 1024 * 1024 + 1)).hexdigest()))
        with self.assertRaisesRegex(extractor.UnsafeLayer, "METADATA_INVALID"):
            self.extract(layer(0, [("bad-owner", "file", b"x", 0o644, 70000)]))
        with self.assertRaisesRegex(extractor.UnsafeLayer, "PATH_TRAVERSAL"):
            self.extract(layer(0, [("copy", "hardlink", "../outside-sentinel")]))
        with self.assertRaisesRegex(extractor.UnsafeLayer, "MEMBER_CAP"):
            self.extract(layer(0, [(f"m/{index}", "file", b"")
                                   for index in range(4097)]))
        self.assertEqual(os.listdir(self.target), [])

    def test_real_qa_entrypoint_is_still_disabled(self):
        self.assertIsNone(extractor.APPROVED_REAL_QA_EXTRACTOR)
        with self.assertRaisesRegex(extractor.UnsafeLayer, "REAL_QA_EXTRACTOR_DISABLED"):
            extractor.extract_approved_qa_rootfs("/real/archive", self.target)
        self.assertEqual(os.listdir(self.target), [])

    def test_intermediate_parent_swap_cannot_redirect_extraction(self):
        outer = tempfile.mkdtemp(prefix="do-qa-parent-race-")
        moved = outer + "-moved"
        other = tempfile.mkdtemp(prefix="do-qa-parent-other-")
        target_name = "do-qa-synthetic-rootfs-" + secrets.token_hex(12)
        for base in (outer, other):
            os.mkdir(os.path.join(base, "inner"), 0o700)
            os.mkdir(os.path.join(base, "inner", target_name), 0o700)
        external = pathlib.Path(other, "inner", "sentinel")
        external.write_bytes(b"do not touch")
        intended_parent = os.path.join(outer, "inner")
        intended_target = os.path.join(intended_parent, target_name)
        original_open = os.open
        swapped = False

        def swap_before_open(path, flags, mode=0o777, *, dir_fd=None):
            nonlocal swapped
            if not swapped and (path == intended_parent or
                                (path == os.path.basename(outer) and dir_fd is not None)):
                os.rename(outer, moved)
                os.symlink(other, outer)
                swapped = True
            return original_open(path, flags, mode, dir_fd=dir_fd)

        try:
            with mock.patch.object(extractor.os, "open", side_effect=swap_before_open):
                with self.assertRaises(OSError):
                    extractor.extract_synthetic_layers(
                        [layer(0, [("payload", "file", b"wrong target")])],
                        intended_parent, intended_target, purpose="synthetic-fixture-only")
            self.assertTrue(swapped)
            self.assertEqual(external.read_bytes(), b"do not touch")
            self.assertEqual(os.listdir(os.path.join(other, "inner", target_name)), [])
            self.assertEqual(os.listdir(os.path.join(moved, "inner", target_name)), [])
        finally:
            if os.path.islink(outer):
                os.unlink(outer)
            if os.path.isdir(outer):
                shutil.rmtree(outer)
            if os.path.isdir(moved):
                shutil.rmtree(moved)
            shutil.rmtree(other)

    def test_rollback_does_not_delete_swapped_directory(self):
        receipt = self.extract(layer(0, [("tree", "dir"),
                                        ("tree/old", "file", b"original")]))
        external = os.path.join(self.parent, "external-dir")
        os.mkdir(external, 0o700)
        external_sentinel = pathlib.Path(external, "sentinel")
        external_sentinel.write_bytes(b"external must survive")
        old_tree = os.path.join(self.target, "tree")
        original_open = os.open
        swapped = False

        def swap_directory_before_open(path, flags, mode=0o777, *, dir_fd=None):
            nonlocal swapped
            if path == "tree" and dir_fd is not None and not swapped:
                os.rename(old_tree, old_tree + "-moved")
                os.rename(external, old_tree)
                swapped = True
            return original_open(path, flags, mode, dir_fd=dir_fd)

        try:
            with mock.patch.object(extractor.os, "open", side_effect=swap_directory_before_open):
                with self.assertRaises(extractor.UnsafeLayer):
                    extractor.rollback_synthetic_target(self.parent, self.target,
                        receipt["target_inode"], receipt["target_device"])
            self.assertTrue(swapped)
            self.assertEqual(pathlib.Path(old_tree, "sentinel").read_bytes(),
                             b"external must survive")
        finally:
            if os.path.isdir(old_tree) and not os.path.exists(external):
                os.rename(old_tree, external)

    def test_pax_override_escape_and_gnu_sparse_type_are_denied(self):
        pax = io.BytesIO()
        with tarfile.open(fileobj=pax, mode="w", format=tarfile.PAX_FORMAT) as archive:
            info = tarfile.TarInfo("harmless")
            info.pax_headers = {"path": "../outside-sentinel"}
            info.size = 4
            archive.addfile(info, io.BytesIO(b"evil"))
        pax_data = pax.getvalue()
        with self.assertRaisesRegex(extractor.UnsafeLayer, "PATH_TRAVERSAL"):
            self.extract(extractor.SyntheticLayer(0, pax_data,
                hashlib.sha256(pax_data).hexdigest()))
        self.assertEqual(os.listdir(self.target), [])

        sparse = io.BytesIO()
        with tarfile.open(fileobj=sparse, mode="w", format=tarfile.GNU_FORMAT) as archive:
            info = tarfile.TarInfo("sparse")
            info.type = tarfile.GNUTYPE_SPARSE
            archive.addfile(info)
        sparse_data = sparse.getvalue()
        with self.assertRaises(extractor.UnsafeLayer):
            self.extract(extractor.SyntheticLayer(0, sparse_data,
                hashlib.sha256(sparse_data).hexdigest()))
        self.assertEqual(os.listdir(self.target), [])

        pax_sparse = io.BytesIO()
        with tarfile.open(fileobj=pax_sparse, mode="w", format=tarfile.PAX_FORMAT) as archive:
            info = tarfile.TarInfo("pax-sparse")
            info.size = 4
            info.pax_headers = {"GNU.sparse.map": "0,4", "GNU.sparse.size": "4"}
            archive.addfile(info, io.BytesIO(b"data"))
        sparse_data = pax_sparse.getvalue()
        with self.assertRaisesRegex(extractor.UnsafeLayer, "SPARSE"):
            self.extract(extractor.SyntheticLayer(0, sparse_data,
                hashlib.sha256(sparse_data).hexdigest()))
        self.assertEqual(os.listdir(self.target), [])


if __name__ == "__main__":
    unittest.main()
