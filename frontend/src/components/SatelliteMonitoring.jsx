import React, { useState } from 'react';
import { 
  Satellite, 
  RefreshCw, 
  TrendingDown, 
  TrendingUp, 
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../api/client';
import SpatialMap from './SpatialMap';

export default function SatelliteMonitoring({ 
  selectedProject, 
  projects = [],
  onSelectProject,
  onNdviOverlayLoaded 
}) {
  const [activeMode, setActiveMode] = useState('ndvi'); // 'truecolor', 'ndvi', 'compare'
  
  // Date State
  const today = new Date();
  const defaultCurrentTo = today.toISOString().split('T')[0];
  const defaultCurrentFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultBaselineTo = new Date(today.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultBaselineFrom = new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultCurrentFrom);
  const [endDate, setEndDate] = useState(defaultCurrentTo);
  const [maxCloud, setMaxCloud] = useState(20);

  // Differencing dates
  const [baselineFrom, setBaselineFrom] = useState(defaultBaselineFrom);
  const [baselineTo, setBaselineTo] = useState(defaultBaselineTo);

  // Result States
  const [ndviData, setNdviData] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const projectId = selectedProject?.id;

  const handleRunNDVI = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getSatelliteNDVI(projectId, startDate, endDate, maxCloud);
      if (data) {
        setNdviData(data);
        try {
          const blobUrl = await apiClient.fetchNdviOverlay(projectId, startDate, endDate, maxCloud);
          setOverlayUrl(blobUrl);
          onNdviOverlayLoaded?.(blobUrl);
        } catch (imgErr) {
          console.warn('NDVI overlay image notice:', imgErr.message);
        }
      }
    } catch (err) {
      setError(`Sentinel Hub calculation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCompare = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.compareSatellitePeriods(
        projectId,
        baselineFrom,
        baselineTo,
        startDate,
        endDate,
        maxCloud
      );
      if (data) {
        setComparison(data);
      }
    } catch (err) {
      setError(`Sentinel Hub comparison error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-canvas)',
      overflow: 'hidden'
    }}>
      {/* 1. TOP RESEARCH CONTROL BAR */}
      <div style={{
        padding: '12px 28px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        flexShrink: 0,
        boxShadow: 'var(--shadow-subtle)'
      }}>
        {/* Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="editorial-kicker" style={{ marginRight: '4px', color: 'var(--color-forest-bright)' }}>Analysis Mode:</span>
          {[
            { id: 'truecolor', label: 'True Color RGB' },
            { id: 'ndvi', label: 'NDVI Spectral' },
            { id: 'compare', label: 'Period Differencing' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              style={{
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderRadius: 'var(--radius-full)',
                backgroundColor: activeMode === mode.id ? 'var(--color-forest)' : 'transparent',
                color: activeMode === mode.id ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: activeMode === mode.id ? 'var(--color-forest)' : 'var(--border-light)',
                transition: 'all 0.18s ease'
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Date Inputs & Execution */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {activeMode === 'compare' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <span className="editorial-kicker" style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Baseline:</span>
              <input
                type="date"
                value={baselineFrom}
                onChange={(e) => setBaselineFrom(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '11.5px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-canvas-subtle)' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={baselineTo}
                onChange={(e) => setBaselineTo(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '11.5px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-canvas-subtle)' }}
              />
              <span style={{ color: 'var(--border-strong)', margin: '0 4px' }}>|</span>
              <span className="editorial-kicker" style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Current:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '11.5px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-canvas-subtle)' }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <span className="editorial-kicker" style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Observation Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '11.5px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-canvas-subtle)' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '11.5px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-canvas-subtle)' }}
              />
            </div>
          )}

          {/* Cloud Cover */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="editorial-kicker" style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Cloud:</span>
            <input
              type="range"
              min="0"
              max="50"
              value={maxCloud}
              onChange={(e) => setMaxCloud(Number(e.target.value))}
              style={{ width: '60px', accentColor: 'var(--color-forest)' }}
            />
            <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>≤{maxCloud}%</span>
          </div>

          {/* Execution Button */}
          <button
            onClick={activeMode === 'compare' ? handleRunCompare : handleRunNDVI}
            disabled={loading || !projectId}
            className="btn-editorial-primary"
            style={{ padding: '7px 18px', fontSize: '11px' }}
          >
            {loading ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Satellite size={13} />
            )}
            <span>{loading ? 'Evaluating...' : activeMode === 'compare' ? 'Run Differencing' : 'Compute NDVI'}</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN MAP & ANALYTICS SPLIT */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        {/* Dominant Map Container */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <SpatialMap
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
            sentinel2OverlayUrl={activeMode !== 'truecolor' ? overlayUrl : null}
            showSentinel2Overlay={activeMode !== 'truecolor' && !!overlayUrl}
            sentinel2OverlayOpacity={0.75}
            trueColorOverlayOpacity={0.88}
          />

          {error && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              zIndex: 500,
              backgroundColor: '#ffffff',
              color: 'var(--color-alert)',
              padding: '12px 18px',
              fontSize: '12px',
              maxWidth: '420px',
              border: '1px solid var(--color-alert)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-overlay)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right-Hand Scientific Telemetry Readout (Clean Light Panel) */}
        <aside style={{
          width: '340px',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid var(--border-light)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflowY: 'auto',
          flexShrink: 0,
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div>
            <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>
              SPECTRAL TELEMETRY
            </span>
            <h2 style={{ fontSize: '18px', margin: '4px 0 16px 0', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              Sentinel-2 Analytics
            </h2>

            <div className="editorial-rule" style={{ marginBottom: '16px' }} />

            {/* If NDVI result is available */}
            {ndviData?.ndvi ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Mean Corridor NDVI</div>
                  <div style={{
                    fontSize: '32px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: ndviData.ndvi.mean > 0.4 ? 'var(--color-forest)' : 'var(--color-forest-bright)',
                    lineHeight: 1.1,
                    marginTop: '4px'
                  }}>
                    {ndviData.ndvi.mean.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Range: [{ndviData.ndvi.min.toFixed(2)} to {ndviData.ndvi.max.toFixed(2)}] · σ = {ndviData.ndvi.std?.toFixed(3)}
                  </div>
                </div>

                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Spectral Ground Coverage</div>
                  <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '3px' }}>
                    {ndviData.coverage?.valid_pixels?.toLocaleString() || 0} valid 10m pixels ({ndviData.coverage?.coverage_pct || 100}%)
                  </div>
                </div>

                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Processing Specification</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.55 }}>
                    Sentinel-2 BOA Surface Reflectance Band 8 (NIR) & Band 4 (Red) calculated via server-side evalscript.
                  </div>
                </div>
              </div>
            ) : comparison?.comparison ? (
              /* If Differencing result is available */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Vegetation Change Status</div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: comparison.comparison.vegetation_change === 'VEGETATION_LOSS' ? 'var(--color-alert)' : 'var(--color-forest)',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {comparison.comparison.vegetation_change === 'VEGETATION_LOSS' ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                    <span>{comparison.comparison.vegetation_change}</span>
                  </div>
                </div>

                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NDVI Delta (Δ)</div>
                  <div style={{ fontSize: '28px', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>
                    {comparison.comparison.ndvi_change > 0 ? `+${comparison.comparison.ndvi_change.toFixed(4)}` : comparison.comparison.ndvi_change.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Baseline: {comparison.comparison.baseline_ndvi.toFixed(3)} → Current: {comparison.comparison.current_ndvi.toFixed(3)}
                  </div>
                </div>

                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Empirical Confidence</div>
                  <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {comparison.comparison.confidence}% statistical significance
                  </div>
                </div>
              </div>
            ) : (
              /* Default State */
              <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', lineHeight: 1.6 }}>
                Select an observation range above and click <strong>Compute NDVI</strong> or <strong>Run Differencing</strong> to initiate live Sentinel-2 server-side multispectral analysis.
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div>Constellation: <strong style={{ color: 'var(--text-primary)' }}>Sentinel-2A / 2B</strong></div>
            <div style={{ marginTop: '2px' }}>Provider: <strong style={{ color: 'var(--text-primary)' }}>Copernicus Data Space</strong></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
