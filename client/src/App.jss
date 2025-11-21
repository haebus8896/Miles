cat > src/App.js << 'EOF'
import React from 'react';
import MapScreen from './MapScreen';

export default function App(){
  return (
    <div className="app-shell">
      <div className="header">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <img src="" alt="" style={{width:36,height:36, borderRadius:8, background:'#e8f0ff'}} />
          <div className="brand">SLMD - Last Mile</div>
        </div>
      </div>
      <div className="container">
        <div className="map-pane">
          <MapScreen />
        </div>
        <div className="side-panel">
          <h3>Saved / Nearby Addresses</h3>
          <div id="nearby-list" />
          <div className="hr" />
          <h3>Instructions</h3>
          <p style={{color:'#3b557a'}}>Use <strong>Find my location</strong>. The system will highlight the nearest labelled road within ~100m in blue. Click that road to set start point, then use <strong>Draw Route</strong> and tap on the map to draw the polyline to your door. You can smooth & snap before saving.</p>
        </div>
      </div>
    </div>
  );
}
EOF

