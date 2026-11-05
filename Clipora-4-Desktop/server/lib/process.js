import { spawn } from 'node:child_process';

export async function runBinary(binary, args, { timeoutMs = 60000, onLine, outputLimit = 14 * 1024 * 1024, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { const error = new Error('cancelled'); error.code = 'CANCELLED'; reject(error); return; }
    let child;
    try { child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false, detached: process.platform !== 'win32' }); }
    catch (error) { reject(error); return; }
    let output = '', errors = '', bufferedOut = '', bufferedErr = '', bytes = 0;
    let killedFor = '', finished = false;
    const terminate = reason => {
      if (killedFor || finished) return;
      killedFor = reason;
      if (process.platform === 'win32' && child.pid) {
        // Kill ffmpeg children as well as yt-dlp on Windows.
        try { const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.on('error', () => child.kill('SIGKILL')); }
        catch { child.kill('SIGKILL'); }
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch { child.kill('SIGKILL'); }
      }
    };
    const timer = timeoutMs ? setTimeout(() => terminate('timeout'), timeoutMs) : null;
    const abort = () => terminate('cancelled');
    signal?.addEventListener('abort', abort, { once: true });
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result);
    };
    function lines(piece, pending) {
      const parts = (pending + piece.toString('utf8')).split(/\r\n|\n|\r/g);
      const rest = parts.pop() || '';
      for (const line of parts) if (line.length) onLine(line);
      return rest.slice(-4096);
    }
    child.stdout.on('data', data => {
      bytes += data.length;
      if (bytes > outputLimit) { terminate('output-limit'); return; }
      if (onLine) bufferedOut = lines(data, bufferedOut);
      else output += data.toString('utf8');
    });
    child.stderr.on('data', data => {
      errors = (errors + data.toString('utf8')).slice(-14000);
      if (onLine) bufferedErr = lines(data, bufferedErr);
    });
    child.on('error', error => finish(error));
    child.on('close', code => {
      if (onLine) { if (bufferedOut) onLine(bufferedOut); if (bufferedErr) onLine(bufferedErr); }
      if (killedFor) { const error = new Error(killedFor); error.code = killedFor.toUpperCase(); return finish(error); }
      if (code !== 0) { const error = new Error('Downloader subprocess exited with error'); error.stderr = errors; error.code = code; return finish(error); }
      finish(null, { output, errors });
    });
  });
}
