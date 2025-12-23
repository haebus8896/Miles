import React, { useEffect, useState } from 'react';
import { useStore } from '../useStore';
import { createDeliverySession, completeDeliverySession, fetchDeliverySummary } from '../api';

export default function DeliveryPanel() {
  const { savedAddress, deliverySessionId, setDeliverySessionId, deliverySummary, setDeliverySummary } = useStore(
    (state) => ({
      savedAddress: state.savedAddress,
      deliverySessionId: state.deliverySessionId,
      setDeliverySessionId: state.setDeliverySessionId,
      deliverySummary: state.deliverySummary,
      setDeliverySummary: state.setDeliverySummary
    })
  );

  const [form, setForm] = useState({ address_code: '', delivery_partner_id: '', mode: 'SMART_NAV' });
  const [metrics, setMetrics] = useState({
    duration_seconds: 0,
    customer_calls: 0,
    wrong_lane_attempts: 0,
    distance_meters: 0
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (savedAddress?.code) {
      setForm((prev) => ({ ...prev, address_code: savedAddress.code }));
    }
  }, [savedAddress]);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const summary = await fetchDeliverySummary(7);
      setDeliverySummary(summary);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMetricChange = (e) => {
    const { name, value } = e.target;
    setMetrics((prev) => ({ ...prev, [name]: Number(value) }));
  };

  const startSession = async () => {
    setError('');
    setStatus('');
    try {
      const { sessionId } = await createDeliverySession(form);
      setDeliverySessionId(sessionId);
      setStatus(`Session started with ID ${sessionId}. Track the delivery now.`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to start session');
    }
  };

  const completeSession = async () => {
    if (!deliverySessionId) {
      setError('No active delivery session.');
      return;
    }
    setError('');
    try {
      await completeDeliverySession(deliverySessionId, { metrics });
      setStatus('Session completed. Metrics captured.');
      setDeliverySessionId(null);
      setMetrics({ duration_seconds: 0, customer_calls: 0, wrong_lane_attempts: 0, distance_meters: 0 });
      await loadSummary();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Unable to complete session');
    }
  };

  return (
    <section className="panel card">
      <div className="panel-header">
        <div>
          <h3>Delivery Pilot Console</h3>
          <p>Run A/B tests between Google-only vs Smart Route navigation.</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span>Smart Address Code</span>
          <input name="address_code" value={form.address_code} onChange={handleFormChange} placeholder="SLMD-AB12CD" />
        </label>
        <label className="form-field">
          <span>Delivery partner ID</span>
          <input name="delivery_partner_id" value={form.delivery_partner_id} onChange={handleFormChange} placeholder="DP-101" />
        </label>
      </div>

      <label className="form-field">
        <span>Mode</span>
        <select name="mode" value={form.mode} onChange={handleFormChange}>
          <option value="SMART_NAV">Smart Nav (B bucket)</option>
          <option value="GOOGLE_ONLY">Google Maps only (A bucket)</option>
        </select>
      </label>

      <div className="actions-row">
        <button className="control-btn" onClick={startSession}>
          Start session
        </button>
        <button className="small-btn" onClick={loadSummary}>
          Refresh summary
        </button>
      </div>

      <div className="panel-subsection">
        <h4>Complete session</h4>
        <div className="form-grid">
          <label className="form-field">
            <span>Duration (seconds)</span>
            <input type="number" name="duration_seconds" value={metrics.duration_seconds} onChange={handleMetricChange} min={0} />
          </label>
          <label className="form-field">
            <span>Customer calls</span>
            <input type="number" name="customer_calls" value={metrics.customer_calls} onChange={handleMetricChange} min={0} />
          </label>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>Wrong lane attempts</span>
            <input type="number" name="wrong_lane_attempts" value={metrics.wrong_lane_attempts} onChange={handleMetricChange} min={0} />
          </label>
          <label className="form-field">
            <span>Distance (meters)</span>
            <input type="number" name="distance_meters" value={metrics.distance_meters} onChange={handleMetricChange} min={0} />
          </label>
        </div>
        <button className="control-btn" onClick={completeSession}>
          Complete session
        </button>
      </div>

      {status && <div className="alert success">{status}</div>}
      {error && <div className="alert danger">{error}</div>}

      {deliverySummary && (
        <div className="panel-subsection">
          <h4>7-day Summary</h4>
          <div className="summary-grid">
            {['SMART_NAV', 'GOOGLE_ONLY'].map((bucket) => (
              <div key={bucket} className="summary-card">
                <h5>{bucket === 'SMART_NAV' ? 'Smart Nav (B)' : 'Google only (A)'}</h5>
                <p>Deliveries: {deliverySummary[bucket].deliveries}</p>
                <p>Avg duration: {deliverySummary[bucket].avg_duration_seconds}s</p>
                <p>Avg calls: {deliverySummary[bucket].avg_calls}</p>
                <p>Avg wrong lanes: {deliverySummary[bucket].avg_wrong_lane_attempts}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

