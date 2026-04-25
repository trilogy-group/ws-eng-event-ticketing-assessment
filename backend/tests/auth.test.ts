import { randomUUID } from "crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

async function loginAs(email: string, password: string) {
  const response = await request(app).post("/api/auth/login").send({ email, password });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  return response.body.data.token as string;
}

describe("auth API", () => {
  it("registers a new attendee and returns a token", async () => {
    const email = `test-${randomUUID()}@example.com`;

    const response = await request(app).post("/api/auth/register").send({
      email,
      password: "secret123",
      name: "Test Attendee",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Registration successful",
      data: {
        user: {
          email,
          name: "Test Attendee",
          role: "ATTENDEE",
        },
      },
    });
    expect(response.body.data.user.id).toEqual(expect.any(String));
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it("rejects duplicate registration attempts for the same email", async () => {
    const email = `duplicate-${randomUUID()}@example.com`;

    const firstResponse = await request(app).post("/api/auth/register").send({
      email,
      password: "secret123",
      name: "Duplicate User",
    });

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app).post("/api/auth/register").send({
      email,
      password: "secret123",
      name: "Duplicate User",
    });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body).toMatchObject({
      success: false,
      error: "CONFLICT",
      message: "Email already registered",
    });
  });

  it("rejects login with an invalid password", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "alice@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
  });

  it("returns the authenticated user from /api/auth/me", async () => {
    const token = await loginAs("alice@example.com", "attendee123");

    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        email: "alice@example.com",
        name: "Alice Williams",
        role: "ATTENDEE",
        isVerified: true,
      },
    });
    expect(response.body.data.id).toEqual(expect.any(String));
  });

  it("prevents verified users from changing their name", async () => {
    const token = await loginAs("alice@example.com", "attendee123");

    const response = await request(app).put("/api/auth/profile").set("Authorization", `Bearer ${token}`).send({
      name: "Alice Updated",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: "PROFILE_LOCKED",
      message: "Verified users cannot change their name. Contact support if you need to update your identity.",
    });
  });

  it("allows unverified users to update their profile name", async () => {
    const token = await loginAs("bob@example.com", "attendee123");

    const response = await request(app).put("/api/auth/profile").set("Authorization", `Bearer ${token}`).send({
      name: "Bob Updated",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Profile updated successfully",
      data: {
        email: "bob@example.com",
        name: "Bob Updated",
        role: "ATTENDEE",
        isVerified: false,
      },
    });
  });

  it("requires authentication for protected auth endpoints", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: "UNAUTHORIZED",
      message: "Please sign in",
    });
  });
});
