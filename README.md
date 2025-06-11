# YouTube Music Downloader

A full-stack web application to download audio from YouTube videos and playlists as MP3 files. Built with React, TypeScript, Vite (client), and Node.js/Express (server).

## Features
- Paste a YouTube video or playlist URL to download audio as MP3
- View, play, and download your previously downloaded files
- Delete downloaded files from the UI
- Real-time download status updates via WebSockets
- Clean and modern UI

## Tech Stack
- **Frontend:** React, TypeScript, Vite, Axios, Socket.IO Client
- **Backend:** Node.js, Express, TypeScript, Socket.IO, lowdb, yt-dlp, ffmpeg

## Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available in PATH
- [ffmpeg](https://ffmpeg.org/) installed (update the path in `server/src/index.ts` if needed)

## Getting Started

### 1. Clone the repository
```sh
git clone <your-repo-url>
cd yt-music-downloader
```

### 2. Install dependencies
```sh
cd server && npm install
cd ../client && npm install
```

### 3. Start the backend server
```sh
cd server
npm run dev
```
The server runs on [http://localhost:3000](http://localhost:3000)

### 4. Start the frontend client
```sh
cd client
npm run dev
```
The client runs on [http://localhost:5173](http://localhost:5173) by default.

## Usage
1. Open the client in your browser.
2. Paste a YouTube video or playlist URL into the input field.
3. Click "Download". The server will fetch and convert the audio, and the download will appear in the list.
4. You can play, download, or delete files from the UI.

## Project Structure
```
client/   # React frontend
server/   # Express backend
```

## Notes
- Downloaded files are stored in `server/downloads/` and tracked in `server/db.json`.
- The server uses `yt-dlp` and `ffmpeg` for downloading and converting audio.
- Make sure the `ffmpeg` path in `server/src/index.ts` matches your system.

## License
MIT
