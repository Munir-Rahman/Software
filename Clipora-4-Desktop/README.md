# Clipora Desktop 4.1 — Format chooser, restored web card and Chrome Downloads

Clipora is a **local desktop downloader** with a React website, an Express/yt-dlp/FFmpeg processing engine, and a Chrome/Edge Manifest V3 extension. The extension uses Chrome's native `chrome.downloads` API: files appear in the browser's Downloads panel (`Ctrl+J`) and in the PC's `Downloads/Clipora` folder. The extension popup can show Clipora processing progress while media is being extracted. It **does not** need to open the Clipora website to initiate downloads.

**Important:** Unlike a static website, supported social-platform extraction requires the **local Clipora process and yt-dlp/FFmpeg** to be running on your PC. Direct media links (JPEG, PNG, MP4, etc.) can be handled by Chrome directly. This does not bypass DRM, private access, or source-site restrictions. Download media you own or have permission to save.

## 1 — Run Clipora on Windows

Requirements: Windows 10/11 x64, Node.js 22.12+ and internet access. On the first installation:

```powershell
cd "D:\Github\1.Downloader\Clipora-4-Desktop"
.\SETUP-CLIPORA.cmd
```

`SETUP-CLIPORA.cmd` installs npm dependencies and verified yt-dlp/FFmpeg executables into `tools/`. The first install downloads a large FFmpeg archive. No administrator rights or system-wide PATH changes are needed. Check your internet connection and disk space. If the checksum installer reports a failure, **do not turn off checksum verification**.

For daily use:

```powershell
cd "D:\Github\1.Downloader\Clipora-4-Desktop"
.\START-CLIPORA.cmd
```

Leave that terminal running. It shows two important items:

```text
Clipora listening on http://127.0.0.1:3001
CLIPORA CHROME EXTENSION PAIRING CODE: ########
```

The website is at **http://127.0.0.1:5173** when started with `npm.cmd run dev`. To troubleshoot tools, run `npm.cmd run doctor`.

**If port 3001 or 5173 is already in use**, close the previous Clipora version first. The extension is configured for the local API port **3001**.

## 2 — Download and install the updated browser extension

1. Visit **https://clipora-4-desktop.vercel.app/#extension** and click **Download extension ZIP** (or use the direct download URL **https://clipora-4-desktop.vercel.app/downloads/clipora-chrome-edge-extension-v4.zip**). Extract the ZIP into a folder on your computer.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. **Remove or disable the old Clipora extension** (version 3) to avoid duplicate buttons.
5. Click **Load unpacked** and choose exactly the extracted `Clipora-Extension` folder (containing `manifest.json`), or `Clipora-4-Desktop/browser-extension` if you are using the source repository.
6. Pin the **Clipora — One Click Media Downloader** extension to the toolbar.
7. Click the extension and enter the **8-digit pairing code displayed in the Clipora terminal**.
8. Paste a video, audio, image, or playlist URL and click **Check formats**.
9. Choose MP4 quality or MP3 bitrate and click **Download to Chrome**. For playlists, select the individual videos.

Extensions from ZIP files require manual unpacked installation; Chrome will not silently install them. To distribute automatically through Chrome, publish through the official Chrome Web Store review process.

The downloaded files appear in `chrome://downloads/` and normally in `%USERPROFILE%\Downloads\Clipora\Videos`, `Audio`, or `Images`, unless you changed Chrome's download directory. You can also use Chrome's **Ask where to save each file** setting.

**Pairing again:** For security, the extension's desktop pairing authorization is stored in memory. After restarting the Clipora server, or after a day, use the **new** code printed in the terminal. The 8-digit code is never sent to arbitrary websites.

## 3 — Download without opening Clipora website

### A. Paste a link into the extension

Click the Clipora icon -> paste a supported link -> **Check formats** -> choose quality/type -> **Download to Chrome**. The extension communicates with the local engine without opening a webpage. For images and direct media files Chrome downloads the URL itself. For social links the local server uses yt-dlp and FFmpeg to prepare the output.

### B. Download buttons on webpages

