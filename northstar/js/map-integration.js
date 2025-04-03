// js/map-integration.js
// Map integration functions for NorthStar

/**
 * Initialize a Leaflet map in the specified container
 * @param {string} containerId - The ID of the map container element
 * @param {Array} center - [latitude, longitude] for the initial map center
 * @param {number} zoom - Initial zoom level
 * @returns {Object} Leaflet map object
 */
function initializeMap(containerId, center = [39.8283, -98.5795], zoom = 4) {
    // Create map instance
    const map = L.map(containerId).setView(center, zoom);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    return map;
}

/**
 * Add a marker to the map
 * @param {Object} map - Leaflet map object
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Marker options
 * @returns {Object} Leaflet marker object
 */
function addMapMarker(map, lat, lng, options = {}) {
    const marker = L.marker([lat, lng], options).addTo(map);
    
    if (options.popup) {
        marker.bindPopup(options.popup);
    }
    
    return marker;
}

/**
 * Create a polyline route between coordinates
 * @param {Object} map - Leaflet map object
 * @param {Array} coordinates - Array of [lat, lng] coordinate pairs
 * @param {Object} options - Polyline options
 * @returns {Object} Leaflet polyline object
 */
function createMapRoute(map, coordinates, options = {}) {
    const defaultOptions = {
        color: '#2563eb',
        weight: 4,
        opacity: 0.7
    };
    
    const routeOptions = { ...defaultOptions, ...options };
    const polyline = L.polyline(coordinates, routeOptions).addTo(map);
    
    return polyline;
}

/**
 * Fit the map view to contain all markers
 * @param {Object} map - Leaflet map object
 * @param {Array} markers - Array of Leaflet marker objects
 * @param {number} padding - Padding to add around the bounds (0-1)
 */
function fitMapToMarkers(map, markers, padding = 0.1) {
    if (markers.length === 0) return;
    
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(padding));
}