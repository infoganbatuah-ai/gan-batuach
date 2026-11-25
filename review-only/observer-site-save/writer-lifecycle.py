"""Render or verify guarded review text. Has no database or subprocess interface."""
import argparse
import hashlib
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
# The three "catalog" checks compare separately attested states. The operator
# supplies both digests via local settings only in a subsequently approved review.
INSTALL = ("existing-catalog.sql", "base-bootstrap.sql", "atomic.sql",
           "ownership-window-open.sql", "writer.sql", "ownership-window-close.sql", "generic-execute.sql",
           "writer-policies.sql", "ownership-window-open.sql", "pair-forward.sql", "ownership-window-close.sql", "boundary-check.sql")
WITHDRAW = ("withdrawal-gate.sql", "boundary-check.sql", "installed-original-surface", "installed-catalog.sql",
            "membership-close.sql", "pair-rollback.sql", "writer-policies-rollback.sql", "base-withdraw.sql", "existing-catalog.sql")
GUARD = "do $$ begin raise exception 'REVIEW ONLY: whole writer lifecycle requires separate authorization'; end $$;"
WRAPPER = re.compile(r"\A(?:--[^\n]*\n|\s)*begin;\s*do \$\$ begin raise exception 'REVIEW ONLY: [^'\n]+'; end \$\$;\s*(.*?)\s*commit;\s*\Z", re.S)
TOKEN = re.compile(r"""--[^\n]*|/\*.*?\*/|'(?:''|[^'])*'|"(?:""|[^"])*"|(?P<tag>\$(?:[A-Za-z_]\w*)?\$).*?(?P=tag)|;""", re.S)


def fragment(step):
    file = "existing-catalog.sql" if step == "installed-original-surface" else step
    path = ROOT / file
    if path.is_symlink():
        raise ValueError(f"unexpected symbolic link: {file}")
    raw = path.read_bytes()
    match = WRAPPER.fullmatch(raw.decode())
    if not match:
        raise ValueError(f"missing review guard or transaction: {file}")
    body = match[1]
    if step == "installed-original-surface":
        body = body.replace("observer_review.existing_catalog_sha256", "observer_review.installed_catalog_sha256")
    return raw, body


def statements(body):
    """Remove comments and mask quoted blocks before locating outer boundaries."""
    start = 0
    at = 0
    plain = []
    for token in TOKEN.finditer(body):
        plain.append(body[at:token.start()])
        val = token[0]
        at = token.end()
        if val == ";":
            stmt = " ".join("".join(plain).split())
            if stmt:
                yield stmt, body[start:at]
            start = at
            plain = []
        elif val.startswith(("--", "/*")):
            plain.append(" ")
        else:
            plain.append(val if val[0] != "$" else "<body>")
    if (("".join(plain) + body[at:]).strip()):
        raise ValueError("unterminated top-level statement")


def rendered(steps):
    parts = ["begin isolation level read committed;", GUARD, "set local search_path = pg_catalog;", "set local lock_timeout = '5s';"]
    for name in steps:
        _, body = fragment(name)
        for stmt, _ in statements(body):
            if re.match(r"(?i)^(?:begin|start transaction|commit|end|rollback|abort|prepare transaction|copy|call|alter default privileges)\b", stmt):
                raise ValueError(f"unexpected statement in {name}: {stmt[:40]}")
        parts += ["-- " + name, body]
    return "\n".join(parts + ["commit;", ""])


def digest_review(name):
    # Sharing the exact SELECT prevents drift between receipt creation and comparison.
    _, body = fragment(name)
    match = re.search(r"\n  (with .+?) into actual from entries;", body, re.S | re.I)
    if not match or " into " in match[1].lower():
        raise ValueError(f"unexpected catalog digest shape in {name}")
    return "\n".join(("begin isolation level repeatable read read only;", GUARD,
                      "set local search_path = pg_catalog;", match[1] + " from entries;", "commit;", ""))


def inventory():
    lines = ["# Static manifest. Number = top-level statement in the corresponding guarded fragment.",
             "# SQL after AS <body> and DO blocks are pinned in full by the file hash.",
             "INSTALL " + " -> ".join(INSTALL), "WITHDRAW " + " -> ".join(WITHDRAW)]
    for name in dict.fromkeys(INSTALL + WITHDRAW):
        raw, body = fragment(name)
        lines.extend(("", name + "  sha256=" + hashlib.sha256(raw).hexdigest()))
        for number, (stmt, raw_stmt) in enumerate(statements(body), start=1):
            lines.append(f"{number:02} {stmt}")
            if stmt.lower().startswith("do "):
                for conditional in re.findall(r"(?im)^\s*((?:drop|alter|grant|revoke|create)\s+(?:role|table|schema|policy|function|type|default privileges)\s+[^;\n]+;)", raw_stmt):
                    lines.append("   conditional " + conditional.strip())
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("install-review", "withdraw-review", "original-digest-review", "new-digest-review", "inventory", "check"), default="check", nargs="?")
    action = parser.parse_args().action
    manifest = inventory()
    if action == "inventory":
        print(manifest, end="")
        return
    if manifest != (ROOT / "writer-lifecycle.inventory").read_text():
        raise SystemExit("Manifest drift: review fragment changes before rendering.")
    install, withdraw = rendered(INSTALL), rendered(WITHDRAW)
    digests = {key: digest_review(file) for key, file in (
        ("original-digest-review", "existing-catalog.sql"), ("new-digest-review", "installed-catalog.sql"))}
    if action in digests:
        print(digests[action], end="")
    elif action == "check":
        print("PASS pinned source inventory and guarded outer transaction rendering")
    else:
        print(install if action == "install-review" else withdraw, end="")


if __name__ == "__main__":
    main()
