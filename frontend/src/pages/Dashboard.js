import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Activity, Target, TrendingUp } from 'lucide-react';
import StatCard from '../components/StatCard';
import TrendChart from '../components/TrendChart';
import { getSessions, getSessionTrends } from '../api';

export default function Dashboard({ sport }) {
  const [sessions, setSessions] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSessions(sport).catch(() => []),
      getSessionTrends(sport).catch(() => []),
    ]).then(([sess, trnd]) => {
      setSessions(Array.isArray(sess) ? sess : []);
      setTrends(Array.isArray(trnd) ? trnd : []);
      setLoading(false);
    });
  }, [sport]);

  const totalSessions = sessions.length;
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeek = sessions.filter((s) => new Date(s.date) >= weekAgo).length;
  const avgDuration =
    totalSessions > 0
      ? Math.round(sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / totalSessions)
      : 0;

  const trendChartKeys =
    sport === 'basketball'
      ? ['fg_pct', 'three_pt_pct', 'ft_pct']
      : ['kill_pct', 'dig_pct'];

  const volumeKeys =
    sport === 'basketball' ? ['points', 'rebounds', 'assists'] : ['kills', 'assists', 'digs'];

  // Compute trend data from sessions
  const chartData = sessions
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-20)
    .map((s) => {
      const row = { date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
      if (sport === 'basketball') {
        const fga = s.fg_attempted || 0;
        const tpa = s.three_pt_attempted || 0;
        const fta = s.ft_attempted || 0;
        row.fg_pct = fga > 0 ? Math.round((s.fg_made / fga) * 100) : 0;
        row.three_pt_pct = tpa > 0 ? Math.round((s.three_pt_made / tpa) * 100) : 0;
        row.ft_pct = fta > 0 ? Math.round((s.ft_made / fta) * 100) : 0;
        row.points = s.points || 0;
        row.rebounds = s.rebounds || 0;
        row.assists = s.assists || 0;
      } else {
        const attempts = (s.kills || 0) + (s.errors || 0) + (s.blocks || 0);
        row.kill_pct = attempts > 0 ? Math.round((s.kills / attempts) * 100) : 0;
        row.dig_pct = s.digs || 0;
        row.kills = s.kills || 0;
        row.assists = s.assists || 0;
        row.digs = s.digs || 0;
      }
      return row;
    });

  // Use trend data from API if available, else use computed
  const displayTrends = trends.length > 0 ? trends : chartData;

  const recentSessions = sessions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>{sport === 'basketball' ? 'Basketball' : 'Volleyball'} Performance Overview</p>
      </div>

      <div className="stats-grid">
        <StatCard icon={Activity} label="Total Sessions" value={totalSessions} color="blue" />
        <StatCard icon={Calendar} label="This Week" value={thisWeek} color="green" />
        <StatCard icon={Clock} label="Avg Duration" value={`${avgDuration}m`} color="orange" />
        <StatCard
          icon={Target}
          label={sport === 'basketball' ? 'Avg Points' : 'Avg Kills'}
          value={
            totalSessions > 0
              ? Math.round(
                  sessions.reduce(
                    (sum, s) => sum + (sport === 'basketball' ? s.points || 0 : s.kills || 0),
                    0
                  ) / totalSessions
                )
              : 0
          }
          color="purple"
        />
      </div>

      <div className="charts-grid">
        <TrendChart
          data={displayTrends}
          type="line"
          dataKeys={trendChartKeys}
          title={sport === 'basketball' ? 'Shooting Percentages' : 'Performance Rates'}
        />
        <TrendChart
          data={displayTrends}
          type="area"
          dataKeys={volumeKeys}
          title={sport === 'basketball' ? 'Points / Rebounds / Assists' : 'Kills / Assists / Digs'}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Sessions</h3>
          <TrendingUp size={18} style={{ color: '#64748b' }} />
        </div>
        {recentSessions.length === 0 ? (
          <div className="empty-state">No sessions logged yet. Start by logging a session!</div>
        ) : (
          <div className="sessions-list">
            {recentSessions.map((s) => (
              <div className="session-row" key={s.id}>
                <span className="session-date">
                  {new Date(s.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <div className="session-stats">
                  {sport === 'basketball' ? (
                    <>
                      <span className="session-stat">
                        <span className="session-stat-label">PTS</span>
                        <span className="session-stat-value">{s.points || 0}</span>
                      </span>
                      <span className="session-stat">
                        <span className="session-stat-label">REB</span>
                        <span className="session-stat-value">{s.rebounds || 0}</span>
                      </span>
                      <span className="session-stat">
                        <span className="session-stat-label">AST</span>
                        <span className="session-stat-value">{s.assists || 0}</span>
                      </span>
                      <span className="session-stat">
                        <span className="session-stat-label">FG</span>
                        <span className="session-stat-value">
                          {s.fg_made || 0}/{s.fg_attempted || 0}
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="session-stat">
                        <span className="session-stat-label">K</span>
                        <span className="session-stat-value">{s.kills || 0}</span>
                      </span>
                      <span className="session-stat">
                        <span className="session-stat-label">AST</span>
                        <span className="session-stat-value">{s.assists || 0}</span>
                      </span>
                      <span className="session-stat">
                        <span className="session-stat-label">DIG</span>
                        <span className="session-stat-value">{s.digs || 0}</span>
                      </span>
                      <span className="session-stat">
                        <span className="session-stat-label">ACE</span>
                        <span className="session-stat-value">{s.aces || 0}</span>
                      </span>
                    </>
                  )}
                  <span className="session-stat">
                    <span className="session-stat-label">DUR</span>
                    <span className="session-stat-value">{s.duration_minutes || 0}m</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
