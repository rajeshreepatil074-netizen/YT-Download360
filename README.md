# YouTube Downloader (React + Express)

This project is a simple YouTube downloader with a React frontend and Express backend. It saves downloaded files to the `backend/downloads` folder.

Quick start (Windows):

1. Install root dependencies (uses npm workspaces):

```bash
cd "d:/YT download"
npm install
```

2. Start backend (in one terminal):

```bash
cd "d:/YT download/backend"
npm run dev
```

3. Start frontend (in another terminal):

```bash
cd "d:/YT download/frontend"
npm run dev
```

Build and serve production:

```bash
cd "d:/YT download/frontend"
npm run build
cd "d:/YT download/backend"
npm start
```

Notes:
- This tool uses `ytdl-core`. Ensure you respect YouTube's Terms of Service.
- For better SEO you can pre-render pages or implement SSR; this project includes meta tags and a sitemap as a starting point.
