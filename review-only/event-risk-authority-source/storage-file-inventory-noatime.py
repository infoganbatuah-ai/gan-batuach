"""Fail-closed Storage inventory: read-only FDs with O_NOATIME on Linux.

Only opaque path digests, byte counts and content hashes reach stdout. No
object names, contents, archive or source-side file writes are produced.
"""
import hashlib
import json
import os
import stat
import sys

ROOT = os.environ.get("DO_STORAGE_ROOT", "")
FIXTURE = os.environ.get("DO_OFFLINE_FIXTURE_ONLY") == "1"
MAX_FILES = 20_000
MAX_BYTES = 1024 ** 3
ALLOWED_ERRORS = {
    "STORAGE_ROOT_INVALID", "STORAGE_NONREGULAR_ENTRY", "STORAGE_FILE_COUNT_CAP",
    "STORAGE_BYTE_CAP", "STORAGE_FILE_CHANGED_DURING_HASH",
    "STORAGE_DIRECTORY_CHANGED_DURING_HASH", "STORAGE_NOATIME_UNAVAILABLE",
}


def fail(code):
    raise RuntimeError(code)


def unchanged(first, second):
    content_identity = (first.st_dev, first.st_ino, first.st_size, first.st_mtime_ns,
                        first.st_ctime_ns) == (second.st_dev, second.st_ino,
                                                second.st_size, second.st_mtime_ns,
                                                second.st_ctime_ns)
    return content_identity and (FIXTURE or first.st_atime_ns == second.st_atime_ns)


def main():
    if FIXTURE:
        if not ROOT.startswith("/private/tmp/do-storage-inventory-test."):
            fail("STORAGE_ROOT_INVALID")
        noatime = 0  # macOS fixture only; never allowed for the live /mnt path.
    else:
        if ROOT != "/mnt":
            fail("STORAGE_ROOT_INVALID")
        noatime = getattr(os, "O_NOATIME", None)
        if noatime is None:
            fail("STORAGE_NOATIME_UNAVAILABLE")
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | noatime
    file_flags = os.O_RDONLY | os.O_NOFOLLOW | noatime
    files = []
    total_bytes = 0

    def walk(directory_fd, prefix):
        nonlocal total_bytes
        before_dir = os.fstat(directory_fd)
        with os.scandir(directory_fd) as iterator:
            names = sorted(entry.name for entry in iterator)
        for name in names:
            before = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
            relative = prefix + name
            if stat.S_ISDIR(before.st_mode):
                child = os.open(name, directory_flags, dir_fd=directory_fd)
                try:
                    if (os.fstat(child).st_dev, os.fstat(child).st_ino) != (before.st_dev, before.st_ino):
                        fail("STORAGE_DIRECTORY_CHANGED_DURING_HASH")
                    walk(child, relative + "/")
                finally:
                    os.close(child)
                if not unchanged(before, os.stat(name, dir_fd=directory_fd, follow_symlinks=False)):
                    fail("STORAGE_DIRECTORY_CHANGED_DURING_HASH")
                continue
            if not stat.S_ISREG(before.st_mode):
                fail("STORAGE_NONREGULAR_ENTRY")
            if len(files) >= MAX_FILES:
                fail("STORAGE_FILE_COUNT_CAP")
            if before.st_size > MAX_BYTES - total_bytes:
                fail("STORAGE_BYTE_CAP")
            fd = os.open(name, file_flags, dir_fd=directory_fd)
            try:
                if not unchanged(before, os.fstat(fd)):
                    fail("STORAGE_FILE_CHANGED_DURING_HASH")
                content_hash = hashlib.sha256()
                actual_bytes = 0
                while True:
                    chunk = os.read(fd, 1024 * 1024)
                    if not chunk:
                        break
                    actual_bytes += len(chunk)
                    if actual_bytes > MAX_BYTES - total_bytes:
                        fail("STORAGE_BYTE_CAP")
                    content_hash.update(chunk)
                if actual_bytes != before.st_size or not unchanged(before, os.fstat(fd)):
                    fail("STORAGE_FILE_CHANGED_DURING_HASH")
            finally:
                os.close(fd)
            if not unchanged(before, os.stat(name, dir_fd=directory_fd, follow_symlinks=False)):
                fail("STORAGE_FILE_CHANGED_DURING_HASH")
            total_bytes += actual_bytes
            files.append({"pathDigest": hashlib.sha256(relative.encode()).hexdigest(),
                          "bytes": actual_bytes, "sha256": content_hash.hexdigest()})
        if not unchanged(before_dir, os.fstat(directory_fd)):
            fail("STORAGE_DIRECTORY_CHANGED_DURING_HASH")

    root_fd = os.open(ROOT, directory_flags)
    try:
        walk(root_fd, "")
    finally:
        os.close(root_fd)
    files.sort(key=lambda item: item["pathDigest"])
    sys.stdout.write(json.dumps({"count": len(files), "totalBytes": total_bytes,
                                 "files": files}, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        message = str(error)
        sys.stderr.write((message if message in ALLOWED_ERRORS else "STORAGE_INVENTORY_IO_ERROR") + "\n")
        sys.exit(1)
