// Geocoding Service Abstraction
// Uses OpenStreetMap Nominatim for open geocoding.

export const GeocodingService = {
  /**
   * Search for a place by name.
   * @param {string} query 
   * @returns {Promise<Array>} Array of results with { displayName, lat, lon, boundingbox }
   */
  async search(query) {
    if (!query || query.trim() === '') return [];
    
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: 5,
        addressdetails: 1
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          // Nominatim requires a user agent or identifying referer, but browser fetch will send Origin.
        }
      });
      
      if (!response.ok) {
        console.error('Geocoding request failed:', response.status);
        return [];
      }
      
      const data = await response.json();
      return data.map(item => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        boundingbox: item.boundingbox, // [southLat, northLat, westLon, eastLon]
        provider: 'nominatim',
        raw: item
      }));
    } catch (err) {
      console.error('Geocoding search error:', err);
      return [];
    }
  },

  /**
   * Reverse geocode a latitude and longitude.
   */
  async reverse(lat, lon) {
    try {
      const params = new URLSearchParams({
        lat,
        lon,
        format: 'json',
        addressdetails: 1
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      if (data.error) return null;
      
      return {
        displayName: data.display_name,
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon),
        provider: 'nominatim',
        raw: data
      };
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      return null;
    }
  }
};
