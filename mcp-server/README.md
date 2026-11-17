# Jabr Math MCP Server

A local Model Context Protocol (MCP) server that exposes Jabr's Mathlex parser to MCP-compatible AI applications.

## Tools

| Tool | Purpose |
| --- | --- |
| `jabr_parse_math` | Parse plain-text mathematical notation and return its AST |
| `jabr_parse_latex` | Parse LaTeX and return its AST |
| `jabr_math_to_latex` | Convert plain-text mathematical notation to LaTeX |
| `jabr_latex_to_latex` | Normalize LaTeX through Mathlex |
| `jabr_capabilities` | Describe supported operations and limitations |

This server provides math tools to an AI host. It does not include an AI model or make model-provider API calls.

## Build and run

Requirements: Node.js 20.19+ (or 22.12+), npm, Rust, and wasm-pack 0.15.1.

From the repository root:

```powershell
pnpm install
pnpm mcp:install
pnpm mcp:wasm
pnpm mcp:start
```

The server uses MCP stdio transport. Do not print logs to stdout; stdout is reserved for MCP messages.

## Example MCP client configuration

Use the absolute paths for your machine:

```json
{
  "mcpServers": {
    "jabr-math": {
      "command": "node",
      "args": ["C:/path/to/Jabr-math/mcp-server/src/server.mjs"]
    }
  }
}
```

Build the WASM package before starting the server. The generated `mcp-server/wasm/` directory is a build artifact and is not committed.

## Security boundary

The MCP server exposes only explicit mathematical operations. It does not execute arbitrary shell commands, JavaScript, scripts from disk, or user-supplied code. Mathematical input is size-limited and validated before reaching Mathlex.
