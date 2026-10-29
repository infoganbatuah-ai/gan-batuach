"""Fail-closed, offline QCOW2 v3 subset converter for disposable synthetic QA.

No guest, network, database, or original backup access. The CLI accepts only
the pinned Ubuntu QA file and a fresh private scratch directory on Kingston.
Unsupported QCOW2 features are rejected, not interpreted optimistically.
This is not enabled by any runner; synthetic tests are not real-image proof.
"""

import argparse
import hashlib
import os
import stat
import struct
import zlib
from pathlib import Path

SOURCE_SHA256 = "50e24e1fb79e89116e939d90aa7738f7af48c442fa1bc2510131e0b39c50348e"
SOURCE_BYTES = 616_522_752
SOURCE_NAME = "ubuntu-24.04-server-cloudimg-arm64.img"
SCRATCH_PREFIX = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.qa-offline-vz-"
MIN_FREE_AFTER_BYTES = 3 * 1024 ** 3
MAX_VIRTUAL_BYTES = 16 * 1024 ** 3
MAX_L1_BYTES = 32 * 1024 ** 2
COPY_FLAG = 1 << 63
COMPRESSED_FLAG = 1 << 62
OFFSET_MASK = ((1 << 56) - 1) & ~511
SF_DATALESS = 0x40000000  # macOS sys/stat.h; do not hydrate iCloud placeholders
ZERO = bytes(2 * 1024 ** 2)


class QACowError(ValueError):
    pass


def require(ok, code):
    if not ok:
        raise QACowError(code)


def read_exact(fd, size, offset, file_size):
    require(0 <= offset <= file_size and 0 <= size <= file_size - offset,
            "QCOW_RANGE_OUTSIDE_SOURCE")
    data = os.pread(fd, size, offset)
    require(len(data) == size, "QCOW_SHORT_READ")
    return data


