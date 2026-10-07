import React, { useEffect, useRef, useState } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { Plus, Minus, Layers as LayersIcon, Compass } from 'lucide-react';

const INDIA_BOUNDS = [[6.5, 68.0], [35.5, 97.5]]; // Leaflet uses [lat, lng], MapLibre expects [lng, lat] bounds
const MAPLIBRE_INDIA_BOUNDS = [[68.0, 6.5], [97.5, 35.5]];

// We only need the API key for initialization.
// The SDK handles style URLs natively.
maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

export default function SpatialMap3D({ 
  projects = [],
  selectedProject, 
  onSelectProject,
  mode = '3D',
  setMode
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Map Controls State
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(6);
  const [baseMap, setBaseMap] = useState(maptilersdk.MapStyle.HYBRID);

  // Active Spatial Layer Toggles
  const [activeLayers, setActiveLayers] = useState({
    projects: true,
  });

  const [webGLSupported, setWebGLSupported] = useState(true);

  // Check WebGL support
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGLSupported(false);
      }
    } catch (e) {
      setWebGLSupported(false);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!webGLSupported || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      const map = new maptilersdk.Map({
        container: mapContainerRef.current,
        style: baseMap,
        center: [78.5, 23.5], // MapLibre uses [lng, lat]
        zoom: 6,
        terrain: true,
        terrainControl: true, // Native SDK control for 3D exaggeration
        navigationControl: false, // We'll build custom or rely on our buttons
        geolocateControl: false,
      });

      mapInstanceRef.current = map;
      window.__RITAM_MAP3D__ = map;

      map.on('zoomend', () => {
        setCurrentZoom(Math.round(map.getZoom() * 10) / 10);
      });

      map.on('load', () => {
        // Add project boundary sources
        map.addSource('projects-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.addLayer({
          id: 'projects-fill',
          type: 'fill',
          source: 'projects-source',
          paint: {
            'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#294231', '#18221b'],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.35, 0.15]
          }
        });

        map.addLayer({
          id: 'projects-line',
          type: 'line',
          source: 'projects-source',
          paint: {
            'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#ffffff', '#3a5542'],
            'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 1.2],
            'line-dasharray': ['case', ['boolean', ['feature-state', 'selected'], false], [1], [4, 4]]
          }
        });

        // Click handler for projects
        map.on('click', 'projects-fill', (e) => {
          if (e.features.length > 0) {
            const projId = e.features[0].properties.id;
            const proj = projects.find(p => p.id === projId);
            if (proj && onSelectProject) onSelectProject(proj);
          }
        });

        map.on('mouseenter', 'projects-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'projects-fill', () => {
          map.getCanvas().style.cursor = '';
        });
      });
    } catch (err) {
      console.error("Failed to initialize MapTiler SDK map:", err);
      setWebGLSupported(false);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [webGLSupported]);

  // Update Base Map Style
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setStyle(baseMap);
    
    // We need to re-add sources and layers when style changes because MapLibre wipes them
    map.once('styledata', () => {
      if (!map.getSource('projects-source')) {
        map.addSource('projects-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.addLayer({
          id: 'projects-fill',
          type: 'fill',
          source: 'projects-source',
          paint: {
            'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#294231', '#18221b'],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.35, 0.15]
          }
        });

        map.addLayer({
          id: 'projects-line',
          type: 'line',
          source: 'projects-source',
          paint: {
            'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#ffffff', '#3a5542'],
            'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 1.2],
            'line-dasharray': ['case', ['boolean', ['feature-state', 'selected'], false], [1], [4, 4]]
          }
        });
        
        // Trigger a data update
        updateProjectsGeoJSON();
      }
    });
  }, [baseMap]);

  // Pan to selected project boundary
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedProject) return;

    if (selectedProject.boundary && selectedProject.boundary.length >= 3) {
      // If boundary is a Leaflet style array of [lat, lng] arrays
      let bounds = new maptilersdk.LngLatBounds();
      
      const extendBounds = (coords) => {
        if (coords.length > 0 && typeof coords[0] === 'number') {
           // We might have [lng, lat] or [lat, lng].
           // In existing Leaflet 2D, coordinates were sometimes converted. Let's assume standard GeoJSON logic:
           // If it's a standard GeoJSON it will be handled differently. If it's raw array:
           // Let's assume [lat, lng] like in Leaflet
           bounds.extend([coords[1], coords[0]]);
        } else if (Array.isArray(coords)) {
           coords.forEach(extendBounds);
        }
      };

      if (selectedProject.boundary.type === 'MultiPolygon' || selectedProject.boundary.type === 'Polygon') {
        // GeoJSON uses [lng, lat]
        const extractGeoJSONCoords = (arr) => {
          if (arr.length === 2 && typeof arr[0] === 'number') {
             bounds.extend(arr);
          } else if (Array.isArray(arr)) {
             arr.forEach(extractGeoJSONCoords);
          }
        };
        extractGeoJSONCoords(selectedProject.boundary.coordinates);
      } else {
        // Fallback for raw arrays
        extendBounds(selectedProject.boundary);
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 40, duration: 1500, pitch: 45, bearing: 0 });
      } else if (selectedProject.center) {
        map.flyTo({ center: [selectedProject.center[1], selectedProject.center[0]], zoom: 12, pitch: 45, duration: 1500 });
      }
    } else if (selectedProject.center) {
      map.flyTo({ center: [selectedProject.center[1], selectedProject.center[0]], zoom: 12, pitch: 45, duration: 1500 });
    }
  }, [selectedProject?.id]);

  // Update Vector Polygons for Projects
  const updateProjectsGeoJSON = () => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource('projects-source')) return;

    if (activeLayers.projects) {
      const features = projects.map(proj => {
        let geometry = proj.boundary;
        // Convert simple array boundary to GeoJSON if necessary
        if (!geometry || !geometry.type) {
           if (Array.isArray(geometry) && geometry.length > 0) {
             // Leaflet array to GeoJSON polygon
             const reversedCoords = geometry.map(c => [c[1], c[0]]);
             // Ensure it's closed
             if (reversedCoords[0][0] !== reversedCoords[reversedCoords.length-1][0] || 
                 reversedCoords[0][1] !== reversedCoords[reversedCoords.length-1][1]) {
                 reversedCoords.push(reversedCoords[0]);
             }
             geometry = { type: 'Polygon', coordinates: [reversedCoords] };
           }
        }

        return {
          type: 'Feature',
          id: proj.id,
          properties: {
            id: proj.id,
            name: proj.name,
          },
          geometry: geometry
        };
      }).filter(f => f.geometry);

      map.getSource('projects-source').setData({
        type: 'FeatureCollection',
        features
      });

      // Update selection state
      features.forEach(f => {
        map.setFeatureState(
          { source: 'projects-source', id: f.id },
          { selected: selectedProject && selectedProject.id === f.id }
        );
      });
    } else {
      map.getSource('projects-source').setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  };

  useEffect(() => {
    updateProjectsGeoJSON();
  }, [projects, selectedProject?.id, activeLayers.projects]);

  if (!webGLSupported) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
        <h2 style={{ marginBottom: '16px' }}>3D View Requires WebGL</h2>
        <p style={{ marginBottom: '24px', color: 'var(--text-on-dark-muted)' }}>Your browser or device does not support WebGL, which is required for 3D terrain rendering.</p>
        <button onClick={() => setMode('2D')} className="btn-editorial-primary">
          Return to 2D Map
        </button>
      </div>
    );
  }

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
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
          <span className="editorial-kicker-dark">TERRAIN 3D</span>
        </div>
        <span style={{ color: 'var(--bg-dark-border)' }}>|</span>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-on-dark-muted)' }}>
          Zoom {currentZoom}
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
          onClick={() => mapInstanceRef.current?.fitBounds(MAPLIBRE_INDIA_BOUNDS, { duration: 1500, pitch: 0, bearing: 0 })}
          title="Reset to Overview"
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
          
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Note: Analytical overlays (NDVI/True Color) are best viewed in 2D mode.
          </div>

          <div className="editorial-kicker" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', marginTop: '8px', color: 'var(--color-forest-bright)' }}>
            BASE MAP
          </div>
          <select 
            value={baseMap === maptilersdk.MapStyle.SATELLITE ? 'SATELLITE' : (baseMap === maptilersdk.MapStyle.HYBRID ? 'HYBRID' : 'STREETS')} 
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'SATELLITE') setBaseMap(maptilersdk.MapStyle.SATELLITE);
              if (val === 'HYBRID') setBaseMap(maptilersdk.MapStyle.HYBRID);
              if (val === 'STREETS') setBaseMap(maptilersdk.MapStyle.STREETS);
            }}
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
    </div>
  );
}
