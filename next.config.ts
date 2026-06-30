import path from "path";
import type { NextConfig } from "next";

const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas", "tesseract.js", "xlsx"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
