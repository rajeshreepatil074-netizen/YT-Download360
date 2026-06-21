const express = require('express');
const ytdl = require('ytdl-core');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Simple request logger to help debug 404s
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

app.post('/api/download', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !ytdl.validateURL(url)) return res.status(400).json({ error: 'Invalid URL' });
  try {
    const info = await fetchVideoInfo(url).catch(() => null);
    const title = (info && info.videoDetails && info.videoDetails.title) ? info.videoDetails.title : 'video';
    const safeTitle = title.replace(/[<>:\"/\\|?*]/g, '').slice(0, 120);
    const fileName = `${safeTitle}-${Date.now()}.mp4`;
    const filePath = path.join(downloadsDir, fileName);

    // Try ytdl streaming first
    try {
      const stream = ytdl(url, { quality: 'highest', filter: 'audioandvideo' });
      const writeStream = fs.createWriteStream(filePath);
      let responded = false;

      stream.pipe(writeStream);

      writeStream.on('finish', () => {
        if (responded) return;
        responded = true;
        console.log('Download saved to', filePath);
        res.json({ ok: true, file: `/downloads/${encodeURIComponent(fileName)}` });
      });

      const fallbackDownload = async (err) => {
        if (responded) return;
        responded = true;
        console.warn('ytdl stream error, attempting fallback:', err && err.message);
        try {
          try {
            writeStream.destroy();
          } catch (e) {}
          const youtubedl = require('youtube-dl-exec');
          await youtubedl(url, { output: filePath, noWarnings: true });
          console.log('Fallback download saved to', filePath);
          return res.json({ ok: true, file: `/downloads/${encodeURIComponent(fileName)}` });
        } catch (fallbackErr) {
          console.error('Fallback download failed', fallbackErr && fallbackErr.message);
          return res.status(502).json({ error: (fallbackErr && fallbackErr.message) || 'Download failed' });
        }
      };

      stream.on('error', fallbackDownload);
      writeStream.on('error', fallbackDownload);
    } catch (streamErr) {
      console.warn('ytdl streaming setup failed, attempting youtube-dl fallback', streamErr && streamErr.message);
      try {
        const youtubedl = require('youtube-dl-exec');
        await youtubedl(url, { output: filePath, noWarnings: true });
        return res.json({ ok: true, file: `/downloads/${encodeURIComponent(fileName)}` });
      } catch (fallbackErr) {
        console.error('Fallback download failed', fallbackErr && fallbackErr.message);
        return res.status(502).json({ error: (fallbackErr && fallbackErr.message) || 'Download failed' });
      }
    }
  } catch (err) {
    console.error('Download error', err && err.message);
    res.status(502).json({ error: err && err.message ? String(err.message) : 'Server error' });
  }
});

// Provide video metadata (thumbnail, title, author, duration, views)
// GET /api/info?url=... - convenient for browser checks
// helper: attempt to fetch info with simple retries
async function fetchVideoInfo(url, attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const info = await ytdl.getInfo(url);
      return info;
    } catch (err) {
      lastErr = err;
      console.warn(`ytdl.getInfo attempt ${i + 1} failed:`, err && err.message);
      // small backoff
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  // Try a yt-dlp fallback if available
  try {
    const youtubedl = require('youtube-dl-exec');
    console.log('Attempting youtube-dl-exec fallback');
    const out = await youtubedl(url, { dumpSingleJson: true, noWarnings: true });
    // Map yt-dlp output to shape similar to ytdl-core getInfo
    const infoLike = {
      videoDetails: {
        title: out.title || '',
        author: (out.uploader && out.uploader) || out.channel || '',
        lengthSeconds: out.duration ? String(out.duration) : '0',
        viewCount: out.view_count ? String(out.view_count) : '0',
        thumbnails: (out.thumbnails || []).map(t => ({ url: t.url })),
        description: out.description || ''
      }
    };
    return infoLike;
  } catch (fallbackErr) {
    console.warn('yt-dlp fallback failed', fallbackErr && fallbackErr.message);
    throw lastErr || fallbackErr;
  }
}

