import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ icon: Icon, label, value, trend, trendValue, color = 'blue' }) {
  return (
    <div className="stat-card">
      <div className={`stat-card-icon ${color}`}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="stat-card-info">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">{value}</div>
        {trend && (
          <div className={`stat-card-trend ${trend}`}>
            {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  );
}
