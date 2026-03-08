import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, X, Plus, BarChart3, Clock, Eye,
  Trash2, FileCheck, Pencil, AlertCircle,
} from 'lucide-react';
import {
  startSupervisedReview, getStatSheet, reviewEvent, addManualEvent,
  deleteEvent, compileStatSheet, getLatestSheet, getClip,
} from '../api';

const EVENT_LABELS = [
  'fg_made', 'fg_missed', 'three_made', 'three_missed',
  'ft_made', 'ft_missed', 'rebound', 'assist', 'steal',
  'block', 'turnover',
];

const LABEL_DISPLAY = {
  fg_made: 'FG Made', fg_missed: 'FG Missed',
  three_made: '3PT Made', three_missed: '3PT Missed',
  ft_made: 'FT Made', ft_missed: 'FT Missed',
  rebound: 'Rebound', assist: 'Assist', steal: 'Steal',
  block: 'Block', turnover: 'Turnover',
};

function formatTime(seconds) {
  if (seconds == null) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function statusColor(status) {
  switch (status) {
    case 'confirmed': return 'var(--accent-green)';
    case 'rejected': return 'var(--accent-red)';
    case 'manual': return 'var(--accent-blue)';
    default: return 'var(--accent-orange)';
  }
}

function statusDotClass(status) {
  switch (status) {
    case 'confirmed': return 'review-dot confirmed';
    case 'rejected': return 'review-dot rejected';
    case 'manual': return 'review-dot manual';
    default: return 'review-dot unreviewed';
  }
}

export default function SupervisedReview() {
  const { clipId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [clip, setClip] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Manual add form
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualLabel, setManualLabel] = useState('fg_made');
  const [manualNotes, setManualNotes] = useState('');

  // Inline edit state
  const [editingEventId, setEditingEventId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadSheet = useCallback(async (sheetId) => {
    const data = await getStatSheet(sheetId);
    setSheet(data);
    setEvents((data.events || []).sort((a, b) => a.timestamp - b.timestamp));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const clipData = await getClip(clipId);
        if (cancelled) return;
        setClip(clipData);

        // Try to get latest sheet, otherwise start a new review
        let sheetData;
        try {
          sheetData = await getLatestSheet(clipId);
        } catch {
          sheetData = await startSupervisedReview(clipId);
        }
        if (cancelled) return;
        setSheet(sheetData);
        setEvents((sheetData.events || []).sort((a, b) => a.timestamp - b.timestamp));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load review');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [clipId]);

  // Video time tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => setDuration(video.duration || 0);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
    };
  }, [clip]);

  const seekTo = (timestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play();
    }
  };

  const handleConfirm = async (event) => {
    setEditingEventId(event.id);
    setEditLabel(event.label || 'fg_made');
    setEditNotes(event.notes || '');
  };

  const submitConfirm = async (eventId) => {
    try {
      await reviewEvent(eventId, { status: 'confirmed', label: editLabel, notes: editNotes });
      setEditingEventId(null);
      await loadSheet(sheet.id);
    } catch (err) {
      console.error('Review failed:', err);
    }
  };

  const handleReject = async (eventId) => {
    try {
      await reviewEvent(eventId, { status: 'rejected' });
      await loadSheet(sheet.id);
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await deleteEvent(eventId);
      await loadSheet(sheet.id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!sheet) return;
    try {
      await addManualEvent(sheet.id, {
        timestamp: currentTime,
        label: manualLabel,
        notes: manualNotes,
        source: 'manual',
      });
      setShowManualAdd(false);
      setManualNotes('');
      await loadSheet(sheet.id);
    } catch (err) {
      console.error('Add event failed:', err);
    }
  };

  const handleCompile = async () => {
    if (!sheet) return;
    try {
      await compileStatSheet(sheet.id);
      await loadSheet(sheet.id);
    } catch (err) {
      console.error('Compile failed:', err);
    }
  };

  const handleReopen = async () => {
    if (!sheet) return;
    try {
      // Re-open by starting a fresh review on the same sheet
      await reviewEvent(sheet.id, { status: 'in_review' });
      await loadSheet(sheet.id);
    } catch {
      // Fallback: just reload
      await loadSheet(sheet.id);
    }
  };

  // Compute live tally from confirmed events
  const tally = events.reduce((acc, ev) => {
    if (ev.status !== 'confirmed' || !ev.label) return acc;
    const l = ev.label;
    if (l === 'fg_made') { acc.fgMade++; acc.pts += 2; }
    if (l === 'fg_missed') acc.fgMissed++;
    if (l === 'three_made') { acc.threeMade++; acc.pts += 3; }
    if (l === 'three_missed') acc.threeMissed++;
    if (l === 'ft_made') { acc.ftMade++; acc.pts += 1; }
    if (l === 'ft_missed') acc.ftMissed++;
    if (l === 'rebound') acc.reb++;
    if (l === 'assist') acc.ast++;
    if (l === 'steal') acc.stl++;
    if (l === 'block') acc.blk++;
    if (l === 'turnover') acc.to++;
    return acc;
  }, { pts: 0, fgMade: 0, fgMissed: 0, threeMade: 0, threeMissed: 0, ftMade: 0, ftMissed: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0 });

  const fgAtt = tally.fgMade + tally.fgMissed;
  const threeAtt = tally.threeMade + tally.threeMissed;
  const ftAtt = tally.ftMade + tally.ftMissed;
  const fgPct = fgAtt ? ((tally.fgMade / fgAtt) * 100).toFixed(1) : '0.0';
  const threePct = threeAtt ? ((tally.threeMade / threeAtt) * 100).toFixed(1) : '0.0';
  const ftPct = ftAtt ? ((tally.ftMade / ftAtt) * 100).toFixed(1) : '0.0';

  const reviewedCount = events.filter((e) => e.status === 'confirmed' || e.status === 'rejected').length;
  const totalCount = events.length;
  const progressPct = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;

  const isFinalized = sheet?.status === 'finalized';

  if (loading) return <div className="loading">Loading review...</div>;
  if (error) return (
    <div className="empty-state">
      <AlertCircle size={48} style={{ marginBottom: 12 }} />
      <p>{error}</p>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/clips')}>
        <ArrowLeft size={16} /> Back to Clips
      </button>
    </div>
  );

  const videoUrl = clip?.file_url
    ? (clip.file_url.startsWith('http') ? clip.file_url : `http://localhost:8000${clip.file_url}`)
    : '';

  const videoDuration = duration || clip?.duration || 60;

  // Finalized view
  if (isFinalized) {
    const compiled = sheet.compiled_stats || tally;
    return (
      <div className="review-page">
        <div className="review-top-bar">
          <button className="btn btn-secondary" onClick={() => navigate('/clips')}>
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="review-title">
            <FileCheck size={22} /> Stat Sheet — Finalized
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={handleReopen}>
            <Pencil size={14} /> Re-open for Editing
          </button>
        </div>

        <div className="box-score-card">
          <h3 className="box-score-title">{clip?.filename || 'Clip'}</h3>
          <p className="box-score-subtitle">
            {clip?.created_at ? new Date(clip.created_at).toLocaleDateString() : ''}
          </p>
          <table className="box-score-table">
            <thead>
              <tr>
                <th>PTS</th><th>FG</th><th>FG%</th><th>3PT</th><th>3P%</th>
                <th>FT</th><th>FT%</th><th>REB</th><th>AST</th><th>STL</th>
                <th>BLK</th><th>TO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="box-score-pts">{compiled.pts ?? tally.pts}</td>
                <td>{compiled.fgMade ?? tally.fgMade}/{compiled.fgAtt ?? fgAtt}</td>
                <td>{compiled.fgPct ?? fgPct}%</td>
                <td>{compiled.threeMade ?? tally.threeMade}/{compiled.threeAtt ?? threeAtt}</td>
                <td>{compiled.threePct ?? threePct}%</td>
                <td>{compiled.ftMade ?? tally.ftMade}/{compiled.ftAtt ?? ftAtt}</td>
                <td>{compiled.ftPct ?? ftPct}%</td>
                <td>{compiled.reb ?? tally.reb}</td>
                <td>{compiled.ast ?? tally.ast}</td>
                <td>{compiled.stl ?? tally.stl}</td>
                <td>{compiled.blk ?? tally.blk}</td>
                <td>{compiled.to ?? tally.to}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="review-events-summary">
          <h4 style={{ marginBottom: 12 }}>Events ({events.length})</h4>
          {events.filter(e => e.status === 'confirmed').map((ev) => (
            <div key={ev.id} className="review-event-row finalized">
              <span className="review-event-time">{formatTime(ev.timestamp)}</span>
              <span className="review-event-label-badge">{LABEL_DISPLAY[ev.label] || ev.label}</span>
              {ev.notes && <span className="review-event-notes">{ev.notes}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Review mode
  return (
    <div className="review-page">
      <div className="review-top-bar">
        <button className="btn btn-secondary" onClick={() => navigate('/clips')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="review-title">
          <Eye size={22} /> Supervised Review
        </h2>
        <div className="review-progress-section">
          <span className="review-progress-text">{reviewedCount}/{totalCount} events reviewed</span>
          <div className="review-progress-bar">
            <div className="review-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="review-layout">
        {/* Left side: video + timeline */}
        <div className="review-left">
          <div className="video-container">
            <video ref={videoRef} src={videoUrl} controls preload="metadata" />
          </div>

          {/* Event Timeline */}
          <div className="review-timeline">
            <div className="review-timeline-track">
              {/* Current time indicator */}
              {videoDuration > 0 && (
                <div
                  className="review-timeline-cursor"
                  style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                />
              )}
              {events.map((ev) => {
                const left = videoDuration > 0 ? `${(ev.timestamp / videoDuration) * 100}%` : '0%';
                return (
                  <div
                    key={ev.id}
                    className={statusDotClass(ev.status)}
                    style={{ left }}
                    title={`${ev.status} — ${formatTime(ev.timestamp)}${ev.label ? ` (${LABEL_DISPLAY[ev.label] || ev.label})` : ''}`}
                    onClick={() => seekTo(ev.timestamp)}
                  />
                );
              })}
            </div>
            <div className="review-timeline-labels">
              <span>0:00</span>
              <span>{formatTime(videoDuration)}</span>
            </div>
          </div>

          {/* Manual Add */}
          <div className="review-manual-add">
            {!showManualAdd ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowManualAdd(true)}>
                <Plus size={14} /> Add Event at Current Time ({formatTime(currentTime)})
              </button>
            ) : (
              <form className="review-manual-form" onSubmit={handleManualAdd}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Label</label>
                  <select className="form-select" value={manualLabel} onChange={(e) => setManualLabel(e.target.value)}>
                    {EVENT_LABELS.map((l) => (
                      <option key={l} value={l}>{LABEL_DISPLAY[l]}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} placeholder="Optional" />
                </div>
                <div className="review-manual-actions">
                  <span className="review-manual-time">
                    <Clock size={14} /> {formatTime(currentTime)}
                  </span>
                  <button type="submit" className="btn btn-primary btn-sm">Add</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowManualAdd(false)}>
                    <X size={14} />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Live Stat Tally */}
          <div className="stat-tally-panel">
            <h4 className="stat-tally-title">
              <BarChart3 size={16} /> Live Stats
            </h4>
            <div className="stat-tally-grid">
              <div className="stat-tally-item highlight">
                <span className="stat-tally-value">{tally.pts}</span>
                <span className="stat-tally-label">PTS</span>
              </div>
              <div className="stat-tally-item">
                <span className="stat-tally-value">{tally.fgMade}/{fgAtt}</span>
                <span className="stat-tally-label">FG ({fgPct}%)</span>
              </div>
              <div className="stat-tally-item">
                <span className="stat-tally-value">{tally.threeMade}/{threeAtt}</span>
                <span className="stat-tally-label">3PT ({threePct}%)</span>
              </div>
              <div className="stat-tally-item">
                <span className="stat-tally-value">{tally.ftMade}/{ftAtt}</span>
                <span className="stat-tally-label">FT ({ftPct}%)</span>
              </div>
              <div className="stat-tally-item">
                <span className="stat-tally-value">{tally.reb}</span>
                <span className="stat-tally-label">REB</span>
              </div>
              <div className="stat-tally-item">
                <span className="stat-tally-value">{tally.ast}</span>
                <span className="stat-tally-label">AST</span>
              </div>
              <div className="stat-tally-item">
                <span className="stat-tally-value">{tally.stl}</span>
                <span className="stat-tally-label">STL</span>
              </div>
              <div className="stat-tally-item">
                <span className="stat-tally-value">{tally.blk}</span>
                <span className="stat-tally-label">BLK</span>
              </div>
              <div className="stat-tally-item">
                <span className="stat-tally-value">{tally.to}</span>
                <span className="stat-tally-label">TO</span>
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 16 }}
              onClick={handleCompile}
              disabled={reviewedCount === 0}
            >
              <FileCheck size={16} /> Finalize Stats
            </button>
          </div>
        </div>

        {/* Right side: event list */}
        <div className="review-right">
          <h4 className="review-panel-title">Events ({events.length})</h4>
          <div className="review-event-list">
            {events.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>No events detected. Add events manually.</p>
              </div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className={`review-event-card ${ev.status}`}
                  onClick={() => seekTo(ev.timestamp)}
                >
                  <div className="review-event-header">
                    <span className="review-event-time">{formatTime(ev.timestamp)}</span>
                    <div className="review-event-badges">
                      {ev.confidence != null && (
                        <span className="confidence-badge">
                          {Math.round(ev.confidence * 100)}%
                        </span>
                      )}
                      <span className={`source-badge ${ev.source === 'manual' ? 'manual' : 'auto'}`}>
                        {ev.source === 'manual' ? 'Manual' : 'Auto'}
                      </span>
                    </div>
                  </div>

                  <div className="review-event-body">
                    {ev.label && (
                      <span className="review-event-label-badge">
                        {LABEL_DISPLAY[ev.label] || ev.label}
                      </span>
                    )}
                    {ev.type && !ev.label && (
                      <span className="review-event-type">{ev.type}</span>
                    )}
                    {ev.notes && <span className="review-event-notes">{ev.notes}</span>}
                  </div>

                  {/* Confirm/Reject inline editing */}
                  {editingEventId === ev.id ? (
                    <div className="review-event-edit" onClick={(e) => e.stopPropagation()}>
                      <select className="form-select" value={editLabel} onChange={(e) => setEditLabel(e.target.value)}>
                        {EVENT_LABELS.map((l) => (
                          <option key={l} value={l}>{LABEL_DISPLAY[l]}</option>
                        ))}
                      </select>
                      <input
                        className="form-input"
                        placeholder="Notes (optional)"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                      />
                      <div className="review-event-edit-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => submitConfirm(ev.id)}>
                          <Check size={14} /> Save
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingEventId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    ev.status !== 'confirmed' && ev.status !== 'rejected' && (
                      <div className="review-event-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm review-btn-confirm" onClick={() => handleConfirm(ev)}>
                          <Check size={14} /> Confirm
                        </button>
                        <button className="btn btn-sm review-btn-reject" onClick={() => handleReject(ev.id)}>
                          <X size={14} /> Reject
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(ev.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  )}

                  {ev.status === 'confirmed' && editingEventId !== ev.id && (
                    <div className="review-event-status-bar confirmed">
                      <Check size={14} /> Confirmed
                    </div>
                  )}
                  {ev.status === 'rejected' && (
                    <div className="review-event-status-bar rejected">
                      <X size={14} /> Rejected
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
