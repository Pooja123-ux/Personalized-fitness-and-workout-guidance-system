import { useEffect, useState } from 'react'
import api from '../api'

type Report = {
  id: number
  filename: string
  path: string
  summary?: string
  url?: string
}

function Reports() {
  const [items, setItems] = useState<Report[]>([])
  const [uploading, setUploading] = useState(false)

  const BACKEND_URL = api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000';

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const r = await api.get<Report[]>('/reports')
      setItems(r.data)
    } catch (err) {
      console.error('Failed to fetch reports', err)
    }
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      setUploading(true)
      await api.post('/reports/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await fetchReports()
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const openPdf = async (item: Report) => {
    try {
      const url = item.url ? item.url : `/reports/download/${item.id}`
      const res = await api.get(url, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const objUrl = window.URL.createObjectURL(blob)
      window.open(objUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(objUrl), 10000)
    } catch (err) {
      console.error('Failed to open PDF', err)
    }
  }

  const parseSummary = (s?: string) => {
    if (!s) return null;
    try {
      const data = JSON.parse(s);
      return data;
    } catch {
      return null;
    }
  };

  return (
    <div className="reports-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .reports-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 24px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          min-height: 100vh;
          background: #f8fafc;
          box-sizing: border-box;
        }

        .reports-header {
          text-align: left;
          margin-bottom: 40px;
        }

        .reports-header h2 {
          font-size: 2.5rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0;
          letter-spacing: -1.5px;
        }

        .reports-header p {
          color: #64748b;
          font-size: 1.1rem;
          margin-top: 8px;
          font-weight: 500;
        }

        .upload-zone {
          margin-bottom: 40px;
        }

        .upload-card {
          display: flex;
          align-items: center;
          gap: 25px;
          background: white;
          border: 2px dashed #e2e8f0;
          padding: 35px;
          border-radius: 32px;
          cursor: pointer;
          transition: 0.3s ease;
          box-shadow: 0 10px 25px rgba(0,0,0,0.02);
        }

        .upload-card:hover {
          border-color: #6366f1;
          background: #fcfcff;
          transform: translateY(-2px);
        }

        .upload-card.processing {
          opacity: 0.7;
          cursor: not-allowed;
          border-color: #6366f1;
          background: #f5f3ff;
        }

        .upload-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: white;
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.2);
        }

        .upload-text strong {
          display: block;
          font-size: 1.2rem;
          font-weight: 800;
          color: #1e293b;
        }

        .upload-text span {
          font-size: 0.95rem;
          color: #64748b;
          font-weight: 500;
        }

        .reports-grid {
          display: grid;
          gap: 25px;
        }

        .vault-card {
          background: white;
          border-radius: 32px;
          padding: 30px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          transition: 0.3s ease;
        }

        .vault-card:hover {
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05);
        }

        .vault-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 25px;
        }

        .file-icon {
          background: #fee2e2;
          color: #ef4444;
          font-size: 0.75rem;
          font-weight: 800;
          padding: 12px;
          border-radius: 14px;
          letter-spacing: 0.5px;
        }

        .file-info {
          flex-grow: 1;
        }

        .file-name {
          font-size: 1.15rem;
          font-weight: 800;
          color: #1e293b;
          text-decoration: none;
          display: block;
          transition: 0.2s;
        }

        .file-name:hover {
          color: #6366f1;
        }

        .file-date {
          font-size: 0.85rem;
          color: #94a3b8;
          font-weight: 600;
        }

        .view-btn {
          padding: 12px 24px;
          border-radius: 16px;
          background: #10b981;
          color: white;
          font-size: 0.9rem;
          font-weight: 800;
          text-decoration: none;
          transition: 0.3s ease;
          box-shadow: 0 10px 15px rgba(16, 185, 129, 0.2);
        }

        .view-btn:hover {
          transform: translateY(-2px);
          background: #059669;
        }

        .summary-box {
          background: #f8fafc;
          border-radius: 24px;
          padding: 24px;
          border-left: 6px solid #10b981;
        }

        .summary-label {
          font-size: 0.8rem;
          font-weight: 800;
          color: #059669;
          text-transform: uppercase;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: 1px;
        }

        .empty-state {
          text-align: center;
          padding: 100px 0;
          color: #94a3b8;
          font-weight: 700;
        }
      `}</style>

      <header className="reports-header">
        <h2>Medical Records</h2>
        <p>Your secure health vault with AI-powered insights.</p>
      </header>

      <div className="upload-zone">
        <label className={`upload-card ${uploading ? 'processing' : ''}`}>
          <div className="upload-icon">{uploading ? '⏳' : '➕'}</div>
          <div className="upload-text">
            <strong>{uploading ? 'Processing PDF...' : 'Upload Medical Report'}</strong>
            <span>PDFs are analyzed for key health markers</span>
          </div>
          <input
            type="file"
            onChange={upload}
            accept="application/pdf"
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="reports-grid">
        {items.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: '4rem', display: 'block', marginBottom: '20px' }}>📂</span>
            <p>No reports found. Upload your first medical record.</p>
          </div>
        ) : (
          items.map((i) => (
            <div key={i.id} className="vault-card">
              <div className="vault-header">
                <div className="file-icon">PDF</div>
                <div className="file-info">
                  <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); openPdf(i); }}
                    className="file-name"
                  >
                    {i.filename}
                  </a>
                  <span className="file-date">Recently Uploaded</span>
                </div>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); openPdf(i); }}
                  className="view-btn"
                >
                  View PDF
                </a>
              </div>
              
              {i.summary && (
                <div className="summary-box">
                  <div className="summary-label">
                    <span className="sparkle">✨</span> AI Health Summary
                  </div>
                  {(() => {
                    const data = parseSummary(i.summary);
                    if (!data) {
                      return <p style={{ margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{i.summary}</p>;
                    }
                    const conditions: string[] = data.conditions || [];
                    const consume: string[] = data.foods_to_consume || [];
                    const avoid: string[] = data.foods_to_avoid || [];
                    const labs = data.labs || {};
                    return (
                      <div>
                        {conditions.length > 0 && (
                          <div style={{ marginBottom: 15 }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 800, marginBottom: 8 }}>
                              Detected Conditions
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {conditions.map((c) => (
                                <span key={c} style={{ background: '#ecfeff', color: '#0891b2', padding: '6px 14px', borderRadius: 12, fontWeight: 800, fontSize: '0.8rem' }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {Object.keys(labs).length > 0 && (
                          <div style={{ marginBottom: 15 }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 800, marginBottom: 8 }}>
                              Key Labs
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {Object.entries(labs).map(([k, v]) => (
                                <span key={k} style={{ background: 'white', border: '1px solid #e2e8f0', color: '#0f172a', padding: '6px 14px', borderRadius: 12, fontWeight: 800, fontSize: '0.8rem' }}>
                                  {k.toUpperCase()}: {String(v)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15 }}>
                          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 20, padding: 18 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#16a34a', marginBottom: 10 }}>
                              Foods To Consume
                            </div>
                            {consume.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {consume.slice(0, 18).map((f) => (
                                  <span key={f} style={{ background: 'white', color: '#065f46', padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', border: '1px solid #bbf7d0' }}>
                                    {f}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: '#16a34a', opacity: 0.8, fontWeight: 700, fontSize: '0.9rem' }}>Not available</div>
                            )}
                          </div>
                          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 20, padding: 18 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#dc2626', marginBottom: 10 }}>
                              Foods To Avoid
                            </div>
                            {avoid.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {avoid.slice(0, 18).map((f) => (
                                  <span key={f} style={{ background: 'white', color: '#7f1d1d', padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', border: '1px solid #fecaca' }}>
                                    {f}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: '#dc2626', opacity: 0.8, fontWeight: 700, fontSize: '0.9rem' }}>Not available</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Reports