Open any regular HTTPS webpage. Click the Clipora extension icon -> **Show page buttons**. A small **↓ Clipora** button appears on discoverable HTML images and videos. Clicking it starts a download without navigating to Clipora. For streaming players without an accessible direct file, the extension tries extracting the hosting page URL. This may fail on unsupported sites and DRM-protected streams.

### C. Right-click

Right-click an image, video, audio, link or page -> **Download with Clipora**. Direct media URLs download in Chrome. Social-post URLs are inspected by the local engine. For playlists choose individual items in the extension popup instead of using one-click download.

## 4 — Understand the two progress stages

1. **Preparation (yt-dlp/FFmpeg):** Clipora retrieves, merges, or converts formats on the local PC. The extension's **Recent downloads** view shows job progress, speed and ETA when the extractor reports them. Chrome's download entry is created at download initiation; during preparation its byte progress can be unknown or appear to be 0.
2. **Chrome file transfer:** When the local file is ready, the engine sends the file through the local HTTP connection directly to Chrome. Chrome maintains its native download history, saved file and browser download UI. Its byte progress may be indeterminate because the response is streamed without a preknown Content-Length.

For large downloads, the local engine temporarily uses disk space in `server/runtime` and later writes the final copy into Chrome's Downloads folder. A browser/network interruption can cancel the local job; use Clipora again to retry if necessary. The desktop website offers a manual **Save to device** fallback. Do **not** close the server while files are being processed.

## 5 — Website improvements

The same React website remains available. It includes a new **Automatically send completed downloads to Chrome Downloads** checkbox (on by default). After a video is prepared, a normal browser attachment download is initiated automatically. The **Save to device** button remains available if Chrome prevents automatic downloads. The server continues to show preparation progress in the page.

## 6 — Supported media and limits

- Individual public videos/posts: YouTube, Instagram, TikTok, Facebook, X, Vimeo, Reddit, Dailymotion, Pinterest, Twitch, plus other sites that the bundled yt-dlp binary recognizes from the explicit platform list.
- YouTube playlists: select videos in the extension or website; a maximum number of items is enforced by the server.
- Original direct media: common HTTPS files such as JPG/PNG/GIF/WebP, MP4/WebM/MOV, MP3/M4A/WAV/OGG.
- MP4 resolutions: only those found by the extractor; higher resolutions may need separate video and audio tracks and FFmpeg merging.
- MP3 encoded output bitrates: 64, 96, 128, 160, 192, 256 or 320 **kbps**. Re-encoding to a high bitrate **cannot improve source quality**.
- Large downloads: bounded by `.env` settings (`MAX_DOWNLOAD_MB`, `MAX_TOTAL_MB`, `JOB_TIMEOUT_MINUTES`). Chrome/network connection timeouts are outside the project's control.

**No guarantee:** yt-dlp providers can change without notice. Some media require cookies/authentication, are encrypted, or are not available in your region; this release does not attempt to bypass authorization or DRM. Image buttons are for media elements visible to the extension and not arbitrary CSS/background content. No silently installed extension and no full-device browser interception.

## 7 — Testing and troubleshooting

```powershell
npm.cmd test
npm.cmd run doctor
npm.cmd run dev
```

- **"Clipora is not running"**: start `START-CLIPORA.cmd`; verify `http://127.0.0.1:3001/api/health` opens.
- **"Extension disconnected"**: close/reopen the popup and re-enter the current pairing code in the terminal.
- **Download not showing in Chrome**: check `Ctrl+J`; check whether Chrome blocked automatic downloads; verify extension `downloads` permission; look at the popup's error message.
- **"yt-dlp missing"**: rerun `SETUP-CLIPORA.cmd`; `npm.cmd run doctor` reports which binaries are unavailable.
- **Unsupported social link**: test the link in the website's **Find my video** feature; use only a specific public media URL, not a social homepage.
- **Long download interrupted**: Chrome may drop idle local HTTP downloads before conversion finishes. Retry using the website then click **Save to device** after preparation; this path returns a complete file with a known size.
- **Hosted web version**: static deployments such as Vercel can serve the React UI, but **cannot replace the local persistent yt-dlp/FFmpeg engine** used by this extension.

