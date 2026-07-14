/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Let the dev server accept requests proxied through an ngrok tunnel.
  // Next.js otherwise blocks cross-origin dev requests (assets, HMR, server
  // actions) coming from a host other than localhost. Wildcards are allowed;
  // add your exact ngrok host here too if a wildcard ever fails to match.
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
