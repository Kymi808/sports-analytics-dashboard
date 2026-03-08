import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardEdit,
  Film,
  Target,
  Trophy,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LogSession from './pages/LogSession';
import Clips from './pages/Clips';
import TrainingFocus from './pages/TrainingFocus';
import SportToggle from './components/SportToggle';

export default function App() {
  const [sport, setSport] = useState('basketball');

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Trophy size={28} className="logo-icon" />
          <h1 className="logo-text">SportsPulse</h1>
        </div>

        <div className="sidebar-toggle">
          <SportToggle sport={sport} onChange={setSport} />
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/log" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ClipboardEdit size={20} />
            <span>Log Session</span>
          </NavLink>
          <NavLink to="/clips" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Film size={20} />
            <span>Clips</span>
          </NavLink>
          <NavLink to="/training" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Target size={20} />
            <span>Training Focus</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-version">v1.0.0</p>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard sport={sport} />} />
          <Route path="/log" element={<LogSession sport={sport} />} />
          <Route path="/clips" element={<Clips sport={sport} />} />
          <Route path="/training" element={<TrainingFocus sport={sport} />} />
        </Routes>
      </main>
    </div>
  );
}
