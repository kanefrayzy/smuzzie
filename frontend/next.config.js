/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a deploy build into a separate folder (NEXT_DIST_DIR=.next-new) while the live
  // server keeps serving .next, then swap the folders and restart — no broken pages mid-build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    domains: ['localhost', 'via.placeholder.com', 'placehold.co'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