def parse_header(fd, file_size):
    h = read_exact(fd, 104, 0, file_size)
    require(h[:4] == b"QFI\xfb", "QCOW_MAGIC_INVALID")
    version, = struct.unpack_from(">I", h, 4)
    require(version == 3, "QCOW_VERSION_UNSUPPORTED")
    backing_offset, backing_bytes = struct.unpack_from(">QI", h, 8)
    require(backing_offset == 0 and backing_bytes == 0, "QCOW_BACKING_FILE_DENIED")
    cluster_bits, = struct.unpack_from(">I", h, 20)
    require(9 <= cluster_bits <= 21, "QCOW_CLUSTER_SIZE_UNSUPPORTED")
    cluster = 1 << cluster_bits
    virtual, = struct.unpack_from(">Q", h, 24)
    require(0 < virtual <= MAX_VIRTUAL_BYTES, "QCOW_VIRTUAL_SIZE_UNBOUNDED")
    crypt, l1_size = struct.unpack_from(">II", h, 32)
    require(crypt == 0, "QCOW_ENCRYPTION_UNSUPPORTED")
    require(0 < l1_size <= MAX_L1_BYTES // 8, "QCOW_L1_SIZE_UNBOUNDED")
    l1_offset, = struct.unpack_from(">Q", h, 40)
    snapshots, = struct.unpack_from(">I", h, 60)
    snapshot_offset, = struct.unpack_from(">Q", h, 64)
    require(snapshots == 0 and snapshot_offset == 0, "QCOW_SNAPSHOTS_UNSUPPORTED")
    incompatible, compatible, autoclear = struct.unpack_from(">QQQ", h, 72)
    require(incompatible == compatible == autoclear == 0,
            "QCOW_EXTENDED_FEATURE_UNSUPPORTED")
    header_length, = struct.unpack_from(">I", h, 100)
    require(header_length in (104, 112), "QCOW_HEADER_EXTENSION_UNSUPPORTED")
    if header_length == 112:
        require(read_exact(fd, 8, 104, file_size) == bytes(8),
                "QCOW_ADDITIONAL_FIELD_UNSUPPORTED")
    # The pinned Ubuntu image has one advisory feature-name table followed by
    # an end marker. All actual feature masks above must remain zero.
    extensions = read_exact(fd, cluster - header_length, header_length, file_size)
    cursor = 0
    seen_feature_names = False
    while True:
        require(cursor + 8 <= len(extensions), "QCOW_EXTENSION_TRUNCATED")
        kind, length = struct.unpack_from(">II", extensions, cursor)
        cursor += 8
        if kind == 0:
            require(length == 0 and all(x == 0 for x in extensions[cursor:]),
                    "QCOW_EXTENSION_TRAILING_DATA")
            break
        padded = (length + 7) & ~7
        require(cursor + padded <= len(extensions), "QCOW_EXTENSION_RANGE_INVALID")
        require(kind == 0x6803F857 and not seen_feature_names and
                length > 0 and length % 48 == 0,
                "QCOW_HEADER_EXTENSION_UNSUPPORTED")
        seen_feature_names = True
        require(all(x == 0 for x in extensions[cursor + length:cursor + padded]),
                "QCOW_EXTENSION_PADDING_INVALID")
        cursor += padded
    require(l1_offset >= cluster and l1_offset % cluster == 0,
            "QCOW_L1_OFFSET_INVALID")
    read_exact(fd, l1_size * 8, l1_offset, file_size)
    l2_entries = cluster // 8
    required_l1 = (virtual + cluster * l2_entries - 1) // (cluster * l2_entries)
    require(l1_size >= required_l1, "QCOW_L1_COVERAGE_INSUFFICIENT")
    return cluster, virtual, l1_size, l1_offset


def table_offset(value, cluster, file_size, label):
    require((value & (((1 << 63) - 1) & ~OFFSET_MASK)) == 0,
            f"QCOW_{label}_FLAGS_UNSUPPORTED")
    offset = value & OFFSET_MASK
    if offset:
        require(offset >= cluster and offset % cluster == 0 and
                offset + cluster <= file_size, f"QCOW_{label}_OFFSET_INVALID")
    return offset


def compressed_cluster(fd, file_size, cluster, value):
    require((value & COPY_FLAG) == 0, "QCOW_COMPRESSED_COPY_FLAG_INVALID")
    cluster_bits = cluster.bit_length() - 1
    x = 62 - (cluster_bits - 8)
    offset = value & ((1 << x) - 1)
    sectors = ((value >> x) & ((1 << (62 - x)) - 1)) + 1
    require(0 < offset < (1 << 56) and 0 < sectors <= 2 * cluster // 512,
            "QCOW_COMPRESSED_DESCRIPTOR_INVALID")
    span = sectors * 512 - offset % 512
    require(0 < span <= 2 * cluster, "QCOW_COMPRESSED_SPAN_INVALID")
    data = read_exact(fd, span, offset, file_size)
    try:
        decoder = zlib.decompressobj(wbits=-15)
        result = decoder.decompress(data, cluster + 1)
    except zlib.error as error:
        raise QACowError("QCOW_COMPRESSED_DEFLATE_INVALID") from error
    require(len(result) == cluster and decoder.eof,
            "QCOW_COMPRESSED_OUTPUT_INVALID")
    return result


def raw_clusters(fd, file_size, cluster, virtual, l1_size, l1_offset):
    l1 = read_exact(fd, l1_size * 8, l1_offset, file_size)
    remaining = virtual
    guest_offset = 0
    l2_entries = cluster // 8
    l2_cache = {}
    while remaining:
        index = guest_offset // cluster
        l1_index, l2_index = divmod(index, l2_entries)
        l1_value, = struct.unpack_from(">Q", l1, l1_index * 8)
        l2_offset = table_offset(l1_value & ~COPY_FLAG, cluster, file_size, "L1")
        size = min(cluster, remaining)
        if l2_offset == 0:
            yield guest_offset, ZERO[:size], False
        else:
            if l2_offset not in l2_cache:
                l2_cache[l2_offset] = read_exact(fd, cluster, l2_offset, file_size)
            l2_value, = struct.unpack_from(">Q", l2_cache[l2_offset], l2_index * 8)
            if l2_value & COMPRESSED_FLAG:
                yield guest_offset, compressed_cluster(fd, file_size, cluster,
                                                       l2_value), True
                guest_offset += size
                remaining -= size
                continue
            zero_flag = bool(l2_value & 1)
            data_offset = table_offset(l2_value & ~(COPY_FLAG | 1),
                                       cluster, file_size, "L2")
            require(not (l2_value & COPY_FLAG and data_offset == 0),
                    "QCOW_L2_COPIED_ZERO_OFFSET_INVALID")
            require(not (zero_flag and data_offset),
                    "QCOW_ZERO_PREALLOCATION_UNSUPPORTED")
            if zero_flag or data_offset == 0:
                yield guest_offset, ZERO[:size], False
            else:
                yield guest_offset, read_exact(fd, size, data_offset, file_size), True
        guest_offset += size
        remaining -= size


def hash_fd(fd, size):
    digest = hashlib.sha256()
    offset = 0
    while offset < size:
        data = read_exact(fd, min(2 * 1024 ** 2, size - offset), offset, size)
        digest.update(data)
        offset += len(data)
    return digest.hexdigest()


def convert(fd, output_fd, source_size, expected_sha):
    require(hash_fd(fd, source_size) == expected_sha,
            "QCOW_SOURCE_HASH_MISMATCH")
    cluster, virtual, l1_size, l1_offset = parse_header(fd, source_size)
    os.ftruncate(output_fd, virtual)
    expected_raw = hashlib.sha256()
    for offset, data, allocated in raw_clusters(fd, source_size, cluster,
                                               virtual, l1_size, l1_offset):
        expected_raw.update(data)
        if allocated:
            require(os.pwrite(output_fd, data, offset) == len(data),
                    "QCOW_RAW_SHORT_WRITE")
    os.fsync(output_fd)
    require(hash_fd(output_fd, virtual) == expected_raw.hexdigest(),
            "QCOW_RAW_READBACK_MISMATCH")
    return virtual, expected_raw.hexdigest()


def local_source_stat(path):
    parent = path.parent
    require(parent.is_dir() and not parent.is_symlink(), "QCOW_SOURCE_PARENT_UNSAFE")
    ps = parent.stat()
    require(ps.st_uid == os.getuid() and stat.S_IMODE(ps.st_mode) == 0o700,
            "QCOW_SOURCE_PARENT_UNSAFE")
    s = path.lstat()
    require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and
            s.st_uid == os.getuid() and stat.S_IMODE(s.st_mode) == 0o600 and
            s.st_size == SOURCE_BYTES, "QCOW_SOURCE_FILE_UNSAFE")
    # An iCloud/File Provider placeholder can advertise full length with no
    # allocated blocks. Opening it would hydrate over the network.
    require(s.st_blocks > 0 and not (s.st_flags & SF_DATALESS),
            "QCOW_SOURCE_DATALESS_NO_HYDRATION")
    return s


