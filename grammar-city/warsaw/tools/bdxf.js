// Parser binarnego DXF (R13+: 2-bajtowe kody grup). Zwraca tablicę [code, value].
const fs = require('fs');
function typeOf(c, b280) {
  if (c >= 0 && c <= 9) return 's';
  if (c >= 10 && c <= 59) return 'd';
  if (c >= 60 && c <= 79) return 'i16';
  if (c >= 90 && c <= 99) return 'i32';
  if (c === 100 || c === 102 || c === 105) return 's';
  if (c >= 110 && c <= 149) return 'd';
  if (c >= 160 && c <= 169) return 'i64';
  if (c >= 170 && c <= 179) return 'i16';
  if (c >= 210 && c <= 239) return 'd';
  if (c >= 270 && c <= 279) return 'i16';
  if (c >= 280 && c <= 289) return b280;
  if (c >= 290 && c <= 299) return 'i8';
  if (c >= 300 && c <= 309) return 's';
  if (c >= 310 && c <= 319) return 'bin';
  if (c >= 320 && c <= 369) return 's';
  if (c >= 370 && c <= 389) return 'i16';
  if (c >= 390 && c <= 399) return 's';
  if (c >= 400 && c <= 409) return 'i16';
  if (c >= 410 && c <= 419) return 's';
  if (c >= 420 && c <= 429) return 'i32';
  if (c >= 430 && c <= 439) return 's';
  if (c >= 440 && c <= 459) return 'i32';
  if (c >= 460 && c <= 469) return 'd';
  if (c >= 470 && c <= 481) return 's';
  if (c === 999) return 's';
  if (c >= 1000 && c <= 1003) return 's';
  if (c === 1004) return 'bin';
  if (c >= 1005 && c <= 1009) return 's';
  if (c >= 1010 && c <= 1059) return 'd';
  if (c >= 1060 && c <= 1070) return 'i16';
  if (c === 1071) return 'i32';
  throw new Error('unknown code ' + c);
}
module.exports = function parse(file, b280 = 'i8') {
  const b = fs.readFileSync(file);
  let i = 22; const out = [];
  while (i < b.length) {
    const c = b.readUInt16LE(i); i += 2;
    const t = typeOf(c, b280); let v;
    if (t === 's') { const e = b.indexOf(0, i); v = b.toString('latin1', i, e); i = e + 1; }
    else if (t === 'd') { v = b.readDoubleLE(i); i += 8; }
    else if (t === 'i16') { v = b.readInt16LE(i); i += 2; }
    else if (t === 'i32') { v = b.readInt32LE(i); i += 4; }
    else if (t === 'i64') { v = Number(b.readBigInt64LE(i)); i += 8; }
    else if (t === 'i8') { v = b.readUInt8(i); i += 1; }
    else if (t === 'bin') { const n = b.readUInt8(i); v = n; i += 1 + n; }
    out.push([c, v]);
    if (c === 0 && v === 'EOF') break;
  }
  return out;
};
