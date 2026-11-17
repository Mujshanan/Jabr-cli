import test from "node:test";
import assert from "node:assert/strict";
import { createJabrMcpServer } from "../src/server.mjs";

test("MCP server can be constructed with Jabr math tools", () => {
  const server = createJabrMcpServer();
  assert.ok(server);
  assert.equal(typeof server.connect, "function");
});
