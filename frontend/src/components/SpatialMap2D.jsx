import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Plus, 
  Minus, 
  Layers as LayersIcon, 
  Compass
} from 'lucide-react';
import { apiClient } from '../api/client';
import { MAP_STYLES } from '../services/map/MapLayerConfig';

// India bounding box for the "Fit India" control
const INDIA_BOUNDS = [[6.5, 68.0], [35.5, 97.5]];

export default function SpatialMap2D({ 
  projects = [],
  selectedProject, 
  onSelectProject,
  // Sentinel-2 NDVI overlay
  sentinel2OverlayUrl = null,
  sentinel2OverlayBounds = null,
  showSentinel2Overlay = false,
  sentinel2OverlayOpacity = 0.7,
  // Sentinel-2 True Color overlay
  trueColorOverlayOpacity = 0.85,
  // 3D Toggle
  mode = '2D',
  setMode
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef({});
  const baseMapLayerRef = useRef(null);
  const trueColorLayerRef = useRef(null);

  // Map Controls State
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(6);
  const [baseMap, setBaseMap] = useState('HYBRID');

  // Active Spatial Layer Toggles
  const [activeLayers, setActiveLayers] = useState({
    projects: true,
    boundaries: true,
    sentinel2: false, // True Color Overlay
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.5, 78.5],
      zoom: 6,
      minZoom: 3,
      maxZoom: 22,
      zoomControl: false,
      attributionControl: false
    });

    mapInstanceRef.current = map;
    window.__RITAM_MAP__ = map;

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Initialize Layer Groups
    layersGroupRef.current = {
      projects: L.layerGroup().addTo(map),
      boundaries: L.layerGroup().addTo(map),
      sentinel2Overlay: L.layerGroup()
    };

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  // MAPTILER BASE MAP LAYER
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseMapLayerRef.current) {
      map.removeLayer(baseMapLayerRef.current);
    }

    const style = MAP_STYLES[baseMap] || MAP_STYLES.HYBRID;
    
    baseMapLayerRef.current = L.tileLayer(style.url, {
      attribution: style.attribution,
      maxZoom: style.maxZoom,
      maxNativeZoom: style.maxNativeZoom,
      tileSize: style.tileSize || 256,
      zoomOffset: style.zoomOffset || 0,
      crossOrigin: true,
      zIndex: 0
    });

    baseMapLayerRef.current.addTo(map);

    return () => {
      if (baseMapLayerRef.current && map.hasLayer(baseMapLayerRef.current)) {
        map.removeLayer(baseMapLayerRef.current);
        baseMapLayerRef.current = null;
      }
    };
  }, [baseMap]);

  // ------------------------------------------------------------------
  // TRUE COLOR ANALYTICAL OVERLAY (ON DEMAND)
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const loadTrueColor = async () => {
      if (activeLayers.sentinel2 && selectedProject) {
        if (trueColorLayerRef.current) {
          map.removeLayer(trueColorLayerRef.current);
        }
        
        try {
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const bounds = apiClient.getProjectBounds(selectedProject);
          if (!bounds) return;

          const { blobUrl } = await apiClient.fetchTrueColorOverlay(
            selectedProject.id, 
            startDate, 
            endDate, 
            20, 
            1024, 
            1024,
            { bounds }
          );

          trueColorLayerRef.current = L.imageOverlay(blobUrl, bounds, {
            opacity: trueColorOverlayOpacity,
            interactive: false,
            zIndex: 2
          });
          trueColorLayerRef.current.addTo(map);
        } catch (err) {
          console.error("Failed to load true color overlay:", err);
        }
      } else {
        if (trueColorLayerRef.current) {
          map.removeLayer(trueColorLayerRef.current);
          trueColorLayerRef.current = null;
        }
      }
    };

    loadTrueColor();
  }, [activeLayers.sentinel2, selectedProject?.id, trueColorOverlayOpacity]);

  // Pan to selected project boundary
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedProject) return;

    if (selectedProject.boundary && selectedProject.boundary.length >= 3) {
      const bounds = L.latLngBounds(selectedProject.boundary);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
    } else if (selectedProject.center) {
      map.setView(selectedProject.center, selectedProject.zoom || 12, { animate: true });
    }
  }, [selectedProject?.id]);



  // Handle Sentinel-2 NDVI Overlay toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current?.sentinel2Overlay;
    if (!map || !group) return;

    if (showSentinel2Overlay && sentinel2OverlayUrl) {
      group.clearLayers();
      const bounds = sentinel2OverlayBounds || (
        selectedProject?.center 
          ? [
              [selectedProject.center[0] - 0.05, selectedProject.center[1] - 0.05],
              [selectedProject.center[0] + 0.05, selectedProject.center[1] + 0.05]
            ]
          : map.getBounds()
      );

      const sentinelOverlay = L.imageOverlay(
        sentinel2OverlayUrl,
        bounds,
        { opacity: sentinel2OverlayOpacity, interactive: false }
      );
      group.addLayer(sentinelOverlay);
      group.addTo(map);
    } else {
      if (map.hasLayer(group)) {
        map.removeLayer(group);
      }
    }
  }, [showSentinel2Overlay, sentinel2OverlayUrl, sentinel2OverlayBounds, sentinel2OverlayOpacity, selectedProject?.center]);

  // Render Vector Polygons for Projects
  useEffect(() => {
    const map = mapInstanceRef.current;
    const groups = layersGroupRef.current;
    if (!map || !groups.projects) return;

    groups.projects.clearLayers();
    groups.boundaries.clearLayers();

    if (activeLayers.projects) {
      projects.forEach((proj) => {
        if (!proj.boundary) return;
        const isSelected = selectedProject && selectedProject.id === proj.id;

        const style = {
          color: isSelected ? '#ffffff' : '#3a5542',
          weight: isSelected ? 2.5 : 1.2,
          opacity: isSelected ? 1.0 : 0.75,
          fillColor: isSelected ? '#294231' : '#18221b',
          fillOpacity: isSelected ? 0.35 : 0.15,
          dashArray: isSelected ? null : '4, 4'
        };

        let layer;
        if (proj.boundary && proj.boundary.type) {
          layer = L.geoJSON(proj.boundary, { style }).addTo(groups.projects);
        } else {
          layer = L.polygon(proj.boundary, style).addTo(groups.projects);
        }

        layer.on('click', () => onSelectProject?.(proj));

        // Editorial Minimal Tooltip
        layer.bindTooltip(`
          <div style="padding: 4px 8px; font-family: var(--font-sans); background: #0f1511; color: #f3efe8; border: 1px solid rgba(255,255,255,0.15);">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca79e;">PROJECT CORRIDOR</div>
            <div style="font-size: 12px; font-weight: 700; margin: 2px 0;">${proj.name}</div>
            <div style="font-size: 10px; color: #c2ccc4; font-family: monospace;">Area: ${proj.area || (proj.area_hectares ? proj.area_hectares + ' ha' : 'N/A')}</div>
          </div>
        `, { direction: 'top', opacity: 0.95 });
      });
    }
  }, [projects, selectedProject?.id, activeLayers.projects]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Map Container */}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-dark)' }} 
      />

      {/* Editorial Floating Map Header Bar */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '20px',
        zIndex: 500,
        backgroundColor: 'rgba(15, 21, 17, 0.92)',
        border: '1px solid var(--bg-dark-border)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        backdropFilter: 'blur(8px)',
        color: 'var(--text-on-dark)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
          <span className="editorial-kicker-dark">SENTINEL-2 L2A VIEWPORT</span>
        </div>
        <span style={{ color: 'var(--bg-dark-border)' }}>|</span>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-on-dark-muted)' }}>
          Zoom {currentZoom} · 10m Ground Sample
        </span>
        {selectedProject && (
          <>
            <span style={{ color: 'var(--bg-dark-border)' }}>|</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-on-dark)' }}>
              {selectedProject.name}
            </span>
          </>
        )}
      </div>

      {/* Map Minimal Controls (Right Side) */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '20px',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        {/* 2D / 3D Toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xs)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-subtle)',
          marginBottom: '4px'
        }}>
          <button
            onClick={() => setMode?.('2D')}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: mode === '2D' ? 'var(--color-forest)' : 'transparent',
              color: mode === '2D' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            2D
          </button>
          <button
            onClick={() => setMode?.('3D')}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: mode === '3D' ? 'var(--color-forest)' : 'transparent',
              color: mode === '3D' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              borderLeft: '1px solid var(--border-light)'
            }}
          >
            3D
          </button>
        </div>

        {/* Fit India / All Overview */}
        <button
          onClick={() => mapInstanceRef.current?.fitBounds(INDIA_BOUNDS, { animate: true })}
          title="Fit India Overview"
          style={{
            width: '34px',
            height: '34px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--radius-xs)',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          <Compass size={16} color="var(--color-forest)" />
        </button>

        {/* Zoom In */}
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Zoom In"
          style={{
            width: '34px',
            height: '34px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--radius-xs)',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          <Plus size={16} />
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Zoom Out"
          style={{
            width: '34px',
            height: '34px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--radius-xs)',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          <Minus size={16} />
        </button>

        {/* Toggle Layers */}
        <button
          onClick={() => setShowLayersPanel(!showLayersPanel)}
          title="Toggle Layers"
          style={{
            width: '34px',
            height: '34px',
            backgroundColor: showLayersPanel ? 'var(--color-forest)' : '#ffffff',
            border: '1px solid var(--border-light)',
            color: showLayersPanel ? '#ffffff' : 'var(--text-primary)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--radius-xs)',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          <LayersIcon size={16} />
        </button>
      </div>

      {/* Layer Controls Dropdown */}
      {showLayersPanel && (
        <div style={{
          position: 'absolute',
          top: '160px',
          right: '20px',
          zIndex: 500,
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-overlay)',
          padding: '14px 16px',
          width: '210px',
          color: 'var(--text-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div className="editorial-kicker" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', color: 'var(--color-forest-bright)' }}>
            LAYER SELECTION
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <span>Project Boundaries</span>
            <input 
              type="checkbox" 
              checked={activeLayers.projects} 
              onChange={(e) => setActiveLayers(prev => ({ ...prev, projects: e.target.checked }))} 
              style={{ accentColor: 'var(--color-forest)' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <span>Sentinel True Color</span>
            <input 
              type="checkbox" 
              checked={activeLayers.sentinel2} 
              onChange={(e) => setActiveLayers(prev => ({ ...prev, sentinel2: e.target.checked }))} 
              style={{ accentColor: 'var(--color-forest)' }}
            />
          </label>

          <div className="editorial-kicker" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', marginTop: '8px', color: 'var(--color-forest-bright)' }}>
            BASE MAP
          </div>
          <select 
            value={baseMap} 
            onChange={(e) => setBaseMap(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '6px 8px', 
              fontSize: '12px', 
              borderRadius: 'var(--radius-xs)', 
              border: '1px solid var(--border-light)',
              backgroundColor: '#f9fafa',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="SATELLITE">Satellite (High Res)</option>
            <option value="HYBRID">Hybrid (Labels)</option>
            <option value="STREETS">Streets (Vector)</option>
          </select>
        </div>
      )}

      {/* NDVI False-Color Legend (when NDVI overlay active) */}
      {showSentinel2Overlay && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 500,
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-card)',
          padding: '12px 16px',
          color: 'var(--text-primary)',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>NDVI SPECTRAL SCALE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '140px',
              height: '8px',
              borderRadius: '2px',
              background: 'linear-gradient(to right, #991b1b 0%, #f59e0b 35%, #84cc16 65%, #15803d 100%)'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            <span>-0.2 (Bare)</span>
            <span>+0.2</span>
            <span>+0.8 (Canopy)</span>
          </div>
        </div>
      )}
    </div>
  );
}
