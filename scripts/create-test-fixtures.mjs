import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const name = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return output;
};

const makeFixture = ({ width, height, palette, filename }) => {
  const bands = [0, 0.18, 0.39, 0.62, 0.81].map((ratio, index) => ({
    y: Math.floor(height * ratio),
    h: Math.floor(height * (index === 0 ? 0.11 : 0.015)),
    color: palette[index % palette.length],
    x: Math.floor(width * (index % 2 ? 0.12 : 0.08)),
    w: Math.floor(width * (index % 2 ? 0.7 : 0.5)),
  }));
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < width; x += 1) {
      let color = y < height * 0.1 ? palette[0] : [250, 250, 248, 255];
      const column = Math.floor(width / 12);
      if (x < column && y > height * 0.1) color = [239, 242, 242, 255];
      if (y > height * 0.14 && y < height * 0.34 && x > width * 0.07 && x < width * 0.92) {
        color = y < height * 0.23 ? palette[1] : [245, 247, 247, 255];
      }
      for (const band of bands) {
        if (y >= band.y && y < band.y + band.h && x >= band.x && x < band.x + band.w) color = band.color;
      }
      const cardTop = Math.floor(height * 0.43);
      const cardHeight = Math.floor(height * 0.105);
      if (y >= cardTop && y < cardTop + cardHeight && x > width * 0.1 && x < width * 0.9) {
        const card = Math.floor((x - width * 0.1) / (width * 0.27));
        if ((x - width * 0.1) % (width * 0.27) < width * 0.23) color = card % 2 ? palette[3] : palette[2];
      }
      const pixel = row + 1 + x * 4;
      pixels[pixel] = color[0];
      pixels[pixel + 1] = color[1];
      pixels[pixel + 2] = color[2];
      pixels[pixel + 3] = color[3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return writeFile(new URL("../public/test-fixtures/" + filename, import.meta.url), png);
};

await mkdir(new URL("../public/test-fixtures/", import.meta.url), { recursive: true });
await Promise.all([
  makeFixture({
    width: 480,
    height: 1800,
    filename: "sample-front.png",
    palette: [[36, 54, 65, 255], [208, 234, 228, 255], [90, 143, 135, 255], [227, 234, 230, 255], [242, 215, 175, 255]],
  }),
  makeFixture({
    width: 620,
    height: 2200,
    filename: "sample-back.png",
    palette: [[47, 54, 80, 255], [224, 223, 244, 255], [128, 117, 178, 255], [230, 228, 239, 255], [211, 224, 239, 255]],
  }),
]);
console.log("Created two synthetic, local PNG screenshots for cover testing.");
