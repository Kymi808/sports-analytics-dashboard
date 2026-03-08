import React, { useState, useEffect, useCallback } from 'react';
import {
  Target, Zap, ArrowUpRight, ArrowDownRight, Minus, History, RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Tooltip,
} from 'recharts';
import { generateTrainingFocus, getCurrentTraining, getTrainingHistory, getSessions } from '../api';

const darkTooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f1f5f9',
};

function TrendArrow({ trend }) {
  if (trend === 'improving') return <span className="trend-indicator improving"><ArrowUpRight size={14} /> Improving</span>;
  if (trend === 'declining') return <span className="trend-indicator declining"><ArrowDownRight size={14} /> Declining</span>;
  return <span className="trend-indicator stable"><Minus size={14} /> Stable</span>;
}

export default function TrainingFocus({ sport }) {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [radarData, setRadarData] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, hist, sessions] = await Promise.all([
        getCurrentTraining(sport).catch(() => null),
        getTrainingHistory(sport).catch(() => []),
        getSessions(sport).catch(() => []),
      ]);
      setCurrent(cur);
      setHistory(Array.isArray(hist) ? hist : []);

      // Build radar data from recent sessions
      const recent = (Array.isArray(sessions) ? sessions : [])
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

      if (recent.length > 0) {
        if (sport === 'basketball') {
          const avg = (field) => Math.round(recent.reduce((s, r) => s + (r[field] || 0), 0) / recent.length);
          const fgPct = () => {
            const made = recent.reduce((s, r) => s + (r.fg_made || 0), 0);
            const att = recent.reduce((s, r) => s + (r.fg_attempted || 0), 0);
            return att > 0 ? Math.round((made / att) * 100) : 0;
          };
          setRadarData([
            { stat: 'Scoring', value: Math.min(avg('points'), 100) },
            { stat: 'Rebounding', value: Math.min(avg('rebounds') * 5, 100) },
            { stat: 'Passing', value: Math.min(avg('assists') * 8, 100) },
            { stat: 'Defense', value: Math.min((avg('steals') + avg('blocks')) * 10, 100) },
            { stat: 'Shooting', value: fgPct() },
            { stat: 'Ball Care', value: Math.max(100 - avg('turnovers') * 15, 0) },
          ]);
        } else {
          const avg = (field) => Math.round(recent.reduce((s, r) => s + (r[field] || 0), 0) / recent.length);
          setRadarData([
            { stat: 'Attacking', value: Math.min(avg('kills') * 5, 100) },
            { stat: 'Setting', value: Math.min(avg('assists') * 5, 100) },
            { stat: 'Blocking', value: Math.min(avg('blocks') * 10, 100) },
            { stat: 'Defense', value: Math.min(avg('digs') * 5, 100) },
            { stat: 'Serving', value: Math.min(avg('aces') * 15, 100) },
            { stat: 'Consistency', value: Math.max(100 - avg('service_errors') * 15, 0) },
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to load training data:', err);
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateTrainingFocus(sport);
      setCurrent(result);
      await fetchData();
    } catch (err) {
      console.error('Failed to generate focus:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading training data...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Training Focus</h2>
        <p>AI-powered training recommendations based on your {sport} performance</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-primary btn-lg" onClick={handleGenerate} disabled={generating}>
          <Zap size={18} />
          {generating ? 'Generating...' : "Generate This Week's Focus"}
        </button>
      </div>

      <div className="charts-grid">
        {/* Current Focus */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Target size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Current Focus
            </h3>
          </div>
          {current && current.focus_areas ? (
            <div className="focus-list">
              {(Array.isArray(current.focus_areas) ? current.focus_areas : []).map((area, i) => (
                <div className="focus-item" key={i}>
                  <div className="focus-item-title">
                    {area.area || area.name || area}
                    {area.trend && (
                      <span style={{ marginLeft: 12 }}>
                        <TrendArrow trend={area.trend} />
                      </span>
                    )}
                  </div>
                  {area.reasoning && (
                    <div className="focus-item-reasoning">{area.reasoning}</div>
                  )}
                  {area.drills && (
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <strong>Drills:</strong> {Array.isArray(area.drills) ? area.drills.join(', ') : area.drills}
                    </div>
                  )}
                </div>
              ))}
              {current.generated_at && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  Generated: {new Date(current.generated_at).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>No training focus generated yet.</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Click the button above to get AI recommendations.</p>
            </div>
          )}
        </div>

        {/* Radar Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Performance Profile</h3>
          </div>
          {radarData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="stat" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip contentStyle={darkTooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Log some sessions to see your performance profile.</div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3 className="card-title">
            <History size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Focus History
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <RefreshCw size={14} />
          </button>
        </div>
        {history.length === 0 ? (
          <div className="empty-state">No previous training focuses.</div>
        ) : (
          <div>
            {history.map((item, i) => (
              <div className="history-item" key={i}>
                <div className="history-date">
                  {item.generated_at
                    ? new Date(item.generated_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : `Week ${history.length - i}`}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(Array.isArray(item.focus_areas) ? item.focus_areas : []).map((area, j) => (
                    <span key={j} style={{ fontSize: 13 }}>
                      <strong>{area.area || area.name || area}</strong>
                      {area.trend && (
                        <span style={{ marginLeft: 6 }}>
                          <TrendArrow trend={area.trend} />
                        </span>
                      )}
                      {j < (item.focus_areas?.length || 0) - 1 && (
                        <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>|</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
