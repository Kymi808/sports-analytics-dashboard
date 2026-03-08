import React, { useState } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { createSession } from '../api';

const initialBasketball = {
  points: '', rebounds: '', assists: '', steals: '', blocks: '', turnovers: '',
  fg_made: '', fg_attempted: '', three_pt_made: '', three_pt_attempted: '',
  ft_made: '', ft_attempted: '',
};

const initialVolleyball = {
  kills: '', assists: '', blocks: '', digs: '', aces: '', service_errors: '',
};

export default function LogSession({ sport }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [bbStats, setBbStats] = useState(initialBasketball);
  const [vbStats, setVbStats] = useState(initialVolleyball);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleBbChange = (field) => (e) => {
    setBbStats((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleVbChange = (field) => (e) => {
    setVbStats((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    const stats = sport === 'basketball' ? bbStats : vbStats;
    const numericStats = {};
    Object.entries(stats).forEach(([key, val]) => {
      numericStats[key] = val === '' ? 0 : parseInt(val, 10);
    });

    const payload = {
      sport,
      date,
      duration_minutes: parseInt(duration, 10) || 0,
      notes,
      ...numericStats,
    };

    try {
      await createSession(payload);
      setSuccess(true);
      setDuration('');
      setNotes('');
      setBbStats(initialBasketball);
      setVbStats(initialVolleyball);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Log Session</h2>
        <p>Record your {sport === 'basketball' ? 'basketball' : 'volleyball'} session stats</p>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input
                type="number"
                className="form-input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
                min="1"
                required
              />
            </div>
          </div>

          {sport === 'basketball' ? (
            <>
              <h4 className="form-section-title">Counting Stats</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Points</label>
                  <input type="number" className="form-input" value={bbStats.points} onChange={handleBbChange('points')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rebounds</label>
                  <input type="number" className="form-input" value={bbStats.rebounds} onChange={handleBbChange('rebounds')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Assists</label>
                  <input type="number" className="form-input" value={bbStats.assists} onChange={handleBbChange('assists')} placeholder="0" min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Steals</label>
                  <input type="number" className="form-input" value={bbStats.steals} onChange={handleBbChange('steals')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Blocks</label>
                  <input type="number" className="form-input" value={bbStats.blocks} onChange={handleBbChange('blocks')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Turnovers</label>
                  <input type="number" className="form-input" value={bbStats.turnovers} onChange={handleBbChange('turnovers')} placeholder="0" min="0" />
                </div>
              </div>

              <h4 className="form-section-title">Shooting</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">FG Made</label>
                  <input type="number" className="form-input" value={bbStats.fg_made} onChange={handleBbChange('fg_made')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">FG Attempted</label>
                  <input type="number" className="form-input" value={bbStats.fg_attempted} onChange={handleBbChange('fg_attempted')} placeholder="0" min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">3PT Made</label>
                  <input type="number" className="form-input" value={bbStats.three_pt_made} onChange={handleBbChange('three_pt_made')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">3PT Attempted</label>
                  <input type="number" className="form-input" value={bbStats.three_pt_attempted} onChange={handleBbChange('three_pt_attempted')} placeholder="0" min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">FT Made</label>
                  <input type="number" className="form-input" value={bbStats.ft_made} onChange={handleBbChange('ft_made')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">FT Attempted</label>
                  <input type="number" className="form-input" value={bbStats.ft_attempted} onChange={handleBbChange('ft_attempted')} placeholder="0" min="0" />
                </div>
              </div>
            </>
          ) : (
            <>
              <h4 className="form-section-title">Volleyball Stats</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Kills</label>
                  <input type="number" className="form-input" value={vbStats.kills} onChange={handleVbChange('kills')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Assists</label>
                  <input type="number" className="form-input" value={vbStats.assists} onChange={handleVbChange('assists')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Blocks</label>
                  <input type="number" className="form-input" value={vbStats.blocks} onChange={handleVbChange('blocks')} placeholder="0" min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Digs</label>
                  <input type="number" className="form-input" value={vbStats.digs} onChange={handleVbChange('digs')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Aces</label>
                  <input type="number" className="form-input" value={vbStats.aces} onChange={handleVbChange('aces')} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Errors</label>
                  <input type="number" className="form-input" value={vbStats.service_errors} onChange={handleVbChange('service_errors')} placeholder="0" min="0" />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the session go? Any specific things to remember..."
            />
          </div>

          {error && <p style={{ color: 'var(--accent-red)', marginBottom: 16, fontSize: 14 }}>{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            <Save size={18} />
            {submitting ? 'Saving...' : 'Save Session'}
          </button>
        </form>
      </div>

      {success && (
        <div className="toast success">
          <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Session saved successfully!
        </div>
      )}
    </div>
  );
}
