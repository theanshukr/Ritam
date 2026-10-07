import React from 'react';
import { ArrowRight } from 'lucide-react';
import SpatialMap from './SpatialMap';

export default function CommandCenter({
  projects = [],
  selectedProject,
  onSelectProject,
  sentinel2OverlayUrl,
  sentinel2OverlayBounds,
  showSentinel2Overlay,
  sentinel2OverlayOpacity,
  trueColorOverlayOpacity,
  onNavigateTab
}) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-canvas)',
      overflow: 'hidden'
    }}>
      {/* Sub-Header / Workspace Title Bar */}
      <div style={{
        padding: '12px 28px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-canvas-subtle)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>
            OPERATIONAL SPATIAL CONSOLE
          </span>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {projects.length} Monitored Infrastructure Corridors
          </span>
        </div>

        {selectedProject && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Focused Site:</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedProject.name}
            </span>
            <button
              onClick={() => onNavigateTab?.('satellite')}
              className="btn-editorial-primary"
              style={{ padding: '6px 16px', fontSize: '11px' }}
            >
              <span>Inspect NDVI</span>
              <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Main Map Workspace (Dominant Component) */}
      <div style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        display: 'flex'
      }}>
        {/* The Map container */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <SpatialMap
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
            onOpenProject={onSelectProject}
            sentinel2OverlayUrl={sentinel2OverlayUrl}
            sentinel2OverlayBounds={sentinel2OverlayBounds}
            showSentinel2Overlay={showSentinel2Overlay}
            sentinel2OverlayOpacity={sentinel2OverlayOpacity}
            trueColorOverlayOpacity={trueColorOverlayOpacity}
          />
        </div>

        {/* Right Side Minimal Observation Drawer (Light Editorial) */}
        {selectedProject && (
          <aside style={{
            width: '320px',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px',
            overflowY: 'auto',
            flexShrink: 0,
            boxShadow: 'var(--shadow-subtle)'
          }}>
            <div>
              <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>
                SELECTED CORRIDOR
              </span>
              <h2 style={{ fontSize: '19px', fontWeight: 700, margin: '6px 0 14px 0', lineHeight: 1.2, color: 'var(--text-primary)' }}>
                {selectedProject.name}
              </h2>

              <div className="editorial-rule" style={{ margin: '14px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Status</div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-forest)',
                    backgroundColor: 'var(--color-sage-bg)',
                    border: '1px solid var(--color-sage-border)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    marginTop: '4px'
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-forest-bright)' }} />
                    <span>{selectedProject.status || 'MONITORING ACTIVE'}</span>
                  </div>
                </div>

                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Corridor Area</div>
                  <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedProject.area || (selectedProject.area_hectares ? `${selectedProject.area_hectares} ha` : 'Area Calculated via PostGIS')}
                  </div>
                </div>

                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Geographic Center</div>
                  <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {selectedProject.center ? `${selectedProject.center[0]?.toFixed(4)}°N, ${selectedProject.center[1]?.toFixed(4)}°E` : 'EPSG:4326 Defined'}
                  </div>
                </div>

                <div>
                  <div className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Satellite Ingestion</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Copernicus Sentinel-2 L2A (10m)
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => onNavigateTab?.('satellite')}
                className="btn-editorial-primary"
                style={{ width: '100%' }}
              >
                <span>Satellite Spectral Analysis</span>
                <ArrowRight size={13} />
              </button>

              <button
                onClick={() => onNavigateTab?.('projects')}
                className="btn-editorial-outline"
                style={{ width: '100%' }}
              >
                <span>View All Corridors</span>
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
