import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const LIBRARY_DIR = process.env.AURIGA_LIBRARY_DIR ?? "library";
const ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), LIBRARY_DIR);

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

/**
 * Serve the local scraped photography without copying 1.2 GB into /public.
 * Only image files are exposed; the catalogue JSON and source manifests stay
 * private to the app.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const relative = parts.join("/");
  const file = path.resolve(/* turbopackIgnore: true */ ROOT, relative);

  if (!file.startsWith(`${ROOT}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  const extension = path.extname(file).toLowerCase();
  const type = MIME[extension];
  if (!type) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const data = await readFile(file);
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
