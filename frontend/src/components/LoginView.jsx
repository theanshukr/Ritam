import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { apiClient } from '../api/client';

export default function LoginView({ onAuthenticated, onCancel }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiClient.login(email, password);
      onAuthenticated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      backgroundColor: '#07100b',
      backgroundImage: 'linear-gradient(180deg, rgba(7, 16, 11, 0.45) 0%, rgba(7, 16, 11, 0.75) 100%), url(/images/forest_corridor_aerial.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '440px',
        maxWidth: '92vw',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-light)',
        borderRadius: '16px',
        padding: '40px 36px',
        boxShadow: 'var(--shadow-overlay)',
        position: 'relative'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-sage-pale)',
            border: '1.5px solid var(--color-forest)',
            display: 'grid',
            placeItems: 'center'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-forest)' }} />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-forest)'
          }}>
            RITAM
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
            Console Access
          </span>
        </div>

        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginTop: '6px',
          marginBottom: '20px',
          letterSpacing: '-0.015em'
        }}>
          Sign in to Platform
        </h1>

        {error && (
          <div role="alert" style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-alert-bg)',
            border: '1px solid rgba(188, 71, 73, 0.3)',
            borderRadius: '8px',
            color: 'var(--color-alert)',
            fontSize: '12px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Authority / User Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="e.g. officer@moefcc.gov.in"
              style={{
                width: '100%',
                padding: '11px 14px',
                backgroundColor: 'var(--bg-canvas-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '11px 14px',
                backgroundColor: 'var(--bg-canvas-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-editorial-primary"
            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
          >
            <span>{loading ? 'Authenticating...' : 'Sign in to Console'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {onCancel && (
          <div style={{ textAlign: 'center', marginTop: '18px' }}>
            <button
              onClick={onCancel}
              style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'underline' }}
            >
              Return to Landing Page
            </button>
          </div>
        )}

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Copernicus Sentinel-2 & PostGIS Spatial Cadastre
        </div>
      </div>
    </main>
  );
}
