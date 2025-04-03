// js/map-integration.js
// Enhanced map integration with geocoding and autocompletion

/**
 * Initialize a map and configure geocoding
 * @param {string} mapElementId - The ID of the map container
 * @param {Array} defaultCenter - Default center coordinates [lat, lng]
 * @param {number} defaultZoom - Default zoom level
 * @returns {Object} Map object
 */
function initializeMap(mapElementId, defaultCenter = [39.8283, -98.5795], defaultZoom = 4) {
    // Create map
    const map = L.map(mapElementId).setView(defaultCenter, defaultZoom);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add Nominatim geocoder control
    if (L.Control.Geocoder) {
        const geocoder = L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: 'Search for address...',
            errorMessage: 'Address not found',
            showResultIcons: true,
            suggestMinLength: 3,
            suggestTimeout: 250,
            collapsed: false
        }).on('markgeocode', function(e) {
            // Center map on geocoded location
            map.setView(e.geocode.center, 13);
        }).addTo(map);
    }
    
    return map;
}

/**
 * Add an autocomplete feature to an address input field
 * @param {HTMLElement} inputElement - The input element to enhance
 * @param {Function} onSelectCallback - Callback function when an address is selected
 */
function addAddressAutocomplete(inputElement, onSelectCallback) {
    if (!inputElement) return;
    
    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'address-autocomplete-results absolute z-10 bg-white shadow-md rounded-md w-full mt-1 border border-gray-200 max-h-60 overflow-y-auto hidden';
    inputElement.parentNode.style.position = 'relative';
    inputElement.parentNode.appendChild(resultsContainer);
    
    // Setup debounce function for search
    let debounceTimer;
    
    // Add input event listener
    inputElement.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        
        // Clear results if input is empty
        if (inputElement.value.trim() === '') {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
            return;
        }
        
        // Debounce search to avoid too many requests
        debounceTimer = setTimeout(function() {
            const query = inputElement.value.trim();
            if (query.length < 3) return; // Only search if at least 3 characters
            
            // Show loading indicator
            resultsContainer.innerHTML = '<div class="p-2 text-gray-500 text-sm">Searching...</div>';
            resultsContainer.classList.remove('hidden');
            
            // Use Nominatim for geocoding
            const geocoder = L.Control.Geocoder.nominatim();
            geocoder.geocode(query, function(results) {
                if (results && results.length > 0) {
                    resultsContainer.innerHTML = '';
                    
                    // Add results to dropdown
                    results.slice(0, 5).forEach(result => {
                        const item = document.createElement('div');
                        item.className = 'p-2 cursor-pointer hover:bg-gray-100 text-sm';
                        item.textContent = result.name;
                        
                        item.addEventListener('click', function() {
                            inputElement.value = result.name;
                            
                            // Store geocoded data in the input element's dataset
                            inputElement.dataset.lat = result.center.lat;
                            inputElement.dataset.lng = result.center.lng;
                            inputElement.dataset.formatted = result.name;
                            
                            // Hide results
                            resultsContainer.classList.add('hidden');
                            
                            // Call callback if provided
                            if (typeof onSelectCallback === 'function') {
                                onSelectCallback({
                                    address: result.name,
                                    lat: result.center.lat,
                                    lng: result.center.lng
                                });
                            }
                        });
                        
                        resultsContainer.appendChild(item);
                    });
                } else {
                    resultsContainer.innerHTML = '<div class="p-2 text-gray-500 text-sm">No results found</div>';
                }
            });
        }, 300);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!inputElement.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.add('hidden');
        }
    });
    
    // Handle keyboard navigation
    inputElement.addEventListener('keydown', function(e) {
        const items = resultsContainer.querySelectorAll('.cursor-pointer');
        let focusedIndex = -1;
        
        // Find currently focused item
        for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains('bg-gray-100')) {
                focusedIndex = i;
                break;
            }
        }
        
        // Handle arrow keys
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (focusedIndex < items.length - 1) {
                if (focusedIndex >= 0) items[focusedIndex].classList.remove('bg-gray-100');
                items[focusedIndex + 1].classList.add('bg-gray-100');
                items[focusedIndex + 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (focusedIndex > 0) {
                items[focusedIndex].classList.remove('bg-gray-100');
                items[focusedIndex - 1].classList.add('bg-gray-100');
                items[focusedIndex - 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
            e.preventDefault();
            items[focusedIndex].click();
        } else if (e.key === 'Escape') {
            resultsContainer.classList.add('hidden');
        }
    });
}

