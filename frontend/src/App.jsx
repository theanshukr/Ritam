import React, { useState, useEffect } from 'react';
import LandingView from './components/LandingView';
import EditorialNav from './components/EditorialNav';
import CommandCenter from './components/CommandCenter';
import ProjectsView from './components/ProjectsView';
import SatelliteMonitoring from './components/SatelliteMonitoring';
import EvidenceComplianceView from './components/EvidenceComplianceView';
import AskRitamView from './components/AskRitamView';
import LoginView from './components/LoginView';
import { apiClient } from './api/client';
import { PROJECTS as DEFAULT_PROJECTS } from './data/mockData';

function toMapProject(project) {
  const geometry = project.boundary;
  let boundary = [];

  if (Array.isArray(geometry)) {
    boundary = geometry;
  } else if (geometry?.type === 'MultiPolygon') {
    const coordinates = geometry.coordinates?.[0]?.[0] || [];
    boundary = coordinates.map(([lng, lat]) => [lat, lng]);
  } else if (geometry?.type === 'Polygon') {
    const coordinates = geometry.coordinates?.[0] || [];
    boundary = coordinates.map(([lng, lat]) => [lat, lng]);
  }

  const center = boundary.length
    ? boundary.reduce((sum, c) => [sum[0] + c[0] / boundary.length, sum[1] + c[1] / boundary.length], [0, 0])
    : (project.center || [28.75, 77.58]);

  return {
    ...project,
    status: project.status || 'MONITORING_ACTIVE',
    location: project.location || 'Northern Terrestrial Corridor',
    area: project.area_hectares ? `${project.area_hectares} ha` : (project.area || '450 ha'),
    area_hectares: project.area_hectares || project.areaNum || 450,
    boundary,
    center,
    zoom: 12
  };
}

export default function App() {
  const [activeNav, setActiveNav] = useState('landing');
  const [authenticated, setAuthenticated] = useState(() => !!localStorage.getItem('ritam_token'));
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  const [projectsList, setProjectsList] = useState(() => DEFAULT_PROJECTS.map(toMapProject));
  const [selectedProject, setSelectedProject] = useState(() => DEFAULT_PROJECTS[0] ? toMapProject(DEFAULT_PROJECTS[0]) : null);
  
  // Sentinel-2 NDVI overlay
  const [sentinel2OverlayUrl, setSentinel2OverlayUrl] = useState(null);
  const [showSentinel2Overlay, setShowSentinel2Overlay] = useState(false);
  const [sentinel2OverlayOpacity, setSentinel2OverlayOpacity] = useState(0.75);

  // Load backend projects if authenticated
  useEffect(() => {
    if (authenticated) {
      apiClient.getProjects()
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            const mapped = data.map(toMapProject);
            setProjectsList(mapped);
            setSelectedProject(mapped[0]);
          }
        })
        .catch((err) => {
          console.warn('Backend project loader notice (using fallback corridors):', err.message);
        });
    }
  }, [authenticated]);

  const handleLogout = () => {
    apiClient.logout();
    setAuthenticated(false);
    setActiveNav('landing');
  };

  const handleEnterConsole = () => {
    if (!authenticated) {
      setShowLoginModal(true);
    } else {
      setActiveNav('command-center');
    }
  };

  const handleAddProject = (newProj) => {
    const mapped = toMapProject(newProj);
    setProjectsList((prev) => [mapped, ...prev]);
    setSelectedProject(mapped);
    setActiveNav('projects');
  };

  // If Login view requested
  if (showLoginModal) {
    return (
      <LoginView 
        onAuthenticated={() => {
          setAuthenticated(true);
          setShowLoginModal(false);
          setActiveNav('command-center');
        }}
        onCancel={() => setShowLoginModal(false)}
      />
    );
  }

  // If on Landing Page
  if (activeNav === 'landing') {
    return (
      <LandingView
        onEnterConsole={handleEnterConsole}
        onSelectSection={(section) => {
          if (!authenticated) {
            setShowLoginModal(true);
          } else {
            setActiveNav(section);
          }
        }}
      />
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-canvas)',
      overflow: 'hidden'
    }}>
      {/* Editorial Top Navigation */}
      <EditorialNav
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        selectedProject={selectedProject}
        projects={projectsList}
        onSelectProject={setSelectedProject}
        onLogout={handleLogout}
      />

      {/* Main Dynamic Viewport */}
      <main style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {activeNav === 'command-center' && (
          <CommandCenter
            projects={projectsList}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            sentinel2OverlayUrl={sentinel2OverlayUrl}
            showSentinel2Overlay={showSentinel2Overlay}
            onToggleSentinel2Overlay={setShowSentinel2Overlay}
            sentinel2OverlayOpacity={sentinel2OverlayOpacity}
            onSentinel2OverlayOpacityChange={setSentinel2OverlayOpacity}
            trueColorOverlayOpacity={0.88}
            onNavigateTab={setActiveNav}
          />
        )}

        {activeNav === 'projects' && (
          <ProjectsView
            projects={projectsList}
            onSelectProject={setSelectedProject}
            onAddProject={handleAddProject}
            onNavigateTab={setActiveNav}
          />
        )}

        {activeNav === 'satellite' && (
          <SatelliteMonitoring
            selectedProject={selectedProject}
            projects={projectsList}
            onSelectProject={setSelectedProject}
            onNdviOverlayLoaded={(url) => {
              setSentinel2OverlayUrl(url);
              setShowSentinel2Overlay(true);
            }}
          />
        )}

        {activeNav === 'compliance' && (
          <EvidenceComplianceView
            selectedProject={selectedProject}
            projects={projectsList}
          />
        )}

        {activeNav === 'ask-ritam' && (
          <AskRitamView
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
          />
        )}
      </main>
    </div>
  );
}
