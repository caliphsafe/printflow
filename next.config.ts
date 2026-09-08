import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // ssh2 / ssh2-sftp-client are Node.js server-only dependencies. Turbopack
  // cannot safely place ssh2's protocol crypto assets into an ESM chunk.
  // Keep these packages external so the SanMar SFTP sync route loads them
  // directly from node_modules at runtime instead of bundling them.
  serverExternalPackages: ["ssh2", "ssh2-sftp-client"]
};

export default nextConfig;
