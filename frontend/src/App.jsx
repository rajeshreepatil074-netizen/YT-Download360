import React from 'react'
import { HelmetProvider, Helmet } from 'react-helmet-async'
import DownloadForm from './components/DownloadForm'

export default function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>YouTube Downloader — Fast UI</title>
        <meta name="description" content="Download YouTube videos quickly using a lightweight, fast UI." />
      </Helmet>
      <div className="app">
        <header className="header">
          <h1>YouTube Downloader</h1>
          <p>Paste a YouTube URL and get a downloadable MP4.</p>
        </header>
        <main>
          <DownloadForm />
        </main>
      </div>
    </HelmetProvider>
  )
}
