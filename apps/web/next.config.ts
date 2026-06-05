import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@yardflow/types'],
};

export default nextConfig;
