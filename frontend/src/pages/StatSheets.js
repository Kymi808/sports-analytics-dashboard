import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Filter, BarChart3 } from 'lucide-react';
import { getStatSheets } from '../api';

export default function StatSheets({ sport }) {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSport, setFilterSport] = useState(sport || 'all');
  const navigate = useNavigate();

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStatSheets(filterSport === 'all' ? undefined : filterSport);
      setSheets(Array.isArray(data) ? data : []);
    } catch {
      setSheets([]);
    } finally {
      setLoading(false);
    }
  }, [filterSport]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  return (
    <div>
      <div className="page-header">
        <h2>Stat Sheets</h2>
        <p>Your finalized game stat sheets</p>
      </div>

      <div className="stat-sheets-filter">
        <Filter size={16} />
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: 160 }}
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
        >
          <option value="all">All Sports</option>
          <option value="basketball">Basketball</option>
          <option value="volleyball">Volleyball</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading stat sheets...</div>
      ) : sheets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart3 size={48} /></div>
          <p>No finalized stat sheets yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Review clips and finalize stats to see them here
          </p>
        </div>
      ) : (
        <div className="stat-sheets-grid">
          {sheets.map((s) => {
            const stats = s.compiled_stats || {};
            return (
              <div
                key={s.id}
                className="stat-sheet-card"
                onClick={() => navigate(`/review/${s.clip_id}`)}
              >
                <div className="stat-sheet-card-header">
                  <FileCheck size={18} className="stat-sheet-icon" />
                  <div>
                    <div className="stat-sheet-card-title">
                      {s.clip_filename || `Clip ${s.clip_id}`}
                    </div>
                    <div className="stat-sheet-card-date">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
                      {s.sport && ` | ${s.sport}`}
                    </div>
                  </div>
                </div>
                <div className="stat-sheet-card-stats">
                  <div className="stat-sheet-stat">
                    <span className="stat-sheet-stat-value">{stats.pts ?? '—'}</span>
                    <span className="stat-sheet-stat-label">PTS</span>
                  </div>
                  <div className="stat-sheet-stat">
                    <span className="stat-sheet-stat-value">{stats.reb ?? '—'}</span>
                    <span className="stat-sheet-stat-label">REB</span>
                  </div>
                  <div className="stat-sheet-stat">
                    <span className="stat-sheet-stat-value">{stats.ast ?? '—'}</span>
                    <span className="stat-sheet-stat-label">AST</span>
                  </div>
                  <div className="stat-sheet-stat">
                    <span className="stat-sheet-stat-value">{stats.stl ?? '—'}</span>
                    <span className="stat-sheet-stat-label">STL</span>
                  </div>
                  <div className="stat-sheet-stat">
                    <span className="stat-sheet-stat-value">{stats.blk ?? '—'}</span>
                    <span className="stat-sheet-stat-label">BLK</span>
                  </div>
                </div>
                <div className="stat-sheet-card-footer">
                  <span className={`stat-sheet-status ${s.status}`}>
                    {s.status === 'finalized' ? 'Finalized' : 'In Review'}
                  </span>
                  <span className="stat-sheet-events">{s.event_count ?? '—'} events</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
