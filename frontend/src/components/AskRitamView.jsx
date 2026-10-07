import React, { useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';

export default function AskRitamView() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState(null);

  const sampleQuestions = [
    "What is the average NDVI trend across the Delhi–Meerut RRTS corridor over the last 90 days?",
    "Identify any detected vegetation loss zones with severity rated High or Critical.",
    "Summarize compensatory plantation survival rates against statutory requirements."
  ];

  const handleQuery = (q) => {
    const text = q || query;
    if (!text.trim()) return;
    setSubmittedQuery(text);
  };

  return (
    <div style={{
      padding: '48px 60px',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: 'var(--bg-canvas)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      maxWidth: '920px',
      margin: '0 auto'
    }}>
      {/* Top Header */}
      <div>
        <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>
          ENVIRONMENTAL QUERY ENGINE
        </span>
        <h1 style={{
          fontSize: '32px',
          marginTop: '6px',
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: 'var(--text-primary)'
        }}>
          Ask the Landscape
        </h1>
        <p style={{
          fontSize: '14.5px',
          color: 'var(--text-secondary)',
          marginTop: '8px',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          lineHeight: 1.6
        }}>
          Natural language spatial interrogation across PostGIS project cadastre, Copernicus spectral rasters, and field registries.
        </p>

        {/* Query Input Box */}
        <div style={{
          marginTop: '32px',
          border: '1px solid var(--border-light)',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-full)',
          padding: '6px 8px 6px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery(query)}
            placeholder="Ask a question about corridor vegetation, NDVI change, or compliance..."
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              outline: 'none',
              fontSize: '13.5px',
              color: 'var(--text-primary)',
              backgroundColor: 'transparent'
            }}
          />
          <button
            onClick={() => handleQuery(query)}
            className="btn-editorial-primary"
            style={{ padding: '8px 22px' }}
          >
            <span>Query</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Suggested Interrogations */}
        <div style={{ marginTop: '28px' }}>
          <span className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            SUGGESTED GEOSPATIAL QUERIES
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(q);
                  handleQuery(q);
                }}
                style={{
                  textAlign: 'left',
                  padding: '12px 18px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-subtle)',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-forest)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-canvas-subtle)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-light)';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <span>{q}</span>
                <ArrowRight size={13} color="var(--color-forest-bright)" />
              </button>
            ))}
          </div>
        </div>

        {/* Response Architecture Notice */}
        {submittedQuery && (
          <div style={{
            marginTop: '32px',
            padding: '24px 28px',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-forest-bright)', marginBottom: '8px' }}>
              <Info size={16} />
              <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>SPATIAL QUERY INTERFACE</span>
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Evaluation: "{submittedQuery}"
            </div>
            <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              Direct query execution evaluates topological boundaries in PostGIS and cross-references multi-temporal Sentinel-2 L2A BOA reflectance rasters. For interactive spectral differencing, navigate to the <strong>Satellite & NDVI</strong> workspace.
            </p>
          </div>
        )}
      </div>

      {/* Footer Notice */}
      <div style={{
        paddingTop: '24px',
        borderTop: '1px solid var(--border-light)',
        fontSize: '11.5px',
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>RITAM Spatial Reasoning Interface</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>PostGIS & Sentinel-2 L2A</span>
      </div>
    </div>
  );
}
