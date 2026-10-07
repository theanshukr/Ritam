// RITAM Geospatial Environmental API Client

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';


// Get auth token from localStorage (set during login)
function getAuthToken() {
  return localStorage.getItem('ritam_token') || '';
}

function authHeaders(contentType = null) {
  const token = getAuthToken();
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

export const apiClient = {
  async login(email, password) {
    const body = new URLSearchParams({ username: email, password });
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Login failed (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    localStorage.setItem('ritam_token', data.access_token);
    return data;
  },

  logout() {
    localStorage.removeItem('ritam_token');
  },

  // Projects
  async getProjects() {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Project loading failed (${response.status}): ${errorText}`);
    }
    return await response.json();
  },

  async createProject(projectData) {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/`, {
        method: 'POST',
        headers: authHeaders('application/json'),
        body: JSON.stringify(projectData)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Failed to create project via API:', err);
      throw err;
    }
  },

  // Change Events & Monitoring
  async getChangeEvents(projectId = null) {
    try {
      const url = projectId ? `${API_BASE_URL}/monitoring/?project_id=${projectId}` : `${API_BASE_URL}/monitoring/`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('Backend API connection warning (getChangeEvents):', err.message);
      return null;
    }
  },

  async reviewChangeEvent(changeId, decision) {
    try {
      const response = await fetch(`${API_BASE_URL}/monitoring/${changeId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Failed to review change event:', err);
      throw err;
    }
  },

  // Field Verification & Tree Identity
  async recordTree(formData) {
    try {
      const response = await fetch(`${API_BASE_URL}/field/trees/record`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Failed to record tree via field API:', err);
      throw err;
    }
  },

  async verifyTree(tag) {
    try {
      const response = await fetch(`${API_BASE_URL}/field/trees/${tag}/verify`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Failed to verify tree:', err);
      throw err;
    }
  },

  // Compliance Matrix
  async getCompliance(projectId) {
    try {
      const response = await fetch(`${API_BASE_URL}/compliance/${projectId}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('Backend API connection warning (getCompliance):', err.message);
      return null;
    }
  },

  // Satellite Monitoring
  async searchSatelliteScenes(projectId, startDate, endDate, maxCloudCover = 20) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        max_cloud_cover: maxCloudCover,
      });
      const response = await fetch(`${API_BASE_URL}/satellite/${projectId}/scenes?${params}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('Backend API connection warning (searchSatelliteScenes):', err.message);
      return null;
    }
  },

  async getSatelliteNDVI(projectId, startDate, endDate, maxCloudCover = 20) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        max_cloud_cover: maxCloudCover,
      });
      const response = await fetch(`${API_BASE_URL}/satellite/${projectId}/ndvi?${params}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('Backend API connection warning (getSatelliteNDVI):', err.message);
      return null;
    }
  },

  async compareSatellitePeriods(projectId, baselineFrom, baselineTo, currentFrom, currentTo, maxCloudCover = 20) {
    try {
      const params = new URLSearchParams({
        baseline_date_from: baselineFrom,
        baseline_date_to: baselineTo,
        current_date_from: currentFrom,
        current_date_to: currentTo,
        max_cloud_cover: maxCloudCover,
      });
      const response = await fetch(`${API_BASE_URL}/satellite/${projectId}/compare?${params}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('Backend API connection warning (compareSatellitePeriods):', err.message);
      return null;
    }
  },

  async getSatelliteHistory(projectId) {
    try {
      const response = await fetch(`${API_BASE_URL}/satellite/${projectId}/history`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('Backend API connection warning (getSatelliteHistory):', err.message);
      return null;
    }
  },

  /**
   * Fetch Sentinel-2 NDVI visualization image with authentication.
   * 
   * Returns a BLOB URL that Leaflet can use as an ImageOverlay src.
   * The backend returns a real Sentinel-2 NDVI color-mapped PNG:
   * - Red/brown: Bare soil / water (NDVI < 0.2)
   * - Yellow: Sparse vegetation (NDVI 0.2-0.4)
   * - Green: Dense vegetation (NDVI > 0.4)
   * 
   * Also returns the bounding box of the project for correct geographic placement.
   */
  async fetchNdviOverlay(projectId, startDate, endDate, maxCloudCover = 20, width = 512, height = 512) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      max_cloud_cover: maxCloudCover,
      width,
      height,
    });
    const url = `${API_BASE_URL}/satellite/${projectId}/ndvi-overlay?${params}`;
    
    const response = await fetch(url, {
    headers: authHeaders()
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Sentinel-2 NDVI overlay failed (${response.status}): ${errorText}`);
    }
    
    // Convert response to blob and create a local URL
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    return blobUrl;
  },

  /**
   * Fetch Sentinel-2 True Color RGB image with authentication.
   * 
   * Returns a BLOB URL that Leaflet can use as an ImageOverlay src.
   * The backend returns a real Sentinel-2 true-color PNG:
   * - B04 (Red), B03 (Green), B02 (Blue)
   * - Cloud-filtered via max_cloud_cover parameter
   * 
   * Uses the project boundary for geographic clipping.
   */
  async fetchTrueColorOverlay(projectId, startDate, endDate, maxCloudCover = 20, width = 512, height = 512, options = {}) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      max_cloud_cover: maxCloudCover,
      width,
      height,
    });
    if (options.bounds) {
      params.set('west', options.bounds[0][1]);
      params.set('south', options.bounds[0][0]);
      params.set('east', options.bounds[1][1]);
      params.set('north', options.bounds[1][0]);
    }
    
    const url = `${API_BASE_URL}/satellite/${projectId}/true-color?${params}`;
    
    const response = await fetch(url, {
      headers: authHeaders(),
      signal: options.signal,
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Sentinel-2 true-color failed (${response.status}): ${errorText}`);
    }
    
    // Verify we got an image response, not JSON error
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image')) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Expected image response but got: ${contentType}. ${errorText}`);
    }
    
    // Convert response to blob and create a local URL
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    return { blobUrl, blob };
  },

  getProjectBounds(project) {
    if (!project?.boundary) return null;
    
    let coords = [];
    if (project.boundary.type === 'MultiPolygon' || project.boundary.type === 'Polygon') {
      // Extract from GeoJSON
      const extractCoords = (arr) => {
        if (arr.length > 0 && typeof arr[0] === 'number') {
          // [lng, lat]
          coords.push([arr[1], arr[0]]); // Leaflet wants [lat, lng]
        } else if (Array.isArray(arr)) {
          arr.forEach(extractCoords);
        }
      };
      extractCoords(project.boundary.coordinates);
    } else if (Array.isArray(project.boundary)) {
      coords = project.boundary;
    }

    if (coords.length < 3) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    for (const coord of coords) {
      const lat = coord[0];
      const lng = coord[1];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    
    const latPad = (maxLat - minLat) * 0.1;
    const lngPad = (maxLng - minLng) * 0.1;
    
    return [
      [minLat - latPad, minLng - lngPad],
      [maxLat + latPad, maxLng + lngPad]
    ];
  }
};
