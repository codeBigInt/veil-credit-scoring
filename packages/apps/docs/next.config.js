/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export",
    turbopack: {
        root: new URL("../../..", import.meta.url).pathname,
    },
};

export default nextConfig;
