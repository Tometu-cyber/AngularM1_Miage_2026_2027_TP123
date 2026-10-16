import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test("health sans dépendre de MongoDB", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "ok");
});

test("schémas Mongoose et relation", () => {
  const u = new User({
    name: "Test",
    email: "TEST@example.com",
    password: "12345678",
  });

  assert.equal(u.email, "test@example.com");
  const t = new Track({
    ownerId: new mongoose.Types.ObjectId(),
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  });
  
  assert.equal(t.title, "Blues");
  assert.equal(Track.schema.path("ownerId").options.ref, "User");
});

/*
 * Tests de contrat et de sécurité (TP3, extension facultative).
 * Ils ne dépendent pas de MongoDB : le middleware auth et Multer répondent
 * avant toute requête à la base.
 */

// Même secret que l'application (variable d'environnement ou valeur de développement).
const validToken = () =>
  jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString(), email: "test@example.com" },
    process.env.JWT_SECRET || "tp1-development-secret",
    { expiresIn: "5m" },
  );

test("401 sans JWT", async () => {
  const r = await fetch(base + "/api/tracks");
  assert.equal(r.status, 401);
  assert.equal((await r.json()).message, "Authentification requise");
});

test("401 avec un JWT invalide", async () => {
  const r = await fetch(base + "/api/tracks/123", {
    method: "DELETE",
    headers: { Authorization: "Bearer jeton.invalide.signature" },
  });
  assert.equal(r.status, 401);
});

test("400 pour un upload sans fichier", async () => {
  const body = new FormData();
  body.append("title", "Sans fichier");
  const r = await fetch(base + "/api/tracks", {
    method: "POST",
    headers: { Authorization: `Bearer ${validToken()}` },
    body,
  });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Fichier audio requis");
});

test("400 pour un type MIME refusé", async () => {
  const body = new FormData();
  body.append("audio", new Blob(["pas du son"], { type: "text/plain" }), "notes.txt");
  const r = await fetch(base + "/api/tracks", {
    method: "POST",
    headers: { Authorization: `Bearer ${validToken()}` },
    body,
  });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Format audio non accepté");
});
