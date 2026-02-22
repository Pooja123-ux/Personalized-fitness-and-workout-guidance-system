import { useEffect, useMemo, useState } from 'react'
import api from '../api'

type Report = {
  id: number | string
  filename: string
  path: string
  summary?: string
  url?: string
}

type TrendDirection = 'up' | 'down' | 'same'

type DiseaseTrendAlert = {
  condition: string
  lab: string
  previousValue: string
  currentValue: string
  direction: TrendDirection
  changePercent: number | null
  level: 'warning' | 'good' | 'neutral'
}

function Reports() {
  const [items, setItems] = useState<Report[]>([])
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const removeReport = async (item: Report) => {
    const idStr = String(item.id)
    const ok = window.confirm(`Delete report "${item.filename}"? This cannot be undone.`)
    if (!ok) return
    try {
      setDeletingId(idStr)
      await api.delete(`/reports/${item.id}`)
      await fetchReports()
    } catch (err) {
      console.error('Delete failed', err)
      window.alert('Failed to delete report. Please try again.')
    } finally {
      setDeletingId(null)
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

  const normalizeText = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const toTitleCase = (value: string): string =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const parseNumericValue = (raw: unknown): number | null => {
    if (raw === null || raw === undefined) return null;
    const str = String(raw).trim();
    if (!str) return null;
    const bpMatch = str.match(/(\d+(?:\.\d+)?)\s*[/:-]\s*(\d+(?:\.\d+)?)/);
    if (bpMatch) {
      const systolic = Number(bpMatch[1]);
      const diastolic = Number(bpMatch[2]);
      if (Number.isFinite(systolic) && Number.isFinite(diastolic)) {
        return (systolic + diastolic) / 2;
      }
    }
    const numMatch = str.match(/-?\d+(?:\.\d+)?/);
    if (!numMatch) return null;
    const parsed = Number(numMatch[0]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseBloodPressureParts = (raw: unknown): { systolic: number; diastolic: number } | null => {
    const str = String(raw || '').trim();
    const match = str.match(/(\d+(?:\.\d+)?)\s*[/:-]\s*(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const systolic = Number(match[1]);
    const diastolic = Number(match[2]);
    if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
    return { systolic, diastolic };
  };

  const canonicalSummary = (report: Report): string => {
    const parsed = parseSummary(report.summary);
    if (parsed && typeof parsed === 'object') {
      const conditions = Array.isArray(parsed.conditions) ? parsed.conditions.map((x: string) => normalizeText(String(x))).sort() : [];
      const consume = Array.isArray(parsed.foods_to_consume) ? parsed.foods_to_consume.map((x: string) => normalizeText(String(x))).sort() : [];
      const avoid = Array.isArray(parsed.foods_to_avoid) ? parsed.foods_to_avoid.map((x: string) => normalizeText(String(x))).sort() : [];
      const labs = parsed.labs && typeof parsed.labs === 'object'
        ? Object.entries(parsed.labs as Record<string, unknown>)
            .map(([k, v]) => `${normalizeText(String(k))}:${normalizeText(String(v ?? ''))}`)
            .sort()
        : [];
      const signature = JSON.stringify({ conditions, consume, avoid, labs });
      if (signature !== '{"conditions":[],"consume":[],"avoid":[],"labs":[]}') return `json:${signature}`;
    }
    const rawSummary = normalizeText(String(report.summary || ''));
    if (rawSummary) return `text:${rawSummary}`;
    const fallbackName = normalizeText(report.filename.replace(/\.pdf$/i, ''));
    return `file:${fallbackName}`;
  };

  const reportComparison = useMemo(() => {
    const groups = new Map<string, Report[]>();
    for (const item of items) {
      const key = canonicalSummary(item);
      const existing = groups.get(key) || [];
      existing.push(item);
      groups.set(key, existing);
    }

    const duplicateGroups = Array.from(groups.values()).filter((group) => group.length > 1);
    const duplicateReportsCount = duplicateGroups.reduce((sum, group) => sum + group.length, 0);
    const latestReport = items[0];
    const latestIsDuplicate = latestReport
      ? duplicateGroups.some((group) => group.some((entry) => entry.id === latestReport.id))
      : false;

    const itemsOldestFirst = [...items].reverse();
    const conditionToReports = new Map<string, Array<{ report: Report; labs: Record<string, unknown> }>>();
    for (const report of itemsOldestFirst) {
      const summary = parseSummary(report.summary);
      if (!summary || typeof summary !== 'object') continue;
      const rawConditions = Array.isArray(summary.conditions) ? summary.conditions : [];
      const labs = summary.labs && typeof summary.labs === 'object' ? (summary.labs as Record<string, unknown>) : {};
      for (const rawCondition of rawConditions) {
        const condition = normalizeText(String(rawCondition));
        if (!condition) continue;
        const list = conditionToReports.get(condition) || [];
        list.push({ report, labs });
        conditionToReports.set(condition, list);
      }
    }

    const diseaseTrendAlerts: DiseaseTrendAlert[] = [];
    for (const [condition, entries] of conditionToReports.entries()) {
      if (entries.length < 2) continue;
      const latest = entries[entries.length - 1];
      const previous = entries[entries.length - 2];
      const latestLabs = latest.labs || {};
      const previousLabs = previous.labs || {};
      const commonLabKeys = Object.keys(latestLabs).filter((k) => Object.prototype.hasOwnProperty.call(previousLabs, k));

      for (const labKey of commonLabKeys) {
        const latestRaw = latestLabs[labKey];
        const previousRaw = previousLabs[labKey];

        if (normalizeText(labKey) === 'blood pressure') {
          const latestBp = parseBloodPressureParts(latestRaw);
          const previousBp = parseBloodPressureParts(previousRaw);
          if (latestBp && previousBp) {
            const systolicDiff = latestBp.systolic - previousBp.systolic;
            const diastolicDiff = latestBp.diastolic - previousBp.diastolic;
            const direction: TrendDirection =
              systolicDiff > 0 || diastolicDiff > 0 ? 'up' : systolicDiff < 0 || diastolicDiff < 0 ? 'down' : 'same';
            const avgPrev = (previousBp.systolic + previousBp.diastolic) / 2;
            const avgCurr = (latestBp.systolic + latestBp.diastolic) / 2;
            const changePercent = avgPrev > 0 ? Number((((avgCurr - avgPrev) / avgPrev) * 100).toFixed(1)) : null;
            diseaseTrendAlerts.push({
              condition: toTitleCase(condition),
              lab: 'Blood Pressure',
              previousValue: `${previousBp.systolic}/${previousBp.diastolic}`,
              currentValue: `${latestBp.systolic}/${latestBp.diastolic}`,
              direction,
              changePercent,
              level: direction === 'up' ? 'warning' : direction === 'down' ? 'good' : 'neutral'
            });
            continue;
          }
        }

        const prev = parseNumericValue(previousRaw);
        const curr = parseNumericValue(latestRaw);
        if (prev === null || curr === null) continue;

        const direction: TrendDirection = curr > prev ? 'up' : curr < prev ? 'down' : 'same';
        const changePercent = prev !== 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : null;
        diseaseTrendAlerts.push({
          condition: toTitleCase(condition),
          lab: toTitleCase(String(labKey).replace(/_/g, ' ')),
          previousValue: String(previousRaw),
          currentValue: String(latestRaw),
          direction,
          changePercent,
          level: direction === 'up' ? 'warning' : direction === 'down' ? 'good' : 'neutral'
        });
      }
    }

    return {
      duplicateGroups,
      duplicateReportsCount,
      latestIsDuplicate,
      diseaseTrendAlerts
    };
  }, [items]);

  const analyzedCount = items.filter(i => !!i.summary).length;

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
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 32px;
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

        .header-stats {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .header-pill {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 800;
          font-size: 0.8rem;
          color: #334155;
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
          font-size: 0.9rem;
          font-weight: 900;
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

        .comparison-box {
          margin-bottom: 24px;
          background: #f8fafc;
          border: 1px solid #dbe3ef;
          border-radius: 20px;
          padding: 18px 20px;
        }

        .comparison-title {
          margin: 0 0 8px 0;
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.02em;
        }

        .comparison-note {
          margin: 0;
          color: #334155;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .comparison-list {
          margin-top: 12px;
          display: grid;
          gap: 8px;
        }

        .comparison-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 0.84rem;
          color: #334155;
          font-weight: 600;
        }

        .comparison-item.warning {
          border-color: #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .comparison-item.good {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .comparison-item.neutral {
          border-color: #cbd5e1;
          background: #f8fafc;
          color: #334155;
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

        .delete-btn {
          padding: 12px 16px;
          border-radius: 16px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #be123c;
          font-size: 0.86rem;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .delete-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #ffe4e6;
        }

        .delete-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
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

        .summary-title {
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .token-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .token {
          padding: 6px 12px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.78rem;
        }

        .token.condition {
          background: #ecfeff;
          color: #0e7490;
          border: 1px solid #a5f3fc;
        }

        .token.lab {
          background: white;
          color: #0f172a;
          border: 1px solid #e2e8f0;
        }

        .food-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .food-box {
          border-radius: 20px;
          padding: 18px;
        }

        .food-box.consume {
          background: #f0fdf4;
          border: 1px solid #dcfce7;
        }

        .food-box.avoid {
          background: #fef2f2;
          border: 1px solid #fee2e2;
        }

        .food-title {
          font-size: 0.85rem;
          font-weight: 900;
          margin-bottom: 10px;
        }

        .food-box.consume .food-title { color: #16a34a; }
        .food-box.avoid .food-title { color: #dc2626; }

        .food-token.consume {
          background: white;
          color: #065f46;
          border: 1px solid #bbf7d0;
        }

        .food-token.avoid {
          background: white;
          color: #7f1d1d;
          border: 1px solid #fecaca;
        }

        @media (max-width: 760px) {
          .reports-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <header className="reports-header">
        <div>
          <h2>Medical Records</h2>
          <p>Your secure health vault with AI-powered insights.</p>
        </div>
        <div className="header-stats">
          <span className="header-pill">{items.length} Reports</span>
          <span className="header-pill">{analyzedCount} Summaries</span>
        </div>
      </header>

      <div className="upload-zone">
        <label className={`upload-card ${uploading ? 'processing' : ''}`}>
          <div className="upload-icon">{uploading ? 'WAIT' : 'UPLOAD'}</div>
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

      {items.length > 0 && (
        <div className="comparison-box">
          <h3 className="comparison-title">Report Comparison Summary</h3>
          <p className="comparison-note">
            {reportComparison.duplicateGroups.length > 0
              ? `${reportComparison.duplicateReportsCount} report uploads match an earlier report.`
              : 'No duplicate medical report uploads were found.'}
            {reportComparison.latestIsDuplicate ? ' The latest upload appears to be already uploaded before.' : ''}
          </p>
          {reportComparison.duplicateGroups.length > 0 && (
            <div className="comparison-list">
              {reportComparison.duplicateGroups.slice(0, 3).map((group, idx) => (
                <div key={idx} className="comparison-item">
                  Matching group: {group.map((report) => report.filename).join(', ')} ({group.length} uploads)
                </div>
              ))}
            </div>
          )}
          {reportComparison.diseaseTrendAlerts.length > 0 && (
            <div className="comparison-list">
              {reportComparison.diseaseTrendAlerts.slice(0, 8).map((alert, idx) => (
                <div key={`${alert.condition}-${alert.lab}-${idx}`} className={`comparison-item ${alert.level}`}>
                  {alert.level === 'warning' ? 'ALERT:' : alert.level === 'good' ? 'Improved:' : 'Stable:'} {alert.condition} - {alert.lab} {alert.direction === 'up' ? 'went up' : alert.direction === 'down' ? 'fell down' : 'did not change'} ({alert.previousValue} {'->'} {alert.currentValue}{alert.changePercent !== null ? `, ${alert.changePercent > 0 ? '+' : ''}${alert.changePercent}%` : ''})
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="reports-grid">
        {items.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '12px', fontWeight: 900 }}>PDF</span>
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
                <button
                  type="button"
                  onClick={() => removeReport(i)}
                  className="delete-btn"
                  disabled={deletingId === String(i.id)}
                >
                  {deletingId === String(i.id) ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              
              {i.summary && (
                <div className="summary-box">
                  <div className="summary-label">
                    <span className="sparkle">AI</span> Health Summary
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