## 8 — Security

The server binds to `127.0.0.1` by default, has strict URL validation and download quotas, and requires an 8-digit per-server-start code for extension pairing. Browser-extension API routes require a random per-session token. Browser download routes require signed, time-limited job-specific tickets. The extension cannot invoke these APIs from an arbitrary website origin. Keep `HOST=127.0.0.1` when using the local extension.

This is a **tested source prototype**, not a verified production build. Node tests and source syntax checks were performed, but a complete npm install, real Chrome extension deployment, Windows binary setup and downloads from each provider were not executed in the build environment. Test thoroughly before public distribution.


## Public Vercel preview and contact

The public Vercel build uses `VITE_HOSTED_PREVIEW=1` and **keeps the original paste-link, quality selection and download card**. With the latest Clipora Chrome/Edge extension installed and paired to the local Windows engine, the hosted React UI can ask the extension to inspect URLs and submit supported downloads into Chrome Downloads. Without that extension and engine, the form explains why processing is unavailable. Vercel itself **does not run** the persistent local yt-dlp/FFmpeg engine. Static direct images and media URLs may be downloadable by Chrome without the engine if the extension is installed.

Project author: **Munir Rahman Rahmani** · contact: **munirrahmanrahmani0@gmail.com** · GitHub: https://github.com/Munir-Rahman/Software/tree/main/Clipora-4-Desktop

Deploy this project to Vercel from the `Clipora-4-Desktop` root directory using framework **Vite**, build command `npm run build`, output directory `dist`, and production environment variable `VITE_HOSTED_PREVIEW=1`.

Never commit `.env`, tools, binaries, downloads, or `server/runtime/` to a public repository.


## Public download center (Vercel)

Visit **https://clipora-4-desktop.vercel.app/#downloads** for explicitly labeled packages:

- **Windows desktop source ZIP:** `/downloads/clipora-desktop-windows-source-v4.zip` — source and setup scripts, not a signed `.exe`.
- **Android/iPhone React Native source ZIP:** `/downloads/clipora-mobile-android-ios-source.zip` — development source, not an APK/IPA, mobile extraction on iOS not implemented.
- **Chrome/Edge extension ZIP:** `/downloads/clipora-chrome-edge-extension-v4.zip` — unpack manually via browser extensions page.

The website on Vercel now retains the original paste-link downloader card. For actual format inspection and saving on Vercel, install the Clipora extension and (for YouTube and social links) start and pair the local Windows engine. The static site itself cannot execute yt-dlp.

**Do not claim that the mobile source ZIP installs as an app.** A verified native APK requires an Android build; iPhone IPA requires Apple signing and distribution. No such binaries are included in this release.

## 4.1 — Choose MP4/MP3 before downloading from YouTube

1. Start your local Clipora Windows engine and open the updated Chrome/Edge extension popup. Enter the 8-digit pairing code from the terminal once per engine session.
2. Open a YouTube video or channel and click **Show page buttons** in the Clipora popup. The extension displays **Clipora video** badges on video thumbnails and a video player, not an image-download action for YouTube WebP thumbnails.
3. Click a badge. An on-page dialog checks the **video's watch URL**, displays its name, and lets you pick **MP4 resolution** or **MP3 bitrate**, then **Download to Chrome**. Downloads appear in `Ctrl+J` / `Downloads/Clipora`.
4. Alternatively, right-click a linked YouTube thumbnail and choose **Download with Clipora** to open the format picker in a separate extension window, or use the main popup with a pasted URL. The browser extension **must be reloaded in chrome://extensions** after replacing an older version.
5. The same URL-paste card is visible on the public Vercel site. If Chrome has the extension installed and paired, the website delegates extraction to the extension; without it, it explains the missing local engine rather than pretending the site can download independently.

**Limits:** the badging is best-effort for supported page structures. Resolutions come from the provider's accessible streams; MP3 bitrates are encoding targets, not guarantees of source audio quality. The extension cannot decrypt DRM, fetch private course lessons, or guarantee every provider. Extension use and live YouTube downloads require device testing.
