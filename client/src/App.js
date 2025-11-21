import React from 'react';
import MapScreen from './MapScreen';
import AddressComposer from './components/AddressComposer';
import ProfilePanel from './components/ProfilePanel';

export default function App() {
  return (
    <div className="app-shell">
      <header className="header">
        <div className="brand-cluster">
          <div className="logo-chip">SL</div>
          <div>
            <p className="eyebrow">Smart Last-Mile Delivery</p>
            <h1>Smart Address Navigator</h1>
            <p className="muted">
              Capture the exact doorstep route once, reuse it forever across every delivery app.
            </p>
          </div>
        </div>
        <div className="header-actions">
          <span className="badge highlight">India-ready MVP</span>
          <span className="badge neutral">Hybrid Nav</span>
        </div>
      </header>

      <main className="main-layout">
        <section className="map-region">
          <MapScreen />
        </section>
        <aside className="sidebar">
          <AddressComposer />
          <ProfilePanel />
        </aside>
      </main>
    </div>
  );
}
