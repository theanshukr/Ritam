import React from 'react';
import { ArrowRight, Satellite, ShieldCheck, Compass, Layers } from 'lucide-react';

export default function LandingView({ onEnterConsole, onSelectSection }) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#07100b',
      color: 'var(--text-primary)',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* 1. SINGLE, CONTINUOUS, BRIGHT FOREST ENVIRONMENT (STAYS CONSISTENT ACROSS ENTIRE PAGE) */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'url(/images/forest_corridor_aerial.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        zIndex: 0,
        pointerEvents: 'none'
      }}>
        {/* Subtle, Bright, Natural Botanical Overlay */}
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(8, 22, 13, 0.26) 0%, rgba(8, 22, 13, 0.10) 35%, rgba(8, 22, 13, 0.20) 70%, rgba(8, 22, 13, 0.32) 100%)'
        }} />
      </div>

      {/* 2. FOREGROUND CONTENT (SCROLLS OVER THE CONTINUOUS NATURAL SCENE) */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Floating Light Navigation Bar */}
        <div style={{ padding: '24px 32px 0 32px', maxWidth: '1240px', margin: '0 auto' }}>
          <header style={{
            backgroundColor: 'rgba(255, 255, 255, 0.90)',
            border: '1px solid rgba(45, 106, 79, 0.18)',
            borderRadius: '9999px',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px -4px rgba(20, 45, 30, 0.15)'
          }}>
            {/* Brand Logo with Infinity Symbol */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              <span style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginLeft: '4px',
                borderLeft: '1px solid var(--border-light)',
                paddingLeft: '10px',
                fontWeight: 600
              }}>
                Terrestrial Intelligence
              </span>
            </div>

            {/* Navigation Links */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[
                { id: 'command-center', label: 'Command Center' },
                { id: 'projects', label: 'Project Corridors' },
                { id: 'satellite', label: 'Sentinel-2 Observation' },
                { id: 'compliance', label: 'Compliance & Evidence' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectSection?.(item.id)}
                  style={{
                    padding: '7px 16px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    borderRadius: '9999px',
                    transition: 'all 0.18s ease',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-sage-bg)';
                    e.currentTarget.style.color = 'var(--color-forest)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Action CTA */}
            <button
              onClick={onEnterConsole}
              className="btn-editorial-primary"
              style={{ padding: '8px 20px', fontSize: '11.5px' }}
            >
              <span>Launch Workspace</span>
              <ArrowRight size={13} />
            </button>
          </header>
        </div>

        {/* HERO SECTION */}
        <section style={{
          minHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 32px 48px 32px',
          maxWidth: '1240px',
          margin: '0 auto'
        }}>
          {/* Main Hero Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '36px', marginTop: 'auto' }}>
            <div style={{ maxWidth: '820px' }}>
              {/* Prominent Light-Green RITAM Brand Headline */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(64px, 8vw, 110px)',
                fontWeight: 800,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: '#68d391',
                lineHeight: 1,
                marginBottom: '20px',
                textShadow: '0 3px 20px rgba(0, 0, 0, 0.6)'
              }}>
                RITAM
              </div>

              {/* Substantially Larger, Prominent Main Headline */}
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(54px, 6.8vw, 86px)',
                fontWeight: 850,
                color: '#ffffff',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                textShadow: '0 4px 24px rgba(0, 0, 0, 0.85)',
                margin: '0 0 6px 0'
              }}>
                Protect Nature, <br />
                <span style={{
                  color: '#9ae6b4',
                  fontWeight: 700
                }}>
                  Preserve Our Future
                </span>
              </h1>

              {/* Subtitle */}
              <p style={{
                marginTop: '18px',
                fontSize: '16.5px',
                lineHeight: 1.65,
                color: 'rgba(255, 255, 255, 0.96)',
                fontWeight: 450,
                maxWidth: '620px',
                textShadow: '0 2px 12px rgba(0, 0, 0, 0.8)'
              }}>
                Moving environmental verification from periodic static paperwork to continuous, satellite-derived empirical intelligence across linear infrastructure corridors.
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '34px', flexWrap: 'wrap' }}>
                <button
                  onClick={onEnterConsole}
                  style={{
                    padding: '13px 28px',
                    backgroundColor: '#ffffff',
                    color: '#142018',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-sage-pale)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span>Enter Operational Console</span>
                  <ArrowRight size={15} />
                </button>

                <div style={{
                  padding: '11px 20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.93)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(45, 106, 79, 0.2)',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-forest)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)'
                }}>
                  <Satellite size={14} color="var(--color-forest-bright)" />
                  <span>Copernicus Sentinel-2 Live</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 1: CORE PRINCIPLES (SUBTLY TRANSLUCENT LIGHT SURFACE, 92% SOLID) */}
        <section style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '20px 32px 60px 32px'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            borderRadius: '16px',
            padding: '36px 44px',
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.6fr 1fr',
            gap: '36px',
            alignItems: 'center',
            boxShadow: '0 12px 32px -8px rgba(10, 30, 18, 0.12)',
            border: '1px solid rgba(45, 106, 79, 0.16)'
          }}>
            {/* Column 1 */}
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-forest)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                SPATIAL INFRASTRUCTURE
              </div>
              <div style={{ fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                PostGIS Cadastre
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '6px' }}>
                Deterministic WGS84 GeoJSON corridor definitions ensuring strict area-of-interest telemetry.
              </p>
            </div>

            {/* Column 2 */}
            <div style={{ borderLeft: '1px solid rgba(45, 106, 79, 0.14)', borderRight: '1px solid rgba(45, 106, 79, 0.14)', padding: '0 28px' }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-forest)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                CORE PRINCIPLE
              </div>
              <p style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '15.5px',
                fontStyle: 'italic',
                color: 'var(--text-primary)',
                lineHeight: 1.55,
                marginTop: '6px'
              }}>
                “Understanding how linear infrastructure development alters the living canopy, before, during, and long after construction.”
              </p>
            </div>

            {/* Column 3 */}
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-forest)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                STATUTORY COMPLIANCE
              </div>
              <div style={{ fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                SHA-256 Anchored
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '6px' }}>
                Every multispectral raster evaluation is anchored cryptographically for statutory audit readiness.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: ARCHITECTURE (SUBTLY TRANSLUCENT LIGHT SURFACE) */}
        <section style={{
          padding: '20px 32px 70px 32px',
          maxWidth: '1240px',
          margin: '0 auto'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            borderRadius: '16px',
            padding: '40px',
            border: '1px solid rgba(45, 106, 79, 0.16)',
            boxShadow: '0 12px 32px -8px rgba(10, 30, 18, 0.12)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '36px', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>
                  01 / CONTINUOUS CANOPY SURVEILLANCE
                </span>
                <h2 style={{
                  fontSize: '28px',
                  marginTop: '6px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.015em'
                }}>
                  Environmental Intelligence Architecture
                </h2>
              </div>
              <p style={{ maxWidth: '480px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                Eliminating fragmented paperwork. RITAM establishes an unbroken evidentiary chain from project boundaries to verified canopy survival.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px'
            }}>
              {/* Card 1 */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.90)',
                border: '1px solid rgba(45, 106, 79, 0.14)',
                borderRadius: '12px',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderTop: '3px solid var(--color-forest)',
                boxShadow: 'var(--shadow-subtle)'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Compass size={22} color="var(--color-forest)" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-forest-bright)', fontWeight: 700 }}>
                      01.01
                    </span>
                  </div>
                  <h3 style={{ fontSize: '17px', margin: '16px 0 10px 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Spatial Cadastre & AOI
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    Precision WGS84 GeoJSON corridor definitions. PostGIS geometry validation ensures exact area-of-interest calculation without boundary drift.
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.90)',
                border: '1px solid rgba(45, 106, 79, 0.14)',
                borderRadius: '12px',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderTop: '3px solid var(--color-forest)',
                boxShadow: 'var(--shadow-subtle)'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Layers size={22} color="var(--color-forest)" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-forest-bright)', fontWeight: 700 }}>
                      01.02
                    </span>
                  </div>
                  <h3 style={{ fontSize: '17px', margin: '16px 0 10px 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Multispectral NDVI
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    Copernicus Sentinel-2 Band 8 (NIR) & Band 4 (Red) BOA reflectance. Server-side cloud-masked evalscripts calculate empirical vegetation change.
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.90)',
                border: '1px solid rgba(45, 106, 79, 0.14)',
                borderRadius: '12px',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderTop: '3px solid var(--color-forest)',
                boxShadow: 'var(--shadow-subtle)'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ShieldCheck size={22} color="var(--color-forest)" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-forest-bright)', fontWeight: 700 }}>
                      01.03
                    </span>
                  </div>
                  <h3 style={{ fontSize: '17px', margin: '16px 0 10px 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Verifiable Evidence
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    Deterministic SHA-256 cryptographic digests anchor every satellite scene, change event triage decision, and field inspection record.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SATELLITE ENGINE (SUBTLY TRANSLUCENT LIGHT SURFACE) */}
        <section style={{
          padding: '0 32px 80px 32px',
          maxWidth: '1240px',
          margin: '0 auto'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            borderRadius: '16px',
            padding: '44px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid rgba(45, 106, 79, 0.16)',
            boxShadow: '0 12px 32px -8px rgba(10, 30, 18, 0.12)'
          }}>
            <div>
              <span className="editorial-kicker" style={{ color: 'var(--color-forest-bright)' }}>
                02 / COPERNICUS SATELLITE ENGINE
              </span>
              <h2 style={{
                fontSize: '28px',
                color: 'var(--text-primary)',
                marginTop: '8px',
                maxWidth: '620px',
                fontWeight: 700,
                lineHeight: 1.18,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.015em'
              }}>
                10-Meter Native Ground Resolution
              </h2>
              <p style={{
                maxWidth: '560px',
                marginTop: '12px',
                fontSize: '13.5px',
                color: 'var(--text-secondary)',
                lineHeight: 1.65
              }}>
                Dynamic XYZ slippy-map tiling combined with server-side evalscript stretching delivers natural true-color and color-mapped NDVI layers directly inside the interactive console.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '56px', borderTop: '1px solid rgba(45, 106, 79, 0.14)', paddingTop: '24px', marginTop: '32px' }}>
              <div>
                <div style={{ fontSize: '26px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-forest)' }}>5-Day</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>Revisit Cycle</div>
              </div>
              <div>
                <div style={{ fontSize: '26px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-forest)' }}>10 m/px</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>Spatial Resolution</div>
              </div>
              <div>
                <div style={{ fontSize: '26px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-forest)' }}>13 Bands</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>Spectral Coverage</div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. FOOTER (SUBTLY TRANSLUCENT) */}
        <footer style={{
          padding: '28px 48px',
          borderTop: '1px solid rgba(45, 106, 79, 0.18)',
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', letterSpacing: '0.12em', color: 'var(--color-forest)' }}>
              RITAM
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>
              © 2026 Environmental Intelligence & Earth Observation Platform
            </span>
          </div>

          <button
            onClick={onEnterConsole}
            className="btn-editorial-primary"
          >
            <span>Access Workspace</span>
            <ArrowRight size={13} />
          </button>
        </footer>
      </div>
    </div>
  );
}
