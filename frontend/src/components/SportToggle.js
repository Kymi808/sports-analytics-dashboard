import React from 'react';

export default function SportToggle({ sport, onChange }) {
  return (
    <div className="sport-toggle">
      <button
        className={`sport-toggle-btn ${sport === 'basketball' ? 'active' : ''}`}
        onClick={() => onChange('basketball')}
      >
        Basketball
      </button>
      <button
        className={`sport-toggle-btn ${sport === 'volleyball' ? 'active' : ''}`}
        onClick={() => onChange('volleyball')}
      >
        Volleyball
      </button>
    </div>
  );
}
