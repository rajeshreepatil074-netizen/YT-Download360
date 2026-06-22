import React, { useState } from 'react'
import axios from 'axios'
// Prefer build-time Vite env, then a runtime global `window.__SERVER_BASE__`,
// then fall back to same-origin (useful when frontend is served by the backend),
// finally default to localhost for local development.
const SERVER_BASE =
  import.meta.env.VITE_SERVER_BASE ||
  (typeof window !== 'undefined' && window.__SERVER_BASE__) ||
  (typeof window !== 'undefined' && window.location && window.location.origin) ||
  'http://localhost:4000'
export default function DownloadForm() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('')
  const [link, setLink] = useState('')
  const [info, setInfo] = useState(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  function formatSeconds(s) {
    const sec = Number(s) || 0
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const ss = sec % 60
    return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
  }

  async function fetchInfo(e) {
    e && e.preventDefault()
    setLoadingInfo(true)
    setStatus('Fetching video info...')
    setInfo(null)
    setLink('')
    try {
     const res = await axios.post(
 `${SERVER_BASE}/api/info`,
 { url }
)
      if (res.data && res.data.title) {
        setInfo(res.data)
        setStatus('Info loaded')
      } else {
        setStatus('No info')
      }
    } catch (err) {
      console.error(err)
      const msg = (err.response && err.response.data && err.response.data.error) || err.message || 'Failed to fetch info'
      setStatus(msg)
    } finally {
      setLoadingInfo(false)
    }
  }

  async function handleDownload(e) {
    e.preventDefault()
    setStatus('Opening download...')
    // Use GET download which streams content and avoids server-side saving issues
    const dlUrl =
`${SERVER_BASE}/api/download?url=${encodeURIComponent(url)}`
    window.open(dlUrl, '_blank')
    setStatus('Download opened')
  }

  return (
    <div className="form">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="YouTube URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="input"
        />
        <button className="btn" onClick={fetchInfo} disabled={loadingInfo || !url}>
          {loadingInfo ? 'Fetching...' : 'Fetch'}
        </button>
        <button className="btn" onClick={handleDownload} disabled={!url}>
          Download
        </button>
      </div>

      <div className="status">{status}</div>

      {info && (
        <div className="result" style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {info.thumbnail && (
            <img src={info.thumbnail} alt="thumb" style={{ width: 200, borderRadius: 6 }} />
          )}
          <div>
            <h3 style={{ margin: '0 0 6px' }}>{info.title}</h3>
            <div>Author: {info.author}</div>
            <div>Duration: {formatSeconds(info.lengthSeconds)}</div>
            <div>Views: {info.viewCount}</div>
            {info.description && (
              <details style={{ marginTop: 8, maxWidth: 480 }}>
                <summary>Description</summary>
                <div style={{ whiteSpace: 'pre-wrap' }}>{info.description}</div>
              </details>
            )}
          </div>
        </div>
      )}

      {link && (
        <div className="result" style={{ marginTop: 12 }}>
          <a href={link} target="_blank" rel="noreferrer">Download file</a>
        </div>
      )}
    </div>
  )
}
