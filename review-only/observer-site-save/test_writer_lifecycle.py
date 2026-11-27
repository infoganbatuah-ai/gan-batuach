"""Offline source assertions for the hosted delta. No PostgreSQL driver or network."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import re
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = spec_from_file_location("writer_lifecycle", HERE / "writer-lifecycle.py")
life = module_from_spec(spec)
spec.loader.exec_module(life)
EX = "observer_site_save_executor"
CALLER = "observer_site_save_caller"
SIGS = {
    "public.save_observer_onboarding_atomic": "uuid,uuid,jsonb,text,jsonb",
    "public.submit_observer_site_save": "uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb",
    "public.submit_qa_site_source_pair": "uuid,uuid,bigint,uuid,text",
    "observer_site_save_private.check_pair_acl": "boolean",
    "observer_site_save_private.lock_pair_pin": "uuid,text",
}


def statements(steps):
    return [stmt.lower() for step in steps for stmt, _ in life.statements(life.fragment(step)[1])]


def privileges(verb, statements):
    """Expand tables and lists of column privileges without splitting column groups."""
    rules = set()
    for stmt in statements:
        match = re.fullmatch(verb + r" (.+?) on (.+?) (?:to|from) (\w+)(?: restrict)?", stmt)
        if match:
            privs, objects, role = match.groups()
            for privilege in re.split(r",(?![^(]*\))", privs):
                for obj in re.split(r",(?![^(]*\))", objects):
                    rules.add((role, obj.strip(), privilege.strip()))
    return rules


class ReviewText(unittest.TestCase):
    def test_guards_and_one_transaction(self):
        for chain in (life.INSTALL, life.WITHDRAW):
            stmts = [s.lower() for s, _ in life.statements(life.rendered(chain))]
            self.assertEqual(stmts[:2], ["begin isolation level read committed", "do <body>"])
            self.assertTrue(life.rendered(chain).splitlines()[1] == life.GUARD)
            self.assertEqual([s for s in stmts if re.match(r"^(begin|commit|rollback)\b", s)],
                             ["begin isolation level read committed", "commit"])
        with patch.object(Path, "read_bytes", return_value=b"begin; select 1; commit;"):
            with self.assertRaisesRegex(ValueError, "missing review guard"):
                life.fragment("writer.sql")

    def test_source_pins_and_tamper_detection(self):
        expected = (HERE / "writer-lifecycle.inventory").read_text()
        self.assertEqual(life.inventory(), expected)
        original = life.fragment
        def modified(name):
            raw, body = original(name)
            return (raw + b" " if name == "atomic.sql" else raw), body
        with patch.object(life, "fragment", side_effect=modified):
            self.assertNotEqual(life.inventory(), expected)

    def test_complete_function_signatures_and_inverse(self):
        seen = {}
        for stmt in statements(life.INSTALL):
            match = re.match(r"create function ([\w.]+)\(([^)]*)\) returns ", stmt)
            if match:
                seen[match[1]] = ",".join(p.split()[-1] for p in match[2].split(","))
        self.assertEqual(seen, SIGS)
        expected = {name + "(" + types + ")" for name, types in SIGS.items()}
        dropped = {s.split()[2] for s in statements(life.WITHDRAW) if s.startswith("drop function ")}
        self.assertEqual(expected, dropped)
        assertion = life.fragment("boundary-check.sql")[1]
        for sig in expected:
            self.assertIn("'" + sig + "'::regprocedure", assertion)

    def test_policy_inverse_and_ownership_window(self):
        policies = lambda cmd, chain: {m.groups() for s in statements(chain)
                                      if (m := re.match(cmd + r" policy (\w+) on ([\w.]+)", s))}
        created = policies("create", life.INSTALL)
        self.assertEqual(len(created), 13)
        self.assertEqual(created, policies("drop", life.WITHDRAW))
        for step in ("writer.sql", "pair-forward.sql"):
            index = life.INSTALL.index(step)
            self.assertEqual(life.INSTALL[index-1:index+2],
                             ("ownership-window-open.sql", step, "ownership-window-close.sql"))
        self.assertEqual(life.INSTALL[-1], "boundary-check.sql")
        self.assertEqual(life.WITHDRAW[:6], ("withdrawal-gate.sql", "boundary-check.sql",
                         "installed-original-surface", "installed-catalog.sql", "membership-close.sql", "pair-rollback.sql"))
        self.assertEqual(life.WITHDRAW[-2:], ("base-withdraw.sql","existing-catalog.sql"))

    def test_all_base_grants_withdrawn(self):
        forward = privileges("grant", statements(("base-bootstrap.sql",)))
        reverse = privileges("revoke", statements(("base-withdraw.sql",)))
        self.assertGreater(len(forward), 20)
        self.assertEqual(forward - reverse, set())
        # Compare separate deltas so a grant in a different stage cannot mask an omission.
        for forward_step, reverse_step in (("writer-policies.sql", "writer-policies-rollback.sql"),
                                           ("pair-forward.sql", "pair-rollback.sql")):
            granted = privileges("grant", statements((forward_step,)))
            revoked = privileges("revoke", statements((reverse_step,)))
            removed = {s.split()[2] for s in statements((reverse_step,)) if s.startswith("drop function ")}
            outstanding = {r for r in granted - revoked if r[1].removeprefix("function ") not in removed}
            self.assertEqual(outstanding, set())

    def test_public_rpc_boundary_and_roles(self):
        pair = "public.submit_qa_site_source_pair(" + SIGS["public.submit_qa_site_source_pair"] + ")"
        generic = "public.submit_observer_site_save(" + SIGS["public.submit_observer_site_save"] + ")"
        grants = statements(life.INSTALL)
        self.assertIn("grant execute on function " + pair + " to " + CALLER, grants)
        self.assertIn("revoke execute on function " + generic + " from " + CALLER, grants)
        for name in (CALLER, EX):
            self.assertIn("create role " + name +
                          " nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls", grants)
        self.assertIn("grant " + CALLER + " to authenticator with inherit false, set true, admin false", grants)
        self.assertFalse(any(re.match(r"grant .* to (service_role|anon|authenticated|public)\b", s) for s in grants))
        self.assertTrue(any(s == "revoke " + CALLER + " from authenticator restrict" for s in statements(life.WITHDRAW)))
        for arg in ("pg_has_role", "has_function_privilege", "aclexplode", "m.set_option", "m.inherit_option"):
            self.assertIn(arg, life.fragment("boundary-check.sql")[1])

    def test_data_retention_and_locked_conditional_cleanup(self):
        sql = life.fragment("base-withdraw.sql")[1].lower()
        for text in ("row_security_active(oid)", "in access exclusive mode", "if cleanup='on' and not exists",
                     "not exists (select from observer_site_save_private.receipts)",
                     "drop table observer_site_save_private.pair_receipts restrict",
                     "drop table observer_site_save_private.receipts restrict", "drop schema observer_site_save_private restrict"):
            self.assertIn(text, sql)
        self.assertLess(sql.index("if cleanup='on'"), sql.index("drop table"))
        self.assertLess(sql.index("drop schema"), sql.index("drop role"))
        body = "\n".join(statements(life.WITHDRAW))
        self.assertNotRegex(body, r"(?m)^(delete|update |insert |truncate|drop owned|reassign owned|drop table public\.|alter default privileges)")
        self.assertNotRegex(body, r"(?m)\bcascade$")
        self.assertEqual({s for s in statements(life.WITHDRAW) if s.startswith("drop role ")},
                         {"drop role " + role for role in (EX, CALLER)})

    def test_independent_receipt_projections_are_exact(self):
        original = life.fragment("existing-catalog.sql")[1]
        self.assertEqual(life.fragment("installed-original-surface")[1],
                         original.replace("observer_review.existing_catalog_sha256", "observer_review.installed_catalog_sha256"))
        for file in ("existing-catalog.sql", "installed-catalog.sql"):
            read = life.digest_review(file)
            self.assertTrue(read.startswith("begin isolation level repeatable read read only;\n" + life.GUARD))
            self.assertIn(read.split("set local search_path = pg_catalog;\n")[1].split(" from entries;\ncommit;")[0]
                          + " into actual from entries;", life.fragment(file)[1])
        self.assertIn("ACTIVE_ENROLLMENT_WINDOW", life.fragment("withdrawal-gate.sql")[1])


if __name__ == "__main__":
    unittest.main()
