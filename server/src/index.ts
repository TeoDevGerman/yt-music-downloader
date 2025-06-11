console.log('Starting server...');

import express, { Request, Response } from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import db from './db'
import { v4 as uuidv4 } from 'uuid'

import { Server } from "socket.io";
import http from "http";

import sanitize from 'sanitize-filename';

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    console.log("Client connected");
});


const downloadsPath = path.join(__dirname, '../downloads');
if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath);
}

// app.use('/downloads', express.static(path.join(__dirname, '../downloads')))

app.post('/download', async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: 'No URL provided' });
        return;
    }

    exec(`yt-dlp --flat-playlist --dump-json "${url}"`, async (err, stdout, stderr) => {
        if (err) {
            console.error(stderr);
            res.status(500).json({ error: 'Metadata fetch failed' });
            return;
        }
        const lines = stdout.trim().split('\n').filter(Boolean);
        const entries = lines.map(line => JSON.parse(line));

        // Single video
        if (entries.length === 1 && !entries[0].playlist_count) {
            exec(`yt-dlp --dump-json "${url}"`, async (err, stdout, stderr) => {
                if (err) {
                    console.error(stderr);
                    res.status(500).json({ error: 'Metadata fetch failed' });
                    return;
                }
                const meta = JSON.parse(stdout);
                const title = meta.title;
                const thumbnail = meta.thumbnail;
                const id = uuidv4();
                const safeTitle = sanitize(title) || "audio";
                const outputFile = `${safeTitle}-${id}.mp3`;
                const outputPath = path.join(__dirname, `../downloads/${outputFile}`);
                const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --ffmpeg-location "C:/ffmpeg/bin/ffmpeg.exe" -o "${outputPath}" "${url}"`;
                io.emit("download-status", { id, status: "started", title, thumbnail });
                exec(command, async (err, stdout, stderr) => {
                    if (err) {
                        console.error(stderr);
                        io.emit("download-status", { id, status: "failed", title, thumbnail });
                        res.status(500).json({ error: 'Download failed' });
                        return;
                    }

                    await db.read();
                    db.data ||= { downloads: [] };
                    if (!Array.isArray(db.data.downloads)) {
                        db.data.downloads = [];
                    }
                    db.data!.downloads.push({
                        id,
                        url,
                        title,
                        thumbnail,
                        filePath: `/downloads/${encodeURIComponent(outputFile)}`,
                        createdAt: new Date().toISOString()
                    });
                    await db.write();

                    io.emit("download-status", { id, status: "finished", title, thumbnail, filePath: `/downloads/${encodeURIComponent(outputFile)}` });

                    res.json([{ id, file: `/downloads/${encodeURIComponent(outputFile)}`, title, thumbnail }]);
                });
            });
            return;
        }

        // Playlist or Mix
        const results: any[] = [];
        let completed = 0;
        for (const entry of entries) {
            const videoUrl = `https://www.youtube.com/watch?v=${entry.id}`;
            exec(`yt-dlp --dump-json "${videoUrl}"`, async (err, stdout, stderr) => {
                if (err) {
                    console.error(stderr);
                    completed++;
                    if (completed === entries.length) {
                        await db.write();
                        res.json(results);
                    }
                    return;
                }
                const meta = JSON.parse(stdout);
                const title = meta.title;
                const thumbnail = meta.thumbnail;
                const id = uuidv4();
                const safeTitle = sanitize(title) || "audio";
                const outputFile = `${safeTitle}-${id}.mp3`;
                const outputPath = path.join(__dirname, `../downloads/${outputFile}`);
                const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --ffmpeg-location "C:/ffmpeg/bin/ffmpeg.exe" -o "${outputPath}" "${videoUrl}"`;
                io.emit("download-status", { id, status: "started", title, thumbnail });
                exec(command, async (err, stdout, stderr) => {
                    if (!err) {
                        await db.read();
                        db.data ||= { downloads: [] };
                        if (!Array.isArray(db.data.downloads)) {
                            db.data.downloads = [];
                        }
                        db.data!.downloads.push({
                            id,
                            url: videoUrl,
                            title,
                            thumbnail,
                            filePath: `/downloads/${encodeURIComponent(outputFile)}`,
                            createdAt: new Date().toISOString()
                        });
                        results.push({
                            id,
                            file: `/downloads/${encodeURIComponent(outputFile)}`,
                            title,
                            thumbnail
                        });
                    }
                    io.emit("download-status", { id, status: "finished", title, thumbnail, filePath: `/downloads/${encodeURIComponent(outputFile)}` });
                    completed++;
                    if (completed === entries.length) {
                        await db.write();
                        res.json(results);
                    }
                });
            });
        }
    });
});



app.get('/files', async (req, res) => {
    await db.read()
    res.json(Array.isArray(db.data?.downloads) ? db.data.downloads : [])
})

app.delete('/downloads/:id', async (req, res) => {
    await db.read();
    if (!db.data) db.data = { downloads: [] };
    db.data.downloads = db.data.downloads.filter(d => d.id !== req.params.id);
    await db.write();
    res.status(204).send();
});

app.get('/downloads/:filename', (req, res) => {
    const filename = req.params.filename;
    const file = path.join(__dirname, '../downloads', filename);
    if (fs.existsSync(file)) {
        res.download(file);
    } else {
        res.status(404).send('File not found');
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});