import sharp from "sharp";

const [, , src, out, x, y, w, h, scaleArg] = process.argv;
const s = Number(scaleArg || 1);
await sharp(src)
  .extract({ left: Number(x), top: Number(y), width: Number(w), height: Number(h) })
  .resize(Math.round(Number(w) * s), Math.round(Number(h) * s), { kernel: "lanczos3" })
  .png()
  .toFile(out);
console.log("wrote", out);
