import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Play, ArrowLeft, Trash2, Sparkles, X, Film,
} from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';
import {
  uploadClip, getClips, getClip, addPlayTag, deletePlayTag, deleteClip,
  analyzeBasketballClip, getAnalysis,
} from '../api';

const TAG_TYPES = [
  'Shot', 'Pass', 'Rebound', 'Block', 'Turnover', 'Fast Break',
  'Serve', 'Spike', 'Dig', 'Set', 'Custom',
];

function tagTypeClass(type) {
  const map = {
    Shot: 'shot', Pass: 'pass', Rebound: 'rebound', Block: 'block',
    Turnover: 'turnover', 'Fast Break': 'fast-break',
    Serve: 'serve', Spike: 'spike', Dig: 'dig', Set: 'set',
  };
  return map[type] || 'custom';
}

export default function Clips({ sport }) {
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [tags, setTags] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tagForm, setTagForm] = useState({ tag_type: 'Shot', description: '', timestamp: 0 });
  const [showTagForm, setShowTagForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const fetchClips = useCallback(async () => {
    try {
      const data = await getClips();
      setClips(Array.isArray(data) ? data : []);
    } catch {
      setClips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sport', sport);
      await uploadClip(formData);
      await fetchClips();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openClip = async (clip) => {
    try {
      const data = await getClip(clip.id);
      setSelectedClip(data);
      setTags(data.tags || []);
      setAnalysis(null);
      // Try to fetch existing analysis
      try {
        const a = await getAnalysis(clip.id);
        if (a) setAnalysis(a);
      } catch {}
    } catch (err) {
      console.error('Failed to load clip:', err);
    }
  };

  const handleDeleteClip = async (id) => {
    if (!window.confirm('Delete this clip?')) return;
    try {
      await deleteClip(id);
      setSelectedClip(null);
      await fetchClips();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleTimelineClick = (timestamp) => {
    setTagForm((prev) => ({ ...prev, timestamp }));
    setShowTagForm(true);
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!selectedClip) return;
    try {
      const newTag = await addPlayTag(selectedClip.id, tagForm);
      setTags((prev) => [...prev, newTag].sort((a, b) => a.timestamp - b.timestamp));
      setShowTagForm(false);
      setTagForm({ tag_type: 'Shot', description: '', timestamp: 0 });
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!selectedClip) return;
    try {
      await deletePlayTag(selectedClip.id, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedClip) return;
    setAnalyzing(true);
    try {
      await analyzeBasketballClip(selectedClip.id);
      const a = await getAnalysis(selectedClip.id);
      setAnalysis(a);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Detail view
  if (selectedClip) {
    const videoUrl = selectedClip.file_url
      ? (selectedClip.file_url.startsWith('http') ? selectedClip.file_url : `http://localhost:8000${selectedClip.file_url}`)
      : '';

    return (
      <div className="clip-detail">
        <div className="clip-detail-header">
          <button className="btn btn-secondary" onClick={() => setSelectedClip(null)}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {sport === 'basketball' && (
              <button className="btn btn-orange" onClick={handleAnalyze} disabled={analyzing}>
                <Sparkles size={16} />
                {analyzing ? 'Analyzing...' : 'Analyze Clip'}
              </button>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClip(selectedClip.id)}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        <h3 style={{ marginBottom: 16 }}>{selectedClip.filename || 'Clip'}</h3>

        <VideoPlayer
          src={videoUrl}
          tags={tags}
          duration={selectedClip.duration || 60}
          onTimelineClick={handleTimelineClick}
        />

        {/* Tag form */}
        {showTagForm && (
          <form className="tag-form" onSubmit={handleAddTag}>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={tagForm.tag_type}
                onChange={(e) => setTagForm((p) => ({ ...p, tag_type: e.target.value }))}
              >
                {TAG_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                className="form-input"
                value={tagForm.description}
                onChange={(e) => setTagForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label className="form-label">Time (s)</label>
              <input
                type="number"
                className="form-input"
                value={tagForm.timestamp}
                onChange={(e) => setTagForm((p) => ({ ...p, timestamp: parseFloat(e.target.value) || 0 }))}
                step="0.1"
                min="0"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Add Tag</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTagForm(false)}>
              <X size={14} />
            </button>
          </form>
        )}

        {!showTagForm && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => setShowTagForm(true)}
          >
            + Add Tag
          </button>
        )}

        {/* Tags list */}
        <div className="tags-section">
          <h4 className="card-title" style={{ marginBottom: 8 }}>Play Tags</h4>
          {tags.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              No tags yet. Click on the timeline or use the button above to add tags.
            </p>
          ) : (
            <div className="tags-list">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className={`tag-badge ${tagTypeClass(tag.tag_type)}`}
                  onClick={() => handleDeleteTag(tag.id)}
                  title="Click to delete"
                >
                  <span className="tag-timestamp">{tag.timestamp.toFixed(1)}s</span>
                  {tag.tag_type}
                  {tag.description && ` - ${tag.description}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Analysis results */}
        {analysis && (
          <div className="analysis-results">
            <h4 className="card-title" style={{ marginBottom: 12 }}>
              <Sparkles size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Analysis Results
            </h4>
            <div className="analysis-item">
              <span className="analysis-label">Shots Detected</span>
              <span className="analysis-value">{analysis.shot_count ?? 'N/A'}</span>
            </div>
            <div className="analysis-item">
              <span className="analysis-label">Movement Summary</span>
              <span className="analysis-value">{analysis.movement_summary ?? 'N/A'}</span>
            </div>
            <div className="analysis-item">
              <span className="analysis-label">Pose Quality</span>
              <span className="analysis-value">{analysis.pose_quality ?? 'N/A'}</span>
            </div>
            {analysis.details && (
              <div className="analysis-item">
                <span className="analysis-label">Details</span>
                <span className="analysis-value">{analysis.details}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div>
      <div className="page-header">
        <h2>Clips</h2>
        <p>Upload and analyze your game footage</p>
      </div>

      <div
        className="upload-area"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-area-icon">
          <Upload size={40} />
        </div>
        <div className="upload-area-text">
          {uploading ? 'Uploading...' : 'Click to upload a video clip'}
        </div>
        <div className="upload-area-hint">MP4, MOV, AVI supported</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      {loading ? (
        <div className="loading">Loading clips...</div>
      ) : clips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Film size={48} /></div>
          <p>No clips uploaded yet</p>
        </div>
      ) : (
        <div className="clips-grid">
          {clips.map((clip) => {
            const thumbUrl = clip.file_url
              ? (clip.file_url.startsWith('http') ? clip.file_url : `http://localhost:8000${clip.file_url}`)
              : '';
            return (
              <div key={clip.id} className="clip-card" onClick={() => openClip(clip)}>
                <div className="clip-thumbnail">
                  {thumbUrl ? (
                    <video src={thumbUrl} preload="metadata" muted />
                  ) : (
                    <Film size={32} style={{ color: '#64748b' }} />
                  )}
                  <div className="clip-play-overlay">
                    <Play size={40} style={{ color: 'white' }} />
                  </div>
                </div>
                <div className="clip-info">
                  <div className="clip-name">{clip.filename || `Clip ${clip.id}`}</div>
                  <div className="clip-meta">
                    {clip.created_at
                      ? new Date(clip.created_at).toLocaleDateString()
                      : ''}
                    {clip.duration ? ` | ${Math.round(clip.duration)}s` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
