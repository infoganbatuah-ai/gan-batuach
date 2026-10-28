"""Small synthetic-only OCI-layer extractor; never wired to the QA runner.

This exercises anchored filesystem operations on disposable local fixtures.
The real 1.33-GB Supabase archive cannot enter this API (32-MiB input cap), and
the real-QA entrypoint remains permanently disabled pending separate review.
"""

from __future__ import annotations

import hashlib
import io
import os
import posixpath
import re
import stat
import tarfile
import tempfile
from dataclasses import dataclass


APPROVED_REAL_QA_EXTRACTOR = None
MAX_LAYERS = 29
MAX_LAYER_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 32 * 1024 * 1024
MAX_MEMBERS = 4096
MAX_MEMBER_BYTES = 4 * 1024 * 1024
_DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
_NAME = re.compile(r"do-qa-synthetic-rootfs-[a-f0-9]{24}$")


class UnsafeLayer(ValueError):
    pass


@dataclass(frozen=True)
class SyntheticLayer:
    index: int
    data: bytes
    sha256: str


def _path(value: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 4096:
        raise UnsafeLayer("SYNTHETIC_PATH_INVALID")
    if value.startswith("/") or "\\" in value or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise UnsafeLayer("SYNTHETIC_PATH_INVALID")
    clean = value.rstrip("/")
    parts = clean.split("/")
    if not clean or len(parts) > 64 or any(p in ("", ".", "..") for p in parts):
        raise UnsafeLayer("SYNTHETIC_PATH_TRAVERSAL")
    return clean


def _symlink_target(path: str, value: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 4096 or "\\" in value:
        raise UnsafeLayer("SYNTHETIC_LINK_INVALID")
    if any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise UnsafeLayer("SYNTHETIC_LINK_INVALID")
    parent = posixpath.dirname(path) or "."
    rooted = value.lstrip("/") if value.startswith("/") else posixpath.join(parent, value)
    resolved = posixpath.normpath(rooted)
    if resolved == ".." or resolved.startswith("../") or resolved.startswith("/"):
        raise UnsafeLayer("SYNTHETIC_LINK_ESCAPE")
    # Rewrite absolute container links to a relative link inside this scratch
    # root; host absolute links must never be emitted.
    return posixpath.relpath(resolved, parent)


def _validate(layers: list[SyntheticLayer]) -> list[list[tarfile.TarInfo]]:
    if not isinstance(layers, list) or not 1 <= len(layers) <= MAX_LAYERS:
        raise UnsafeLayer("SYNTHETIC_LAYER_COUNT_INVALID")
    total = members = 0
    planned = []
    for index, layer in enumerate(layers):
        if not isinstance(layer, SyntheticLayer) or layer.index != index:
            raise UnsafeLayer("SYNTHETIC_LAYER_ORDER_INVALID")
        if not isinstance(layer.data, bytes) or not 0 < len(layer.data) <= MAX_LAYER_BYTES:
            raise UnsafeLayer("SYNTHETIC_LAYER_SIZE_INVALID")
        total += len(layer.data)
        if total > MAX_TOTAL_BYTES or hashlib.sha256(layer.data).hexdigest() != layer.sha256:
            raise UnsafeLayer("SYNTHETIC_LAYER_DIGEST_OR_BUDGET_INVALID")
        try:
            with tarfile.open(fileobj=io.BytesIO(layer.data), mode="r:") as archive:
                entries = archive.getmembers()
        except tarfile.TarError as error:
            raise UnsafeLayer("SYNTHETIC_LAYER_TAR_INVALID") from error
        seen = set()
        for entry in entries:
            members += 1
            if members > MAX_MEMBERS:
                raise UnsafeLayer("SYNTHETIC_MEMBER_CAP_EXCEEDED")
            name = _path(entry.name)
            if name in seen:
                raise UnsafeLayer("SYNTHETIC_DUPLICATE_MEMBER")
            seen.add(name)
            if entry.type not in (tarfile.REGTYPE, tarfile.AREGTYPE,
                                  tarfile.DIRTYPE, tarfile.SYMTYPE, tarfile.LNKTYPE):
                raise UnsafeLayer("SYNTHETIC_SPECIAL_NODE_DENIED")
            if not (0 <= entry.uid <= 65535 and 0 <= entry.gid <= 65535 and
                    0 <= entry.mode <= 0o7777 and 0 <= entry.size <= MAX_MEMBER_BYTES):
                raise UnsafeLayer("SYNTHETIC_METADATA_INVALID")
            base = posixpath.basename(name)
            if base.startswith(".wh."):
                if not entry.isfile() or entry.size != 0 or base == ".wh.":
                    raise UnsafeLayer("SYNTHETIC_WHITEOUT_INVALID")
            elif entry.issym():
                _symlink_target(name, entry.linkname)
            elif entry.islnk():
                _path(entry.linkname)  # tar hardlinks are archive-root relative
        planned.append(entries)
    return planned


def _open_dir(root_fd: int, path: str, create: bool = False) -> int:
    fd = os.dup(root_fd)
    try:
        if path in ("", "."):
            return fd
        for part in path.split("/"):
            try:
                next_fd = os.open(part, _DIR_FLAGS, dir_fd=fd)
            except FileNotFoundError:
                if not create:
                    raise
                os.mkdir(part, 0o700, dir_fd=fd)
                next_fd = os.open(part, _DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd
    except BaseException:
        os.close(fd)
        raise


def _remove_at(parent_fd: int, name: str, budget: list[int]) -> None:
    try:
        info = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
    except FileNotFoundError:
        return
    budget[0] += 1
    if budget[0] > MAX_MEMBERS * 3:
        raise UnsafeLayer("SYNTHETIC_CLEANUP_CAP_EXCEEDED")
    if stat.S_ISDIR(info.st_mode):
        child_fd = os.open(name, _DIR_FLAGS, dir_fd=parent_fd)
        try:
            for child in os.listdir(child_fd):
                _remove_at(child_fd, child, budget)
        finally:
            os.close(child_fd)
        os.rmdir(name, dir_fd=parent_fd)
    else:
        os.unlink(name, dir_fd=parent_fd)


def _target_fds(parent: str, target: str) -> tuple[int, int, str, os.stat_result]:
    if not isinstance(parent, str) or not isinstance(target, str):
        raise UnsafeLayer("SYNTHETIC_TARGET_INVALID")
    parent = os.path.realpath(parent)
    scratch = os.path.realpath(tempfile.gettempdir())
    if os.path.commonpath((parent, scratch)) != scratch or \
            os.path.realpath(os.path.dirname(target)) != parent:
        raise UnsafeLayer("SYNTHETIC_TARGET_OUTSIDE_SCRATCH")
    name = os.path.basename(target)
    if not _NAME.fullmatch(name):
        raise UnsafeLayer("SYNTHETIC_TARGET_NAME_INVALID")
    parent_fd = os.open(parent, _DIR_FLAGS)
    try:
        parent_info = os.fstat(parent_fd)
        if parent_info.st_uid != os.getuid() or stat.S_IMODE(parent_info.st_mode) != 0o700:
            raise UnsafeLayer("SYNTHETIC_PARENT_NOT_PRIVATE")
        root_fd = os.open(name, _DIR_FLAGS, dir_fd=parent_fd)
        try:
            info = os.fstat(root_fd)
            if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700 or os.listdir(root_fd):
                raise UnsafeLayer("SYNTHETIC_TARGET_NOT_EMPTY_PRIVATE")
            return parent_fd, root_fd, name, info
        except BaseException:
            os.close(root_fd)
            raise
    except BaseException:
        os.close(parent_fd)
        raise


def _assert_same_target(parent_fd: int, name: str, original: os.stat_result) -> None:
    current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
    if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != (
            original.st_dev, original.st_ino):
        raise UnsafeLayer("SYNTHETIC_ROLLBACK_TARGET_CHANGED")


def rollback_synthetic_target(parent: str, target: str, inode: int, device: int) -> None:
    """Remove only the exact synthetic target inode, never a broad path."""
    parent_fd, root_fd, name, info = _target_fds_for_cleanup(parent, target)
    try:
        if (info.st_dev, info.st_ino) != (device, inode):
            raise UnsafeLayer("SYNTHETIC_ROLLBACK_TARGET_CHANGED")
        _assert_same_target(parent_fd, name, info)
        _remove_at(parent_fd, name, [0])
    finally:
        os.close(root_fd)
        os.close(parent_fd)


def _target_fds_for_cleanup(parent: str, target: str):
    # Same path/ownership checks as creation, but target may be populated.
    if not isinstance(parent, str) or not isinstance(target, str):
        raise UnsafeLayer("SYNTHETIC_TARGET_INVALID")
    parent = os.path.realpath(parent)
    scratch = os.path.realpath(tempfile.gettempdir())
    if os.path.commonpath((parent, scratch)) != scratch or \
            os.path.realpath(os.path.dirname(target)) != parent:
        raise UnsafeLayer("SYNTHETIC_TARGET_OUTSIDE_SCRATCH")
    name = os.path.basename(target)
    if not _NAME.fullmatch(name):
        raise UnsafeLayer("SYNTHETIC_TARGET_NAME_INVALID")
    parent_fd = os.open(parent, _DIR_FLAGS)
    try:
        parent_info = os.fstat(parent_fd)
        if parent_info.st_uid != os.getuid() or stat.S_IMODE(parent_info.st_mode) != 0o700:
            raise UnsafeLayer("SYNTHETIC_PARENT_NOT_PRIVATE")
        root_fd = os.open(name, _DIR_FLAGS, dir_fd=parent_fd)
        try:
            info = os.fstat(root_fd)
            if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
                raise UnsafeLayer("SYNTHETIC_TARGET_NOT_PRIVATE")
            return parent_fd, root_fd, name, info
        except BaseException:
            os.close(root_fd)
            raise
    except BaseException:
        os.close(parent_fd)
        raise


def _apply_layer(archive: tarfile.TarFile, entries: list[tarfile.TarInfo],
                 root_fd: int, fault_after: int | None, operations: list[int]) -> None:
    # OCI whiteouts apply to lower layers before any same-layer entries.
    for entry in entries:
        path = _path(entry.name)
        base = posixpath.basename(path)
        if not base.startswith(".wh."):
            continue
        parent_path = posixpath.dirname(path)
        try:
            parent_fd = _open_dir(root_fd, parent_path)
        except FileNotFoundError:
            continue
        try:
            budget = [0]
            if base == ".wh..wh..opq":
                for child in os.listdir(parent_fd):
                    _remove_at(parent_fd, child, budget)
            else:
                _remove_at(parent_fd, base[4:], budget)
        finally:
            os.close(parent_fd)
    for entry in entries:
        path = _path(entry.name)
        if posixpath.basename(path).startswith(".wh."):
            continue
        parent_path, name = posixpath.split(path)
        parent_fd = _open_dir(root_fd, parent_path, create=True)
        try:
            if entry.isdir():
                try:
                    existing = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
                except FileNotFoundError:
                    existing = None
                if existing is not None and stat.S_ISDIR(existing.st_mode):
                    fd = os.open(name, _DIR_FLAGS, dir_fd=parent_fd)
                else:
                    _remove_at(parent_fd, name, [0])
                    os.mkdir(name, 0o700, dir_fd=parent_fd)
                    fd = os.open(name, _DIR_FLAGS, dir_fd=parent_fd)
                os.close(fd)
            elif entry.isfile():
                _remove_at(parent_fd, name, [0])
                fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                             0o600, dir_fd=parent_fd)
                try:
                    source = archive.extractfile(entry)
                    if source is None:
                        raise UnsafeLayer("SYNTHETIC_FILE_MISSING")
                    remaining = entry.size
                    while remaining:
                        chunk = source.read(min(65536, remaining))
                        if not chunk:
                            raise UnsafeLayer("SYNTHETIC_FILE_TRUNCATED")
                        offset = 0
                        while offset < len(chunk):
                            written = os.write(fd, chunk[offset:])
                            if written <= 0:
                                raise UnsafeLayer("SYNTHETIC_FILE_WRITE_FAILED")
                            offset += written
                        remaining -= len(chunk)
                    os.fchmod(fd, entry.mode & 0o755)
                finally:
                    os.close(fd)
            elif entry.issym():
                _remove_at(parent_fd, name, [0])
                os.symlink(_symlink_target(path, entry.linkname), name, dir_fd=parent_fd)
            elif entry.islnk():
                source = _path(entry.linkname)
                if source == path:
                    raise UnsafeLayer("SYNTHETIC_HARDLINK_SELF_DENIED")
                source_parent, source_name = posixpath.split(source)
                source_fd = _open_dir(root_fd, source_parent)
                try:
                    source_info = os.stat(source_name, dir_fd=source_fd,
                                          follow_symlinks=False)
                    if not stat.S_ISREG(source_info.st_mode):
                        raise UnsafeLayer("SYNTHETIC_HARDLINK_SOURCE_INVALID")
                    _remove_at(parent_fd, name, [0])
                    os.link(source_name, name, src_dir_fd=source_fd,
                            dst_dir_fd=parent_fd, follow_symlinks=False)
                finally:
                    os.close(source_fd)
            operations[0] += 1
            if fault_after is not None and operations[0] >= fault_after:
                raise UnsafeLayer("SYNTHETIC_INJECTED_FAILURE")
        finally:
            os.close(parent_fd)


def extract_synthetic_layers(layers: list[SyntheticLayer], parent: str, target: str,
                             *, purpose: str, fault_after: int | None = None) -> dict:
    if purpose != "synthetic-fixture-only":
        raise UnsafeLayer("SYNTHETIC_PURPOSE_REQUIRED")
    planned = _validate(layers)  # All archive metadata/digests before first write.
    parent_fd, root_fd, name, info = _target_fds(parent, target)
    operations = [0]
    try:
        for layer, entries in zip(layers, planned):
            with tarfile.open(fileobj=io.BytesIO(layer.data), mode="r:") as archive:
                _apply_layer(archive, entries, root_fd, fault_after, operations)
        return {"status": "SYNTHETIC_ONLY", "target_inode": info.st_ino,
                "target_device": info.st_dev, "operations": operations[0]}
    except BaseException:
        _assert_same_target(parent_fd, name, info)
        _remove_at(parent_fd, name, [0])
        raise
    finally:
        os.close(root_fd)
        os.close(parent_fd)


def extract_approved_qa_rootfs(*_args, **_kwargs):
    if APPROVED_REAL_QA_EXTRACTOR is not None:
        raise UnsafeLayer("REAL_QA_EXTRACTOR_GATE_CHANGED_WITHOUT_REVIEW")
    raise UnsafeLayer("REAL_QA_EXTRACTOR_DISABLED")
