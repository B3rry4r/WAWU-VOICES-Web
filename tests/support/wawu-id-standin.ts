/**
 * A tiny local stand-in for the WAWU ID routes the VOICES web app calls. Tests and pictures only, never shipped,
 * never the live WAWU ID. It signs RS256 tokens with a throwaway key and serves that key as a JWKS, so the real
 * VOICES API can be started against it (WAWU_ID_JWKS_URL). Answers and errors follow WAWU ID's own shapes
 * ({ data } on success, { statusCode, message, code? } on refusal) as read from its source on 5 Nov 2026.
 *
 * Switches a test or a picture can use through the email it types:
 *   taken@...      register answers 409 (email or phone taken)
 *   (any account) login answers 403 EMAIL_NOT_VERIFIED until its code is confirmed
 * The right code is always 123456; any other code answers 401 "Invalid or expired code".
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createSign, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";

export const RIGHT_CODE = "123456";

interface User { id: string; email: string; phone: string; fullName: string; password: string; verified: boolean }

const b64 = (v: Buffer | string) => Buffer.from(v).toString("base64url");

export class WawuIdStandIn {
  readonly kid = "standin-1";
  readonly users = new Map<string, User>();
  readonly calls: { method: string; path: string; body: unknown }[] = [];
  private server!: Server;
  private priv!: KeyObject;
  private jwk!: Record<string, unknown>;
  private refresh = new Map<string, string>();
  url = "";
  /** Set to make the next verify/start or any call answer with this status (for the network-error states). */
  failNext: { status: number; body: unknown } | null = null;

  constructor(private readonly port = 0) {}

  async start(): Promise<void> {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    this.priv = privateKey;
    this.jwk = { ...publicKey.export({ format: "jwk" }), kid: this.kid, use: "sig", alg: "RS256" };
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((r) => this.server.listen(this.port, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((r) => this.server.close(() => r()));
  }

  sign(claims: Record<string, unknown>, expiresInSec = 900): string {
    const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT", kid: this.kid }));
    const now = Math.floor(Date.now() / 1000);
    const body = b64(JSON.stringify({ ...claims, iat: now, exp: now + expiresInSec }));
    const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(this.priv).toString("base64url");
    return `${head}.${body}.${sig}`;
  }

  private tokens(u: User) {
    const [firstName, ...rest] = u.fullName.split(" ");
    const accessToken = this.sign({ jti: randomUUID(), sub: u.id, email: u.email, phone: u.phone, firstName, lastName: rest.join(" "), country: "Nigeria", status: "ACTIVE" });
    const refreshToken = this.sign({ sub: u.id, jti: randomUUID(), type: "refresh" }, 30 * 86400);
    this.refresh.set(refreshToken, u.id);
    return { accessToken, refreshToken };
  }

  private userOut(u: User) {
    return { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, status: "ACTIVE" };
  }

  private async handle(req: IncomingMessage, res: import("node:http").ServerResponse): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("content-type", "application/json");
    if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
    const path = (req.url ?? "").split("?")[0];
    if (path === "/.well-known/jwks.json") { res.end(JSON.stringify({ keys: [this.jwk] })); return; }
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    this.calls.push({ method: req.method ?? "GET", path, body });
    const send = (status: number, payload: unknown) => { res.statusCode = status; res.end(JSON.stringify(payload)); };
    const refuse = (statusCode: number, message: string, code?: string) => send(statusCode, { statusCode, message, ...(code ? { code } : {}) });
    if (this.failNext) { const f = this.failNext; this.failNext = null; send(f.status, f.body); return; }

    const byEmail = (e: string) => [...this.users.values()].find((u) => u.email === String(e).toLowerCase());
    switch (path) {
      case "/auth/register": {
        const email = String(body.email ?? "").toLowerCase();
        if (email.startsWith("taken@") || byEmail(email)) return refuse(409, "An account with this email or phone already exists");
        if (!body.password || body.password.length < 8) return refuse(400, "password must be longer than or equal to 8 characters");
        const u: User = { id: randomUUID(), email, phone: String(body.phone), fullName: String(body.fullName ?? `${body.firstName} ${body.lastName}`), password: body.password, verified: false };
        this.users.set(u.id, u);
        return send(201, { data: { ...this.tokens(u), user: this.userOut(u) } });
      }
      case "/auth/email/verify/start": {
        const u = byEmail(body.email);
        if (!u) return refuse(404, "No account found with this email");
        return send(201, { data: { message: u.verified ? "Email already verified" : "Verification code sent", expiresIn: u.verified ? 0 : 300 } });
      }
      case "/auth/email/verify/confirm": {
        const u = byEmail(body.email);
        if (!u || body.code !== RIGHT_CODE) return refuse(401, "Invalid or expired code");
        u.verified = true;
        return send(201, { data: { ...this.tokens(u), user: this.userOut(u) } });
      }
      case "/auth/login": {
        const id = String(body.identifier ?? "").toLowerCase();
        const u = byEmail(id) ?? [...this.users.values()].find((x) => x.phone === body.identifier);
        if (!u) return refuse(404, "No account found with this email or phone number.", "USER_NOT_IN_WAWUID");
        if (u.password !== body.password) return refuse(401, "Invalid credentials");
        if (!u.verified) return refuse(403, "Verify your email address before signing in.", "EMAIL_NOT_VERIFIED");
        return send(201, { data: { ...this.tokens(u), user: this.userOut(u) } });
      }
      case "/auth/refresh": {
        const id = this.refresh.get(body.refreshToken);
        if (!id) return refuse(401, "Invalid or expired refresh token");
        this.refresh.delete(body.refreshToken);
        return send(201, { data: this.tokens(this.users.get(id)!) });
      }
      case "/auth/logout":
        this.refresh.delete(body.refreshToken);
        return send(201, { data: { signedOut: true } });
      default:
        return refuse(404, "Cannot " + req.method + " " + path);
    }
  }

  /** Seed a verified person (for tests that start signed in). */
  seed(email: string, password: string, fullName: string, phone: string): User {
    const u: User = { id: randomUUID(), email, phone, fullName, password, verified: true };
    this.users.set(u.id, u);
    return u;
  }
  tokensFor(u: User) { return this.tokens(u); }
}
