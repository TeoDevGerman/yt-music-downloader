console.log('Starting server...');

import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import db from './db';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import http from 'http';
import sanitize from 'sanitize-filename';

const app = express();

const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
// app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const downloadsPath = path.join(__dirname, '../downloads');
if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath);
}

io.on('connection', (socket) => {
    console.log('Client connected');
});

async function downloadAudio({ url, title, thumbnail }: { url: string; title: string; thumbnail: string }) {
    const id = uuidv4();
    const safeTitle = sanitize(title) || 'audio';
    const outputFile = `${safeTitle}-${id}.mp3`;
    const outputPath = path.join(downloadsPath, outputFile);
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --ffmpeg-location "C:/ffmpeg/bin/ffmpeg.exe" -o "${outputPath}" "${url}"`;

    return new Promise(async (resolve, reject) => {
        exec(command, { maxBuffer: 1024 * 1024 * 10 }, async (err) => {
            if (err) return reject(err);

            await db.read();
            db.data ||= { downloads: [] };
            db.data.downloads.push({
                id,
                url,
                title,
                thumbnail,
                filePath: `/downloads/${encodeURIComponent(outputFile)}`,
                createdAt: new Date().toISOString(),
            });
            await db.write();

            resolve({ id, filePath: `/downloads/${encodeURIComponent(outputFile)}`, title, thumbnail });
        });
    });
}

app.post('/download', async (req: Request, res: Response) => {
    const { url } = req.body;
    // Accept both youtube.com and youtu.be links
    const youtubeRegex = /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//;
    if (!url || !youtubeRegex.test(url)) {
        res.status(400).json({ error: 'Invalid or missing YouTube URL' })
        return;
    }

    exec(`yt-dlp --flat-playlist --dump-json "${url}"`, { maxBuffer: 1024 * 1024 * 10 }, async (err, stdout, stderr) => {
        if (err) {
            console.error('Error fetching metadata:', err);
            console.error('stderr:', stderr);

            res.status(500).json({ error: 'Metadata fetch failed', details: err.message })
            return;
        }

        const lines = stdout.trim().split('\n').filter(Boolean);
        const entries = lines.map(line => JSON.parse(line));

        const results: any[] = [];
        let completed = 0;

        const processEntry = async (entry: any) => {
            const videoUrl = `https://www.youtube.com/watch?v=${entry.id}`;
            exec(`yt-dlp --dump-json "${videoUrl}"`, async (err, stdout) => {
                if (err) {
                    completed++;
                    if (completed === entries.length) res.json(results);
                    return;
                }
                const meta = JSON.parse(stdout);
                const { title, thumbnail } = meta;

                io.emit('download-status', { id: entry.id, status: 'started', title, thumbnail });
                try {
                    const result: any = await downloadAudio({ url: videoUrl, title, thumbnail });
                    io.emit('download-status', { id: result.id, status: 'finished', ...result });
                    results.push(result);
                } catch (error) {
                    io.emit('download-status', { id: entry.id, status: 'failed', title });
                }
                completed++;
                if (completed === entries.length) res.json(results);
            });
        };

        if (entries.length === 1 && !entries[0].playlist_count) {
            await processEntry(entries[0]);
        } else {
            for (const entry of entries) await processEntry(entry);
        }
    });
});

app.get('/files', async (_req, res) => {
    await db.read();
    const downloads = Array.isArray(db.data?.downloads) ? db.data.downloads : [];
    const enriched = downloads.map(d => {
        const file = path.join(downloadsPath, decodeURIComponent(path.basename(d.filePath)));
        return fs.existsSync(file) ? { ...d, size: fs.statSync(file).size } : d;
    });
    res.json(enriched);
});

app.delete('/downloads/:id', async (req, res) => {
    const id = req.params.id;
    await db.read();
    if (!db.data?.downloads) db.data = { downloads: [] };

    const fileEntry = db.data.downloads.find(d => d.id === id);
    if (fileEntry) {
        const file = path.join(downloadsPath, decodeURIComponent(path.basename(fileEntry.filePath)));
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    db.data.downloads = db.data.downloads.filter(d => d.id !== id);
    await db.write();
    res.status(204).send();
});

app.get('/downloads/:filename', (req, res) => {
    const filename = req.params.filename;
    const file = path.join(downloadsPath, filename);
    if (fs.existsSync(file)) {
        res.download(file);
    } else {
        res.status(404).send('File not found');
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
