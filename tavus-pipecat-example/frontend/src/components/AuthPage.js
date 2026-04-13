import React, { useState } from 'react';
import './AuthPage.css';

export default function AuthPage({ onSuccess }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen-overlay" />
      <div className="auth-inner">
        <div className="auth-logo">
          <img src="/aws-logo.svg" alt="AWS" className="auth-aws-logo" />
        </div>
        <div className="auth-card">
          <h1 className="auth-title">AWS Voice AI Demo</h1>
          <p className="auth-subtitle">Enter the access password to continue.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoFocus
              required
            />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-button" disabled={loading || !token}>
              {loading ? 'Checking…' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
