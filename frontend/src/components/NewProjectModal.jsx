import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Search, MapPin } from 'lucide-react';
import { apiClient } from '../api/client';
import { GeocodingService } from '../services/GeocodingService';
import L from 'leaflet';
import 'leaflet-draw';
import * as turf from '@turf/turf';

export default function NewProjectModal({ onClose, onAddProject }) {
  const [step, setStep] = useState(1); // 1: Details, 2: Location Method, 3: Map & Draw
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [locationMethod, setLocationMethod] = useState(null); // 'search', 'click', 'manual'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  
  const [projectLocation, setProjectLocation] = useState(null); // { lat, lng, displayName }
  
  const [geometry, setGeometry] = useState(null); // GeoJSON
  const [areaHectares, setAreaHectares] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawControlRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const markerRef = useRef(null);

  // Initialize Map for Step 3
  useEffect(() => {
    if (step === 3 && mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: projectLocation ? [projectLocation.lat, projectLocation.lng] : [20.5937, 78.9629], // Default India
        zoom: projectLocation ? 14 : 5,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

      const drawControl = new L.Control.Draw({
        edit: {
          featureGroup: drawnItems
        },
        draw: {
          polygon: true,
          rectangle: true,
          circle: false,
          circlemarker: false,
          marker: false,
          polyline: false
        }
      });
      map.addControl(drawControl);
      drawControlRef.current = drawControl;

      map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawnItems.clearLayers();
        drawnItems.addLayer(layer);
        updateGeometry();
      });

      map.on(L.Draw.Event.EDITED, () => {
        updateGeometry();
      });
      
      map.on(L.Draw.Event.DELETED, () => {
        setGeometry(null);
        setAreaHectares(0);
      });

      if (projectLocation) {
        const marker = L.marker([projectLocation.lat, projectLocation.lng]).addTo(map);
        marker.bindPopup(projectLocation.displayName || 'Selected Location').openPopup();
        markerRef.current = marker;
      }

      if (locationMethod === 'click') {
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          setProjectLocation({ lat, lng, displayName: `Map Click: ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng]).addTo(map);
          }
        });
      }

      mapInstanceRef.current = map;
    }
  }, [step, projectLocation, locationMethod]);

  function updateGeometry() {
    if (!drawnItemsRef.current) return;
    const data = drawnItemsRef.current.toGeoJSON();
    if (data.features.length > 0) {
      const geojson = data.features[0].geometry;
      setGeometry(geojson);
      // Calculate area
      const areaSqMeters = turf.area(geojson);
      setAreaHectares(areaSqMeters / 10000);
    } else {
      setGeometry(null);
      setAreaHectares(0);
    }
  }

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    const results = await GeocodingService.search(searchQuery);
    setSearchResults(results);
    setLoading(false);
  };

  const handleSelectSearchResult = (result) => {
    setProjectLocation({
      lat: result.lat,
      lng: result.lon,
      displayName: result.displayName
    });
    setStep(3);
  };

  const handleManualCoords = () => {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Invalid coordinates');
      return;
    }
    setProjectLocation({
      lat,
      lng,
      displayName: `Manual: ${lat}, ${lng}`
    });
    setStep(3);
  };

  const handleMapClickStart = () => {
    setLocationMethod('click');
    setProjectLocation(null);
    setStep(3);
  };

  const handleSave = async () => {
    if (!name || !geometry) {
      setError("Project name and boundary are required.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const newProj = await apiClient.createProject({
        name,
        description,
        geojson_boundary: geometry
      });
      // The backend returns a minimal object, we might want to refresh projects, but for now we pass it up
      onAddProject({
        id: newProj.id || 'new', // It might not return id immediately in our simple mock response
        name,
        description,
        area_hectares: newProj.area_hectares || areaHectares,
        status: newProj.status || 'BASELINE_PENDING',
        boundary: geometry.coordinates[0].map(c => [c[1], c[0]]), // Leaflet uses [lat, lng]
        center: projectLocation ? [projectLocation.lat, projectLocation.lng] : [geometry.coordinates[0][0][1], geometry.coordinates[0][0][0]]
      });
      setLoading(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save project');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(20, 35, 25, 0.45)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        width: step === 3 ? '1000px' : '520px',
        maxWidth: '95vw',
        height: step === 3 ? '80vh' : 'auto',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-light)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-overlay)',
        position: 'relative',
        display: 'flex',
        flexDirection: step === 3 ? 'row' : 'column',
        overflow: 'hidden'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            color: 'var(--text-muted)',
            padding: '4px',
            borderRadius: 'var(--radius-full)',
            zIndex: 1000
          }}
        >
          <X size={18} />
        </button>

        {/* Wizard Left Side (or full width if not step 3) */}
        <div style={{
          flex: step === 3 ? '0 0 350px' : '1',
          padding: '36px 40px',
          overflowY: 'auto',
          borderRight: step === 3 ? '1px solid var(--border-light)' : 'none',
          backgroundColor: 'var(--bg-canvas)'
        }}>
          <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>
            NEW CORRIDOR DEFINITION
          </span>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0 20px 0', color: 'var(--text-primary)' }}>
            {step === 1 ? 'Project Details' : step === 2 ? 'Location Method' : 'Draw Boundary'}
          </h2>

          {error && (
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-alert-bg)', color: 'var(--color-alert)', fontSize: '12px', marginBottom: '16px', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                />
              </div>
              <button 
                onClick={() => { if (name) setStep(2); else setError("Name required"); }}
                className="btn-editorial-primary"
                style={{ marginTop: '10px' }}
              >
                Next Step <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Method A: Search */}
              <div style={{ padding: '16px', border: '1px solid var(--border-light)', borderRadius: '8px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Method A: Search Place</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. Delhi"
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                  />
                  <button onClick={handleSearch} className="btn-editorial-outline"><Search size={16}/></button>
                </div>
                {searchResults.length > 0 && (
                  <ul style={{ marginTop: '10px', listStyle: 'none', padding: 0, maxHeight: '150px', overflowY: 'auto' }}>
                    {searchResults.map((res, i) => (
                      <li key={i} onClick={() => handleSelectSearchResult(res)} style={{ padding: '8px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '12px' }}>
                        {res.displayName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Method B: Map Click */}
              <div style={{ padding: '16px', border: '1px solid var(--border-light)', borderRadius: '8px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Method B: Map Click</h3>
                <button onClick={handleMapClickStart} className="btn-editorial-outline" style={{ width: '100%' }}>
                  <MapPin size={16} /> Open Map to Click
                </button>
              </div>

              {/* Method C: Manual Coordinates */}
              <div style={{ padding: '16px', border: '1px solid var(--border-light)', borderRadius: '8px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Method C: Manual Coordinates</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" placeholder="Lat (e.g. 28.5)" value={latStr} onChange={e=>setLatStr(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                  <input type="text" placeholder="Lng (e.g. 77.1)" value={lngStr} onChange={e=>setLngStr(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                </div>
                <button onClick={handleManualCoords} className="btn-editorial-outline" style={{ width: '100%' }}>Use Coordinates</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {locationMethod === 'click' ? "Click on the map to set a center point, then draw the boundary." : "Use the drawing tools on the map to define the project boundary."}
              </div>
              
              <div style={{ padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#166534' }}>Calculated Area</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>
                  {areaHectares.toFixed(2)} ha
                </div>
              </div>

              {geometry && (
                <div style={{ fontSize: '11px', color: 'var(--color-forest)', fontWeight: 600 }}>
                  ✓ Valid Geometry Captured
                </div>
              )}

              <button 
                onClick={handleSave}
                disabled={loading || !geometry}
                className="btn-editorial-primary"
                style={{ marginTop: 'auto', padding: '12px' }}
              >
                {loading ? 'Saving to PostGIS...' : 'Save Spatial Project'}
              </button>
            </div>
          )}
        </div>

        {/* Map Container (Step 3 only) */}
        {step === 3 && (
          <div ref={mapContainerRef} style={{ flex: 1, height: '100%' }}></div>
        )}
      </div>
    </div>
  );
}
