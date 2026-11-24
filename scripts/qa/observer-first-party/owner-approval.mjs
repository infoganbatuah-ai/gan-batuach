import { randomBytes, timingSafeEqual } from "node:crypto";
import { OBSERVER_QA_HOST } from "../push44-observer-qa-ingress-policy.mjs";

const login = "/digital-observer/login";
const approvalPath = "/__push44/owner-approval";
export const approvalCookie = "__Host-observer_qa_window";
const pageHead = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>אישור כניסה לבדיקת תצפיתן</title>`;
const unavailable = `${pageHead}<main><h1>האישור אינו זמין</h1>
<p>הקוד פג, נוצל או שמספר הניסיונות הסתיים. לאחר שיוצג ב־Mac קוד חדש, לחצו כאן לפתיחת טופס הכניסה.</p>
<a href="${login}">פתיחת טופס הכניסה</a></main></html>`;
function sendHtml(res, status, html) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" }).end(html);
}
const form = `${pageHead}<main><h1>אישור כניסה לבדיקת תצפיתן</h1>
<form method="post" action="${approvalPath}"><label>קוד חד־פעמי מה־Mac
<input name="approval" type="password" dir="ltr" required autocomplete="off" autocapitalize="none" spellcheck="false"></label>
<p>הקלידו את 16 האותיות והספרות ולחצו על הכפתור.</p><button type="submit">המשך לכניסה</button></form></main></html>`;

export function createOwnerApproval({ code, now, deadline }) {
  if (typeof code !== "string" || !/^[0-9a-f]{16}$/.test(code) || !Number.isSafeInteger(deadline)) throw new Error("Invalid QA window");
  const expires = Math.min(deadline, now() + 120_000);
  let available = true;
  let attempts = 0;
  let session;

  function authorized(raw) {
    if (!session || now() >= deadline || typeof raw !== "string") return false;
    const matches = raw.split(";").map(part => part.trim()).filter(part => part.startsWith(approvalCookie + "="));
    const value = matches.length === 1 ? matches[0].slice(approvalCookie.length + 1) : "";
    return /^[0-9a-f]{64}$/.test(value) && timingSafeEqual(Buffer.from(value), session);
  }

  async function respond(req, res) {
    res.setHeader("cache-control", "no-store");
    res.setHeader("referrer-policy", "same-origin");
    res.setHeader("content-security-policy", "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    if (req.method === "GET" && req.url === login) {
      const open = available && attempts < 5 && now() < expires;
      sendHtml(res, open ? 200 : 403, open ? form : unavailable);
      return;
    }
    if (req.url !== approvalPath || req.method !== "POST" || req.headers.origin !== "https://" + OBSERVER_QA_HOST ||
        req.headers["content-type"]?.split(";")[0] !== "application/x-www-form-urlencoded") {
      if (req.url === approvalPath) sendHtml(res, 403, unavailable);
      else res.writeHead(403).end();
      return;
    }
    let body = "";
    for await (const chunk of req) {
      if (body.length + chunk.length > 64) { res.writeHead(413).end(); return; }
      body += chunk.toString("latin1");
    }
    // No await between testing and consuming: one winner in this single-process QA window.
    if (!available || now() >= expires || attempts >= 5) { sendHtml(res, 403, unavailable); return; }
    attempts++;
    const value = /^approval=([0-9a-fA-F]{16})$/.exec(body)?.[1]?.toLowerCase();
    if (!value || !timingSafeEqual(Buffer.from(value), Buffer.from(code))) {
      const retry = form.replace("<form", '<p role="alert">הקוד שגוי. בדקו את 16 התווים ונסו שוב.</p><form');
      sendHtml(res, 403, attempts < 5 ? retry : unavailable);
      return;
    }
    available = false;
    session = Buffer.from(randomBytes(32).toString("hex"));
    const age = Math.floor((deadline - now()) / 1000);
    res.writeHead(303, { location: login, "set-cookie":
      `${approvalCookie}=${session.toString()}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}` }).end();
  }
  return { authorized, respond, approvalPath };
}
