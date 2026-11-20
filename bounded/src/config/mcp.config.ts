/**
 * Model Context Protocol (MCP) server configurations
 */

if (!process.env.GITHUB_TOKEN) {
  throw new Error(
    'Missing required environment variable: GITHUB_TOKEN'
  );
}

export const mcpServersConfig = {
  github: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN,
    },
  },

  eslint: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {},
  },
};
