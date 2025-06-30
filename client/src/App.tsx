import { useState, useEffect } from 'react'
import axios from 'axios'
import { io } from "socket.io-client";

const API_URL = 'http://localhost:3000'
const socket = io(API_URL);

function App() {
  const [url, setUrl] = useState('')
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchDownloads = async () => {
    const res = await axios.get<any[]>(`${API_URL}/files`)
    setDownloads(Array.isArray(res.data) ? res.data : [])
  }

  useEffect(() => {
    socket.on("download-status", (data) => {
      console.log("Download status update:", data);
      fetchDownloads();
    });
    return () => {
      socket.off("download-status");
    };
  }, [])

  useEffect(() => {
    fetchDownloads()
    console.log('Fetching downloads from API...')
  }, [])

  const handleDownload = async () => {
    if (!url.trim()) {
      alert("Please enter a valid YouTube URL")
      return;
    }

    setLoading(true)
    try {
      console.log("Sending download request with URL:", url);
      await axios.post(`${API_URL}/download`, { url })
      setUrl('')
      fetchDownloads()
    } catch (err) {
      console.error("Download failed:", err);
      alert('Download failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl mb-4 font-bold">Music Downloader</h1>
      <input
        type="url"
        className="border px-2 py-1 w-full mb-2"
        placeholder="Paste YouTube URL..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        className="bg-blue-500 text-white px-4 py-1 rounded mb-4 disabled:opacity-50"
        onClick={handleDownload}
        disabled={loading || !url.trim()}
      >
        {loading ? "Downloading..." : "Download"}
      </button>

      <ul className="space-y-4 mt-6">
        {downloads.map((d) => (
          <li
            key={d.id}
            className="flex items-center bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow group"
          >
            <img
              src={d.thumbnail}
              alt={d.title}
              className="w-14 h-14 rounded-lg object-cover border border-gray-200 mr-4"
              width={56}
              height={56}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-lg" title={d.title}>
                {d.title}
              </div>
              <audio controls src={`${API_URL}${d.filePath}`} className="w-full mt-2" />
              <div className="text-xs text-gray-400 mt-1">Preview</div>
            </div>
            <div className="flex flex-col items-end ml-4 space-y-2">
              <a
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded flex items-center transition"
                href={`${API_URL}${d.filePath}`}
                download={d.title + '.mp3'}
                title="Download"
              >
                <span className="mr-1">⬇</span> Download
              </a>
              <button
                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition flex items-center justify-center"
                title="Delete"
                onClick={async () => {
                  await axios.delete(`${API_URL}/downloads/${d.id}`);
                  fetchDownloads();
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="red" width={24} height={24}>
                  <title>Delete</title>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