/**
 * Geocode an address using Nominatim
 * @param {string} address - The address to geocode
 * @returns {Promise} Promise resolving to geocoded result
 */
function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        if (!address || address.trim() === '') {
            reject(new Error('Address is required'));
            return;
        }
        
        const geocoder = L.Control.Geocoder.nominatim();
        
        geocoder.geocode(address, function(results) {
            if (results && results.length > 0) {
                const result = results[0];
                resolve({
                    address: result.name,
                    lat: result.center.lat,
                    lng: result.center.lng,
                    bounds: result.bbox
                });
            } else {
                reject(new Error('Address not found'));
            }
        });
    });
}

/**
 * Create a route between multiple stops on a map
 * @param {Object} map - Leaflet map instance
 * @param {Array} stops - Array of stop objects with lat/lng coordinates
 * @param {Object} options - Options for route display
 * @returns {Object} Route information including polyline, markers, distance and duration
 */
function createRoute(map, stops, options = {}) {
    if (!map || !stops || stops.length < 2) {
        console.error('Map and at least 2 stops are required');
        return null;
    }
    
    // Clear existing route elements if provided
    if (options.clearExisting) {
        if (options.existingMarkers) {
            options.existingMarkers.forEach(marker => marker.remove());
        }
        if (options.existingRoute) {
            options.existingRoute.remove();
        }
    }
    
    // Create markers for each stop
    const markers = stops.map((stop, index) => {
        // Create custom icon based on stop type
        const html = `<div class="stop-badge ${stop.type === 'pickup' ? 'pickup-badge' : 'delivery-badge'}">${stop.type === 'pickup' ? 'P' : 'D'}</div>`;
        const icon = L.divIcon({
            className: 'stop-marker-icon',
            html: html,
            iconSize: [22, 22]
        });
        
        // Create marker
        const marker = L.marker([stop.lat, stop.lng], { icon: icon }).addTo(map);
        
        // Add popup
        let popupContent = `<b>${stop.type === 'pickup' ? 'Pickup' : 'Delivery'}</b>`;
        if (stop.vehicle) popupContent += `<br>${stop.vehicle}`;
        if (stop.address) popupContent += `<br>${stop.address}`;
        marker.bindPopup(popupContent);
        
        return marker;
    });
    
    // Create route line
    const points = stops.map(stop => [stop.lat, stop.lng]);
    const route = L.polyline(points, { 
        color: options.color || '#2563eb', 
        weight: options.weight || 4,
        opacity: options.opacity || 0.7,
        dashArray: options.dashArray || null
    }).addTo(map);
    
    // Calculate distance (in meters)
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        const from = L.latLng(points[i-1][0], points[i-1][1]);
        const to = L.latLng(points[i][0], points[i][1]);
        totalDistance += from.distanceTo(to);
    }
    
    // Convert to miles
    const distanceMiles = totalDistance / 1609.34;
    
    // Estimate duration (naive calculation - 45mph average speed for car carriers)
    const durationMinutes = Math.round(distanceMiles * (60 / 45));
    
    // Fit map to show all markers
    if (options.fitBounds !== false) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    return {
        route: route,
        markers: markers,
        distance: distanceMiles,
        duration: durationMinutes,
        points: points
    };
}

// Export the functions for use in other scripts
window.MapIntegration = {
    initializeMap,
    addAddressAutocomplete,
    geocodeAddress,
    createRoute
};