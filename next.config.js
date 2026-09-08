/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // metaapi.cloud-sdk pulls in websocket/socket.io dependencies that assume a
  // browser environment in places. Bundling them into the server chunk (the
  // Next.js default) makes webpack pick up those browser code paths and
  // crashes the build with "window is not defined" while collecting page
  // data. Keeping this package external means it's require()'d from
  // node_modules at runtime instead, which resolves it the normal Node way.
  experimental: {
    serverComponentsExternalPackages: ["metaapi.cloud-sdk"],
  },
};

module.exports = nextConfig;