def run_pinned_cli(scratch):
    scratch = Path(scratch)
    require(str(scratch).startswith(SCRATCH_PREFIX) and
            scratch.resolve() == scratch and not scratch.is_symlink(),
            "QCOW_SCRATCH_PATH_UNSAFE")
    ss = scratch.stat()
    require(stat.S_ISDIR(ss.st_mode) and ss.st_uid == os.getuid() and
            stat.S_IMODE(ss.st_mode) == 0o700, "QCOW_SCRATCH_NOT_PRIVATE")
    source = scratch / SOURCE_NAME
    before = local_source_stat(source)
    free = os.statvfs(scratch).f_bavail * os.statvfs(scratch).f_frsize
    require(free >= MAX_VIRTUAL_BYTES + MIN_FREE_AFTER_BYTES,
            "QCOW_SCRATCH_CAPACITY_UNPROVEN")
    source_fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        scratch_fd = os.open(scratch, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    except BaseException:
        os.close(source_fd)
        raise
    output_name = "ubuntu-qa-boot.raw"
    output_fd = None
    output_inode = None
    try:
        opened = os.fstat(source_fd)
        require(opened.st_ino == before.st_ino and
                opened.st_mtime_ns == before.st_mtime_ns and
                opened.st_ctime_ns == before.st_ctime_ns and
                opened.st_blocks > 0 and not (opened.st_flags & SF_DATALESS),
                "QCOW_SOURCE_CHANGED_BEFORE_READ")
        # Open exclusively only after the source has passed local residency.
        output_fd = os.open(output_name, os.O_RDWR | os.O_CREAT | os.O_EXCL |
                            os.O_NOFOLLOW, 0o600, dir_fd=scratch_fd)
        output_inode = os.fstat(output_fd).st_ino
        result = convert(source_fd, output_fd, opened.st_size, SOURCE_SHA256)
        after = os.fstat(source_fd)
        require((after.st_ino, after.st_size, after.st_mtime_ns,
                 after.st_ctime_ns) ==
                (opened.st_ino, opened.st_size, opened.st_mtime_ns,
                 opened.st_ctime_ns), "QCOW_SOURCE_CHANGED_DURING_READ")
        return result
    except BaseException:
        if output_fd is not None and output_inode is not None:
            try:
                if os.stat(output_name, dir_fd=scratch_fd,
                           follow_symlinks=False).st_ino == output_inode:
                    os.unlink(output_name, dir_fd=scratch_fd)
            except FileNotFoundError:
                pass
        raise
    finally:
        if output_fd is not None:
            os.close(output_fd)
        os.close(source_fd)
        os.close(scratch_fd)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch", required=True)
    args = parser.parse_args()
    try:
        size, digest = run_pinned_cli(args.scratch)
        print(f"QA_RAW_CREATED bytes={size} sha256={digest}")
    except (OSError, QACowError) as error:
        raise SystemExit(f"QA_RAW_BLOCKED: {error}") from None
