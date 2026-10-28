"""Synthetic-only tests; never open the pinned cloud-image placeholder."""

import hashlib
import os
import struct
import tempfile
import unittest

from qa_qcow2_to_raw import QACowError, convert, parse_header, raw_clusters


CLUSTER = 512


def fixture(*, backing=0, crypt=0, snapshots=0, incompatible=0,
            data_entry=None, l1_entry=None, extension=False):
    # Header, L1, L2 and guest payload occupy four independent clusters.
    image = bytearray(4 * CLUSTER)
    image[:4] = b"QFI\xfb"
    struct.pack_into(">I", image, 4, 3)
    struct.pack_into(">QI", image, 8, backing, 0)
    struct.pack_into(">IQIIQ", image, 20, 9, 2 * CLUSTER, crypt, 1, CLUSTER)
    struct.pack_into(">I", image, 60, snapshots)
    struct.pack_into(">Q", image, 64, 0)
    struct.pack_into(">QQQ", image, 72, incompatible, 0, 0)
    struct.pack_into(">I", image, 100, 104)
    if extension:
        image[104] = 1
    struct.pack_into(">Q", image, CLUSTER,
                     2 * CLUSTER if l1_entry is None else l1_entry)
    struct.pack_into(">Q", image, 2 * CLUSTER,
                     3 * CLUSTER if data_entry is None else data_entry)
    image[3 * CLUSTER:4 * CLUSTER] = b"A" * CLUSTER
    return bytes(image)


class SyntheticQCowTests(unittest.TestCase):
    def parse(self, data):
        with tempfile.TemporaryFile() as source:
            source.write(data)
            source.flush()
            return parse_header(source.fileno(), len(data))

    def test_one_mapped_and_one_sparse_cluster(self):
        data = fixture()
        with tempfile.TemporaryFile() as source, tempfile.TemporaryFile() as raw:
            source.write(data)
            source.flush()
            size, digest = convert(source.fileno(), raw.fileno(), len(data),
                                   hashlib.sha256(data).hexdigest())
            expected = b"A" * CLUSTER + bytes(CLUSTER)
            self.assertEqual(size, len(expected))
            self.assertEqual(digest, hashlib.sha256(expected).hexdigest())
            self.assertEqual(os.pread(raw.fileno(), size, 0), expected)

    def test_source_hash_is_mandatory(self):
        data = fixture()
        with tempfile.TemporaryFile() as source, tempfile.TemporaryFile() as raw:
            source.write(data)
            source.flush()
            with self.assertRaisesRegex(QACowError, "QCOW_SOURCE_HASH_MISMATCH"):
                convert(source.fileno(), raw.fileno(), len(data), "0" * 64)
            self.assertEqual(os.fstat(raw.fileno()).st_size, 0)

    def test_unsupported_header_features_fail_closed(self):
        cases = [
            (dict(backing=512), "QCOW_BACKING_FILE_DENIED"),
            (dict(crypt=1), "QCOW_ENCRYPTION_UNSUPPORTED"),
            (dict(snapshots=1), "QCOW_SNAPSHOTS_UNSUPPORTED"),
            (dict(incompatible=1), "QCOW_EXTENDED_FEATURE_UNSUPPORTED"),
            (dict(extension=True), "QCOW_HEADER_EXTENSION_UNSUPPORTED"),
        ]
        for options, code in cases:
            with self.subTest(code=code), self.assertRaisesRegex(QACowError, code):
                self.parse(fixture(**options))

    def test_unsupported_cluster_entries_fail_closed(self):
        cases = [
            (dict(data_entry=(1 << 62) | 3 * CLUSTER),
             "QCOW_COMPRESSED_CLUSTER_UNSUPPORTED"),
            (dict(data_entry=(1 << 63)),
             "QCOW_L2_COPIED_ZERO_OFFSET_INVALID"),
            (dict(data_entry=1 | 3 * CLUSTER),
             "QCOW_ZERO_PREALLOCATION_UNSUPPORTED"),
            (dict(data_entry=4 * CLUSTER), "QCOW_L2_OFFSET_INVALID"),
            (dict(l1_entry=4 * CLUSTER), "QCOW_L1_OFFSET_INVALID"),
        ]
        for options, code in cases:
            with self.subTest(code=code), tempfile.TemporaryFile() as source:
                data = fixture(**options)
                source.write(data)
                source.flush()
                fields = parse_header(source.fileno(), len(data))
                with self.assertRaisesRegex(QACowError, code):
                    list(raw_clusters(source.fileno(), len(data), *fields))


if __name__ == "__main__":
    unittest.main()
