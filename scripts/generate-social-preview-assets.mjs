import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const asset = (path) => fileURLToPath(new URL(`../public/assets/${path}`, import.meta.url));
const output = fileURLToPath(new URL("../public/assets/social/", import.meta.url));
const width = 1200;
const height = 630;

await mkdir(output, { recursive: true });

const ganSymbol = await sharp(asset("company-symbol.png")).resize(340, 340).png().toBuffer();
const ganName = await sharp(asset("company-name.png")).resize({ width: 590 }).png().toBuffer();
const ganNameHeight = (await sharp(ganName).metadata()).height ?? 200;

await sharp({ create: { width, height, channels: 4, background: "#f4f8ff" } })
  .composite([
    { input: ganSymbol, left: 430, top: 50 },
    { input: ganName, left: 305, top: 394 + Math.round((180 - ganNameHeight) / 2) },
  ])
  .png({ compressionLevel: 9 })
  .toFile(`${output}gan-batuach.png`);

const observerMark = await sharp(await readFile(asset("digital-observer/app-icon.svg")))
  .resize(380, 380)
  .png()
  .toBuffer();

await sharp({ create: { width, height, channels: 4, background: "#061d3a" } })
  .composite([{ input: observerMark, left: 410, top: 125 }])
  .png({ compressionLevel: 9 })
  .toFile(`${output}digital-observer.png`);
