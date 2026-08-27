import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("HTTP application", () => {
  it("reports that it is healthy", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns JSON for an unknown route", async () => {
    const response = await request(app).get("/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not Found" });
    expect(response.headers["content-type"]).toMatch(/json/);
  });
});
