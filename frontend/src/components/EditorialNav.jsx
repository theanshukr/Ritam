import React from 'react';
import { LogOut } from 'lucide-react';

export default function EditorialNav({
  activeNav,
  onSelectNav,
  selectedProject,
  projects = [],
  onSelectProject,
  onLogout
}) {
  const navItems = [
    { id: 'landing', label: 'Overview' },
    { id: 'command-center', label: 'Command Center' },
    { id: 'projects', label: 'Projects' },
    { id: 'satellite', label: 'Satellite & NDVI' },
    { id: 'compliance', label: 'Compliance & Evidence' },
    { id: 'ask-ritam', label: 'Ask Landscape' },
  ];

  return (
    <header style={{
      height: '58px',
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      flexShrink: 0,
      zIndex: 1000,
      boxShadow: 'var(--shadow-subtle)'
    }}>
      {/* Brand & Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div
          onClick={() => onSelectNav('landing')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-sage-pale)',
            border: '1.5px solid var(--color-forest)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--color-forest)'
          }}>
            <svg width="15" height="9" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.178 2c-2.316 0-3.69 1.942-6.178 4-2.488-2.058-3.862-4-6.178-4A5.822 5.822 0 0 0 0 7.822C0 10.138 1.862 12 4.178 12c2.316 0 3.69-1.942 6.178-4 2.488 2.058 3.862 4 6.178 4A5.822 5.822 0 0 0 24 6.178C24 3.862 22.138 2 18.178 2z" />
            </svg>
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-forest)'
          }}>
            RITAM
          </span>
        </div>

        {/* Project Selector (when projects exist) */}
        {projects.length > 0 && activeNav !== 'landing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-light)', paddingLeft: '16px' }}>
            <span className="editorial-kicker" style={{ fontSize: '10px', color: 'var(--color-forest-bright)' }}>Project:</span>
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const proj = projects.find(p => p.id === e.target.value);
                if (proj) onSelectProject(proj);
              }}
              style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                outline: 'none',
                maxWidth: '240px',
                cursor: 'pointer'
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Navigation Links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectNav(item.id)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.01em',
                color: isActive ? 'var(--color-forest)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--color-sage-bg)' : 'transparent',
                borderRadius: 'var(--radius-full)',
                border: '1px solid',
                borderColor: isActive ? 'var(--color-sage-border)' : 'transparent',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-canvas-subtle)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: 'var(--color-forest)',
          backgroundColor: 'var(--color-sage-bg)',
          border: '1px solid var(--color-sage-border)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-forest-bright)' }} />
          <span>S2-L2A LIVE</span>
        </span>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Sign Out"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-alert)';
              e.currentTarget.style.backgroundColor = 'var(--color-alert-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <LogOut size={13} />
            <span>Exit</span>
          </button>
        )}
      </div>
    </header>
  );
}
