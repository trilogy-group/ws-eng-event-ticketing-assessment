import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("backend test setup", () => {
  it("responds to the health endpoint", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
    });
    expect(typeof response.body.timestamp).toBe("string");
  });
});
