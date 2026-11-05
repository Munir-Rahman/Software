import 'dotenv/config';
import { config } from '../server/lib/config.js';
import { runBinary } from '../server/lib/process.js';
import path from 'node:path';
import { existsSync } from 'node:fs';

console.log('\nClipora dependency check\n');
let failed = false;
async function check(name, bin, args, required = true) {
  try {
    const { output } = await runBinary(bin, args, { timeoutMs: 15000, outputLimit: 100000 });
    console.log(`✓ ${name}: ${output.trim().split(/\r?\n/)[0].slice(0, 110)}`);
  } catch (error) {
    console.log(`✗ ${name}: NOT AVAILABLE (${error.code || error.message})`);
    if (required) failed = true;
  }
}
const localFf = name => config.ffmpegLocation ? path.join(config.ffmpegLocation, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name;
console.log('Node:', process.version);
console.log('Downloader path:', config.ytdlp);
console.log('FFmpeg location:', config.ffmpegLocation || 'system PATH');
await check('yt-dlp', config.ytdlp, ['--version']);
await check('FFmpeg', localFf('ffmpeg'), ['-version']);
await check('FFprobe', localFf('ffprobe'), ['-version']);
console.log('Node >=22:', Number(process.versions.node.split('.')[0]) >= 22 ? 'YES' : 'NO - upgrade for EJS');
if (process.platform === 'win32' && !existsSync(path.join(process.cwd(), 'tools', 'yt-dlp.exe'))) {
  console.log('For local project-managed Windows tools: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\setup-windows.ps1');
}
if (failed) process.exitCode = 1;
console.log('\nNote: Binary checks do not guarantee that a particular platform will allow extraction.\n');