app.post('/api/info', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !ytdl.validateURL(url)) return res.status(400).json({ error: 'Invalid URL' });
  try {
    const info = await fetchVideoInfo(url);
    const vd = info.videoDetails || {};
    const thumbnails = vd.thumbnails || [];
    const thumbnail = thumbnails.length ? thumbnails[thumbnails.length - 1].url : (thumbnails[0] && thumbnails[0].url) || '';
    res.json({
      title: vd.title || '',
      author: (vd.author && vd.author.name) || vd.author || '',
      lengthSeconds: vd.lengthSeconds || '0',
      viewCount: vd.viewCount || '0',
      thumbnail,
      description: vd.description || ''
    });
  } catch (err) {
    console.error('Info error', err && err.message);
    res.status(502).json({ error: err && err.message ? String(err.message) : 'Failed to fetch video info' });
  }
});

app.get('/api/info', async (req, res) => {
  const url = req.query.url;
  if (!url || !ytdl.validateURL(url)) return res.status(400).json({ error: 'Invalid URL' });
  try {
    const info = await fetchVideoInfo(url);
    const vd = info.videoDetails || {};
    const thumbnails = vd.thumbnails || [];
    const thumbnail = thumbnails.length ? thumbnails[thumbnails.length - 1].url : (thumbnails[0] && thumbnails[0].url) || '';
    res.json({
      title: vd.title || '',
      author: (vd.author && vd.author.name) || vd.author || '',
      lengthSeconds: vd.lengthSeconds || '0',
      viewCount: vd.viewCount || '0',
      thumbnail,
      description: vd.description || ''
    });
  } catch (err) {
    console.error('Info GET error', err && err.message);
    res.status(502).json({ error: err && err.message ? String(err.message) : 'Failed to fetch video info' });
  }
});

app.get('/api/download', async (req, res) => {
  const url = req.query.url;
  if (!url || !ytdl.validateURL(url)) return res.status(400).send('Invalid URL');
  try {
    const info = await fetchVideoInfo(url).catch(() => null);
    const title = (info && info.videoDetails && info.videoDetails.title) ? info.videoDetails.title : 'video';
    const safeTitle = title.replace(/[<>:\"/\\|?*]/g, '').slice(0, 120);
    const fileName = `${safeTitle}.mp4`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Try streaming via ytdl
    try {
      const stream = ytdl(url, { quality: 'highest', filter: 'audioandvideo' });
      let responded = false;
      stream.pipe(res);
      stream.on('end', () => {
        responded = true;
      });
      stream.on('error', async (err) => {
        console.warn('ytdl stream error on GET, attempting fallback:', err && err.message);
        if (responded) return;
        // fallback: download to temp file then send
        const tmpName = `${safeTitle}-${Date.now()}.mp4`;
        const tmpPath = path.join(downloadsDir, tmpName);
        try {
          const youtubedl = require('youtube-dl-exec');
          await youtubedl(url, { output: tmpPath, noWarnings: true });
          res.download(tmpPath, fileName, (dErr) => {
            if (dErr) console.error('Error sending fallback file', dErr);
            try { fs.unlinkSync(tmpPath); } catch (e) {}
          });
        } catch (fallbackErr) {
          console.error('GET fallback failed', fallbackErr && fallbackErr.message);
          if (!res.headersSent) res.status(502).send('Download failed');
        }
      });
    } catch (streamErr) {
      console.warn('ytdl streaming setup failed on GET, attempting fallback', streamErr && streamErr.message);
      try {
        const tmpName = `${safeTitle}-${Date.now()}.mp4`;
        const tmpPath = path.join(downloadsDir, tmpName);
        const youtubedl = require('youtube-dl-exec');
        await youtubedl(url, { output: tmpPath, noWarnings: true });
        return res.download(tmpPath, fileName, (dErr) => {
          if (dErr) console.error('Error sending fallback file', dErr);
          try { fs.unlinkSync(tmpPath); } catch (e) {}
        });
      } catch (fallbackErr) {
        console.error('GET fallback failed', fallbackErr && fallbackErr.message);
        return res.status(502).send('Download failed');
      }
    }
  } catch (err) {
    console.error('Download GET error', err && err.message);
    res.status(502).send(err && err.message ? String(err.message) : 'Server error');
  }
});

app.use('/downloads', express.static(downloadsDir));

// Serve frontend build if present
const frontDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontDist)) {
  app.use(express.static(frontDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// 404 handler for unknown routes
app.use((req, res) => {
  if (req.url && req.url.startsWith('/api/')) {
    res.status(404).json({ error: 'Not Found', path: req.url });
  } else {
    res.status(404).send('Not Found');
  }
});

// Basic global handlers to prevent the process from exiting on unexpected errors
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
