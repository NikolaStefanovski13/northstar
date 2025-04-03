// js/driver-view.js
// Functionality for the driver route view page

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const routeLoading = document.getElementById('routeLoading');
    const routeContent = document.getElementById('routeContent');
    const routeError = document.getElementById('routeError');
    const routeName = document.getElementById('routeName');
    const routeDetails = document.getElementById('routeDetails');
    const driverName = document.getElementById('driverName');
    const totalStops = document.getElementById('totalStops');
    const totalDistance = document.getElementById('totalDistance');
    const totalDuration = document.getElementById('totalDuration');
    const totalVehicles = document.getElementById('totalVehicles');
    const totalRevenue = document.getElementById('totalRevenue');
    const revenuePerMile = document.getElementById('revenuePerMile');
    const routeExpiry = document.getElementById('routeExpiry');
    const driverNotes = document.getElementById('driverNotes');
    const vehiclesList = document.getElementById('vehiclesList');
    const routeTimeline = document.getElementById('routeTimeline');
    const printRouteBtn = document.getElementById('printRouteBtn');
    
    // Initialize map
    let map;
    let mapMarkers = [];
    let mapRoute = null;
    
    // Get route token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const routeToken = urlParams.get('token');
    
    if (!routeToken) {
        showError('No route token provided');
        return;
    }
    
    // Initialize map
    initMap();
    
    // Load route data
    loadRouteData(routeToken);
    
    // Add event listeners
    printRouteBtn.addEventListener('click', printRoute);
    
    /**
     * Initialize the map
     */
    function initMap() {
        // Create map instance
        map = L.map('map').setView([39.8283, -98.5795], 4); // Center on USA
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    }
    
    /**
     * Load route data from server
     */
    function loadRouteData(token) {
        // In a real app, you would fetch this from the server
        // For now, we'll simulate it with sample data
        
        // Simulate API request delay
        setTimeout(() => {
            // Sample route data
            const routeData = getSampleRouteData(token);
            
            if (!routeData) {
                showError('Route not found or has expired');
                return;
            }
            
            displayRouteData(routeData);
        }, 1000);
    }
    
    /**
     * Display route data in the UI
     */
    function displayRouteData(data) {
        // Set basic route information
        routeName.textContent = data.name;
        routeDetails.textContent = `Created on ${new Date(data.created_at).toLocaleDateString()} • ${data.stops.length} stops`;
        driverName.textContent = data.driver_name || 'Not Assigned';
        totalStops.textContent = data.stops.length;
        totalDistance.textContent = `${data.total_distance} miles`;
        totalDuration.textContent = `${data.total_duration} min`;
        totalVehicles.textContent = data.vehicles.length;
        totalRevenue.textContent = `$${data.total_revenue.toFixed(2)}`;
        
        // Calculate revenue per mile
        const rpmValue = data.total_distance > 0 ? data.total_revenue / data.total_distance : 0;
        revenuePerMile.textContent = `$${rpmValue.toFixed(2)}`;
        
        // Set expiry date
        const expiryDate = new Date(data.expiration);
        routeExpiry.textContent = expiryDate.toLocaleString();
        
        // Set driver notes
        if (data.notes) {
            driverNotes.textContent = data.notes;
        }
        
        // Display vehicles
        displayVehicles(data.vehicles);
        
        // Display timeline
        displayTimeline(data.stops);
        
        // Display route on map
        displayRouteOnMap(data.stops);
        
        // Hide loading, show content
        routeLoading.classList.add('hidden');
        routeContent.classList.remove('hidden');
    }
    
    /**
     * Display vehicles in the vehicles list
     */
    function displayVehicles(vehicles) {
        // Clear existing vehicles
        vehiclesList.innerHTML = '';
        
        // Add vehicle cards
        vehicles.forEach(vehicle => {
            const template = document.getElementById('vehicleCardTemplate');
            const vehicleNode = document.importNode(template.content, true);
            
            // Set vehicle data
            vehicleNode.querySelector('.vehicle-model').textContent = vehicle.model;
            vehicleNode.querySelector('.vehicle-type').textContent = vehicle.type;
            vehicleNode.querySelector('.vehicle-price').textContent = `$${vehicle.price.toFixed(2)}`;
            
            // Set pickup locations
            const pickupLocationsElement = vehicleNode.querySelector('.pickup-locations');
            if (vehicle.pickups && vehicle.pickups.length > 0) {
                pickupLocationsElement.innerHTML = 'Pickup: ';
                vehicle.pickups.forEach((pickup, index) => {
                    pickupLocationsElement.innerHTML += pickup;
                    if (index < vehicle.pickups.length - 1) {
                        pickupLocationsElement.innerHTML += '<br><span class="ml-6">';
                    }
                });
            } else {
                pickupLocationsElement.innerHTML = 'Pickup: Not specified';
            }
            
            // Set delivery locations
            const deliveryLocationsElement = vehicleNode.querySelector('.delivery-locations');
            if (vehicle.deliveries && vehicle.deliveries.length > 0) {
                deliveryLocationsElement.innerHTML = 'Delivery: ';
                vehicle.deliveries.forEach((delivery, index) => {
                    deliveryLocationsElement.innerHTML += delivery;
                    if (index < vehicle.deliveries.length - 1) {
                        deliveryLocationsElement.innerHTML += '<br><span class="ml-6">';
                    }
                });
            } else {
                deliveryLocationsElement.innerHTML = 'Delivery: Not specified';
            }
            
            // Set notes
            const notesElement = vehicleNode.querySelector('.vehicle-notes');
            if (vehicle.notes) {
                notesElement.textContent = vehicle.notes;
            } else {
                notesElement.classList.add('hidden');
            }
            
            // Add to vehicles list
            vehiclesList.appendChild(vehicleNode);
        });
    }
    
    /**
     * Display timeline stops
     */
    function displayTimeline(stops) {
        // Clear existing timeline
        while (routeTimeline.querySelector('.timeline-item')) {
            routeTimeline.querySelector('.timeline-item').remove();
        }
        
        // Add stops to timeline
        stops.forEach((stop, index) => {
            const template = document.getElementById('timelineStopTemplate');
            const stopNode = document.importNode(template.content, true);
            
            // Set stop data
            const badge = stopNode.querySelector('.stop-badge');
            const addressElement = stopNode.querySelector('.stop-address');
            const detailsElement = stopNode.querySelector('.stop-details');
            const sequenceElement = stopNode.querySelector('.stop-sequence');
            const googleLink = stopNode.querySelector('.google-map-link');
            const appleLink = stopNode.querySelector('.apple-map-link');
            
            // Set badge type (pickup/delivery)
            if (stop.type === 'pickup') {
                badge.textContent = 'P';
                badge.classList.add('pickup-badge');
                detailsElement.textContent = `Pickup: ${stop.vehicle}`;
            } else {
                badge.textContent = 'D';
                badge.classList.remove('pickup-badge');
                badge.classList.add('delivery-badge');
                detailsElement.textContent = `Delivery: ${stop.vehicle}`;
            }
            
            addressElement.textContent = stop.address;
            sequenceElement.textContent = `Stop #${index + 1}`;
            
            // Set map links
            const encodedAddress = encodeURIComponent(stop.address);
            googleLink.href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
            appleLink.href = `https://maps.apple.com/?q=${encodedAddress}`;
            
            // Add to timeline
            routeTimeline.appendChild(stopNode);
        });
    }
    
    /**
     * Display the route on the map
     */
    function displayRouteOnMap(stops) {
        // Clear existing markers and route
        mapMarkers.forEach(marker => map.removeLayer(marker));
        mapMarkers = [];
        
        if (mapRoute) {
            map.removeLayer(mapRoute);
            mapRoute = null;
        }
        
        if (stops.length === 0) {
            return;
        }
        
        // Add markers for each stop
        stops.forEach((stop, index) => {
            const icon = L.divIcon({
                className: 'stop-marker-icon',
                html: `<div class="stop-badge ${stop.type === 'pickup' ? 'pickup-badge' : 'delivery-badge'}">${index + 1}</div>`,
                iconSize: [22, 22]
            });
            
            const marker = L.marker([stop.latitude, stop.longitude], { icon: icon }).addTo(map);
            marker.bindPopup(`<b>Stop #${index + 1}: ${stop.type === 'pickup' ? 'Pickup' : 'Delivery'}</b><br>${stop.vehicle}<br>${stop.address}`);
            mapMarkers.push(marker);
        });
        
        // Create a polyline for the route
        const points = stops.map(stop => [stop.latitude, stop.longitude]);
        mapRoute = L.polyline(points, { color: '#2563eb', weight: 4 }).addTo(map);
        
        // Fit map to markers
        if (mapMarkers.length > 0) {
            const group = new L.featureGroup(mapMarkers);
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        routeLoading.classList.add('hidden');
        routeError.classList.remove('hidden');
        
        // Set error message
        const errorMessage = routeError.querySelector('p');
        errorMessage.textContent = message;
    }
    
    /**
     * Print the route
     */
    function printRoute() {
        window.print();
    }
    
    /**
     * Get sample route data (for demo purposes)
     * In a real app, this would come from the server
     */
    function getSampleRouteData(token) {
        // This is a placeholder function to simulate server data
        // In a real app, you would fetch this from your backend
        
        return {
            id: 1,
            name: "Chicago to Detroit Route",
            driver_name: "John Smith",
            total_distance: 283.5,
            total_duration: 285,
            total_revenue: 2850.00,
            created_at: "2025-04-03T08:00:00",
            expiration: "2025-04-04T08:00:00",
            share_token: token,
            notes: "Call dispatch if you encounter any issues. Remember to check in at the security gate at stop #3.",
            vehicles: [
                {
                    id: 1,
                    model: "2022 Honda Accord",
                    type: "Sedan",
                    price: 750.00,
                    pickups: ["123 Main St, Chicago, IL"],
                    deliveries: ["456 Woodward Ave, Detroit, MI"],
                    notes: "Customer requested extra care, vehicle has aftermarket rims."
                },
                {
                    id: 2,
                    model: "2023 Ford F-150",
                    type: "Truck",
                    price: 1200.00,
                    pickups: ["789 State St, Chicago, IL", "555 Washington Blvd, Indianapolis, IN"],
                    deliveries: ["987 Jefferson Ave, Detroit, MI"],
                    notes: ""
                },
                {
                    id: 3,
                    model: "2023 Tesla Model Y",
                    type: "SUV",
                    price: 900.00,
                    pickups: ["321 Michigan Ave, Chicago, IL"],
                    deliveries: ["654 Gratiot Ave, Detroit, MI"],
                    notes: "Electric vehicle, ensure proper handling."
                }
            ],
            stops: [
                {
                    id: 1,
                    type: "pickup",
                    address: "123 Main St, Chicago, IL",
                    latitude: 41.878113,
                    longitude: -87.629799,
                    vehicle: "2022 Honda Accord",
                    order_id: 1
                },
                {
                    id: 2,
                    type: "pickup",
                    address: "789 State St, Chicago, IL",
                    latitude: 41.882514,
                    longitude: -87.627760,
                    vehicle: "2023 Ford F-150",
                    order_id: 2
                },
                {
                    id: 3,
                    type: "pickup",
                    address: "321 Michigan Ave, Chicago, IL",
                    latitude: 41.886065,
                    longitude: -87.624088,
                    vehicle: "2023 Tesla Model Y",
                    order_id: 3
                },
                {
                    id: 4,
                    type: "pickup",
                    address: "555 Washington Blvd, Indianapolis, IN",
                    latitude: 39.768403,
                    longitude: -86.158068,
                    vehicle: "2023 Ford F-150 (Second Pickup)",
                    order_id: 2
                },
                {
                    id: 5,
                    type: "delivery",
                    address: "456 Woodward Ave, Detroit, MI",
                    latitude: 42.331427,
                    longitude: -83.045754,
                    vehicle: "2022 Honda Accord",
                    order_id: 1
                },
                {
                    id: 6,
                    type: "delivery",
                    address: "987 Jefferson Ave, Detroit, MI",
                    latitude: 42.336490,
                    longitude: -83.052670,
                    vehicle: "2023 Ford F-150",
                    order_id: 2
                },
                {
                    id: 7,
                    type: "delivery",
                    address: "654 Gratiot Ave, Detroit, MI",
                    latitude: 42.346677,
                    longitude: -83.040912,
                    vehicle: "2023 Tesla Model Y",
                    order_id: 3
                }
            ]
        };
    }
});