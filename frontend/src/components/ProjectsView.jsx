import React, { useState } from 'react';
import { Plus, Search, ArrowRight } from 'lucide-react';
import NewProjectModal from './NewProjectModal';

export default function ProjectsView({ 
  projects = [], 
  onSelectProject, 
  onAddProject,
  onNavigateTab
}) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showModal, setShowModal] = useState(false);

  const filtered = projects.filter((p) => {
    const matchStatus = filterStatus === 'ALL' || (p.status && p.status.includes(filterStatus));
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                        (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  return (
    <div style={{
      padding: '32px 48px',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: 'var(--bg-canvas)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Editorial Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>
            DATABASE CADASTRE
          </span>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            marginTop: '4px',
            color: 'var(--text-primary)',
            letterSpacing: '-0.015em'
          }}>
            Infrastructure Corridors & AOIs
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Registered spatial footprints monitored via Copernicus Sentinel-2 multispectral constellated passes.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-editorial-primary"
        >
          <Plus size={14} />
          <span>Register New Corridor</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderTop: '1px solid var(--border-light)',
        borderBottom: '1px solid var(--border-light)',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: 1,
          maxWidth: '380px',
          backgroundColor: '#ffffff',
          padding: '8px 14px',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-full)'
        }}>
          <Search size={15} color="var(--color-forest-bright)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project name or corridor..."
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Status:</span>
          {['ALL', 'MONITORING', 'BASELINE'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '5px 14px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                borderRadius: 'var(--radius-full)',
                backgroundColor: filterStatus === status ? 'var(--color-forest)' : '#ffffff',
                color: filterStatus === status ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: filterStatus === status ? 'var(--color-forest)' : 'var(--border-light)',
                transition: 'all 0.18s ease'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Editorial Table */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        {/* Table Header Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 1.2fr',
          padding: '12px 20px',
          backgroundColor: 'var(--bg-canvas-subtle)',
          borderBottom: '1px solid var(--border-light)',
          fontSize: '11px',
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)'
        }}>
          <div>Corridor & Identity</div>
          <div>Location / Cadastre</div>
          <div>Area (Hectares)</div>
          <div>Monitoring Status</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {/* Table Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No project corridors found matching your criteria.
          </div>
        ) : (
          filtered.map((proj, idx) => (
            <div
              key={proj.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 1.2fr',
                padding: '18px 20px',
                alignItems: 'center',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-light)' : 'none',
                transition: 'background-color 0.15s ease',
                backgroundColor: '#ffffff'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-canvas-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              {/* Name & ID */}
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {proj.name}
                </div>
                <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ID: {proj.id}
                </div>
              </div>

              {/* Location */}
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                {proj.location || (proj.center ? `${proj.center[0]?.toFixed(2)}°N, ${proj.center[1]?.toFixed(2)}°E` : 'WGS84')}
              </div>

              {/* Area */}
              <div style={{ fontSize: '13.5px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {proj.area || (proj.area_hectares ? `${proj.area_hectares} ha` : 'N/A')}
              </div>

              {/* Status */}
              <div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-forest)',
                  backgroundColor: 'var(--color-sage-bg)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-sage-border)'
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-forest-bright)' }} />
                  <span>{proj.status || 'MONITORING ACTIVE'}</span>
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => {
                    onSelectProject(proj);
                    onNavigateTab?.('command-center');
                  }}
                  className="btn-editorial-outline"
                  style={{ padding: '5px 14px', fontSize: '11px' }}
                >
                  <span>Focus Map</span>
                </button>

                <button
                  onClick={() => {
                    onSelectProject(proj);
                    onNavigateTab?.('satellite');
                  }}
                  className="btn-editorial-primary"
                  style={{ padding: '5px 14px', fontSize: '11px' }}
                >
                  <span>NDVI</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Register Modal */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onAddProject={(newProj) => {
            onAddProject?.(newProj);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
