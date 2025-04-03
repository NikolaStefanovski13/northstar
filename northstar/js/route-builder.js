// js/route-builder.js
// Core functionality for the route builder page

document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    let orderCount = 0;
    let totalRevenue = 0;
    let stops = [];
    let vehicles = [];
    
    // DOM Elements
    const routeForm = document.getElementById('routeForm');
    const vehicleOrdersContainer = document.getElementById('vehicleOrdersContainer');
    const addVehicleOrderBtn = document.getElementById('addVehicleOrderBtn');
    const emptyOrdersMessage = document.getElementById('emptyOrdersMessage');
    const routeTimeline = document.getElementById('routeTimeline');
    const emptyTimelineMessage = document.getElementById('emptyTimelineMessage');
    const optimizeRouteBtn = document.getElementById('optimizeRouteBtn');
    const routePreference = document.getElementById('routePreference');
    const driverSelect = document.getElementById('driverSelect');
    
    // Financial summary elements
    const totalRevenueElement = document.getElementById('totalRevenue');
    const revenuePerMileElement = document.getElementById('revenuePerMile');
    const totalVehiclesElement = document.getElementById('totalVehicles');
    const totalDistanceElement = document.getElementById('totalDistance');
    const totalStopsElement = document.getElementById('totalStops');
    const totalDurationElement = document.getElementById('totalDuration');
    
    // Results elements
    const routeResults = document.getElementById('routeResults');
    const shareLink = document.getElementById('shareLink');
    const copyLinkBtn = document.getElementById('copyLink');
    const routeDistance = document.getElementById('routeDistance');
    const routeTime = document.getElementById('routeTime');
    const routeVehicles = document.getElementById('routeVehicles');
    const routeExpires = document.getElementById('routeExpires');
    const summaryRevenue = document.getElementById('summaryRevenue');
    const summaryRevenuePerMile = document.getElementById('summaryRevenuePerMile');
    const summaryVehicleCount = document.getElementById('summaryVehicleCount');
    
    // Initialize map
    let map;
    let mapMarkers = [];
    let mapRoute = null;
    
    initMap();
    loadDrivers();
    
    // Add event listeners
    addVehicleOrderBtn.addEventListener('click', addVehicleOrder);
    optimizeRouteBtn.addEventListener('click', optimizeRoute);
    routeForm.addEventListener('submit', handleFormSubmit);
    copyLinkBtn.addEventListener('click', copyShareLink);
    
    // Initialize sortable for drag-and-drop reordering of vehicle orders
    new Sortable(vehicleOrdersContainer, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'bg-gray-50',
        onEnd: function() {
            renumberOrders();
            updateTimeline();
            updateMapRoute();
        }
    });
    
    /**
     * Initialize the map
     */
    function initMap() {
        // Create map
        map = L.map('map').setView([39.8283, -98.5795], 4); // Center on USA
        
        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Add geocoder control to map
        L.Control.geocoder({
            defaultMarkGeocode: false
        }).on('markgeocode', function(e) {
            if (mapRoute) {
                map.removeLayer(mapRoute);
                mapRoute = null;
            }
            map.setView(e.geocode.center, 13);
        }).addTo(map);
    }
    
    /**
     * Geocode an address to get coordinates
     */
    function geocodeAddress(address, callback) {
        // Use Leaflet Control Geocoder for address lookup
        const geocoder = L.Control.Geocoder.nominatim();
        
        geocoder.geocode(address, function(results) {
            if (results && results.length > 0) {
                const result = results[0];
                callback({
                    lat: result.center.lat,
                    lng: result.center.lng,
                    formatted: result.name
                });
            } else {
                alert('Address not found. Please try a different address.');
            }
        });
    }
    
    /**
     * Initialize the multiple pickup/delivery functionality for an order
     */
    function initializeMultipleLocations(orderCard) {
        const addPickupBtn = orderCard.querySelector('.add-pickup-btn');
        const addDeliveryBtn = orderCard.querySelector('.add-delivery-btn');
        const pickupLocations = orderCard.querySelector('.pickup-locations');
        const deliveryLocations = orderCard.querySelector('.delivery-locations');
        
        // Add event listeners for adding locations
        addPickupBtn.addEventListener('click', function() {
            addLocationItem(pickupLocations, 'pickup');
        });
        
        addDeliveryBtn.addEventListener('click', function() {
            addLocationItem(deliveryLocations, 'delivery');
        });
        
        // Add remove buttons to initial locations
        setupLocationRemoveButtons(pickupLocations.querySelector('.pickup-location-item'));
        setupLocationRemoveButtons(deliveryLocations.querySelector('.delivery-location-item'));
        
        // Setup geocoding for initial locations
        setupAddressGeocoding(pickupLocations.querySelector('.pickup-location'), orderCard);
        setupAddressGeocoding(deliveryLocations.querySelector('.delivery-location'), orderCard);
    }

    /**
     * Add a new location item (pickup or delivery)
     */
    function addLocationItem(container, type) {
        const template = document.getElementById('locationItemTemplate');
        const locationNode = document.importNode(template.content, true);
        const locationItem = locationNode.querySelector('.location-item');
        const locationInput = locationNode.querySelector('.location-input');
        
        // Set the correct class for the input
        locationInput.classList.add(type === 'pickup' ? 'pickup-location' : 'delivery-location');
        locationItem.classList.add(type === 'pickup' ? 'pickup-location-item' : 'delivery-location-item');
        
        // Setup remove button
        setupLocationRemoveButtons(locationItem);
        
        // Add to container
        container.appendChild(locationNode);
        
        // Setup geocoding
        const orderCard = container.closest('.order-card');
        setupAddressGeocoding(locationInput, orderCard);
        
        // Show remove button on the first location if we now have more than one
        const firstLocation = container.querySelector(type === 'pickup' ? '.pickup-location-item' : '.delivery-location-item');
        const removeBtn = firstLocation.querySelector('.remove-location-btn');
        if (container.querySelectorAll(type === 'pickup' ? '.pickup-location-item' : '.delivery-location-item').length > 1) {
            removeBtn.classList.remove('hidden');
        }
    }

    /**
     * Setup the remove button for a location item
     */
    function setupLocationRemoveButtons(locationItem) {
        const removeBtn = locationItem.querySelector('.remove-location-btn');
        
        removeBtn.addEventListener('click', function() {
            const container = locationItem.parentNode;
            locationItem.remove();
            
            // Hide remove button on the first location if we now have only one
            if (container.children.length === 1) {
                const firstLocation = container.children[0];
                const removeBtn = firstLocation.querySelector('.remove-location-btn');
                removeBtn.classList.add('hidden');
            }
            
            // Update the order summary and map
            const orderCard = container.closest('.order-card');
            updateOrderSummary(orderCard);
            updateTimeline();
            updateMapRoute();
        });
    }

    /**
     * Setup geocoding for an address input
     */
    function setupAddressGeocoding(input, orderCard) {
        input.addEventListener('blur', function() {
            if (input.value.trim()) {
                geocodeAddress(input.value, function(result) {
                    if (result) {
                        // Store geocoded data
                        input.dataset.lat = result.lat;
                        input.dataset.lng = result.lng;
                        input.dataset.formatted = result.formatted;
                        
                        // Update order summary
                        updateOrderSummary(orderCard);
                        updateTimeline();
                        updateMapRoute();
                    }
                });
            }
        });
    }
    
    /**
     * Add a new vehicle order to the form
     */
    function addVehicleOrder() {
        // Hide empty message
        emptyOrdersMessage.classList.add('hidden');
        
        // Create a new order from template
        const template = document.getElementById('vehicleOrderTemplate');
        const orderNode = document.importNode(template.content, true);
        
        // Set order number
        orderCount++;
        orderNode.querySelector('.order-number').textContent = `Order #${orderCount}`;
        
        // Add event listeners to the new order
        const orderCard = orderNode.querySelector('.order-card');
        const toggleBtn = orderNode.querySelector('.toggle-order-btn');
        const removeBtn = orderNode.querySelector('.remove-order-btn');
        const details = orderNode.querySelector('.order-details');
        const vehicleModelInput = orderNode.querySelector('.vehicle-model');
        const vehiclePriceInput = orderNode.querySelector('.vehicle-price');
        
        // Set data attributes for order identification
        orderCard.dataset.orderId = orderCount;
        
        // Setup toggle functionality
        toggleBtn.addEventListener('click', function() {
            details.classList.toggle('hidden');
            // Switch icon
            const svg = toggleBtn.querySelector('svg');
            if (details.classList.contains('hidden')) {
                svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />';
            } else {
                svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
            }
        });
        
        // Setup remove functionality
        removeBtn.addEventListener('click', function() {
            orderCard.remove();
            updateSummary();
            updateTimeline();
            
            // Show empty message if no orders left
            if (vehicleOrdersContainer.querySelectorAll('.order-card').length === 0) {
                emptyOrdersMessage.classList.remove('hidden');
            }
        });
        
        // Initialize multiple locations functionality
        initializeMultipleLocations(orderCard);
        
        // Update summary when vehicle info changes
        vehicleModelInput.addEventListener('input', function() {
            updateOrderSummary(orderCard);
        });
        
        vehiclePriceInput.addEventListener('input', function() {
            updateOrderSummary(orderCard);
            updateSummary();
        });
        
        // Add the new order to the container
        vehicleOrdersContainer.appendChild(orderCard);
        
        // Hide empty timeline message
        emptyTimelineMessage.classList.add('hidden');
    }
    
    /**
     * Update the summary text for a specific order
     */
    function updateOrderSummary(orderCard) {
        const vehicleModel = orderCard.querySelector('.vehicle-model').value;
        const price = orderCard.querySelector('.vehicle-price').value;
        const summary = orderCard.querySelector('.order-summary');
        
        if (vehicleModel && price) {
            summary.textContent = `${vehicleModel} - $${parseFloat(price).toFixed(2)}`;
        } else if (vehicleModel) {
            summary.textContent = vehicleModel;
        } else if (price) {
            summary.textContent = `$${parseFloat(price).toFixed(2)}`;
        } else {
            summary.textContent = 'New Order';
        }
    }
    
    /**
     * Renumber orders after reordering
     */
    function renumberOrders() {
        const orders = vehicleOrdersContainer.querySelectorAll('.order-card');
        orders.forEach((order, index) => {
            const orderNumber = index + 1;
            order.querySelector('.order-number').textContent = `Order #${orderNumber}`;
        });
    }
    
    /**
     * Update the financial summary and map
     */
    function updateSummary() {
        let totalRevenue = 0;
        let totalVehicles = 0;
        
        // Calculate totals from orders
        const orders = vehicleOrdersContainer.querySelectorAll('.order-card');
        orders.forEach(order => {
            const priceInput = order.querySelector('.vehicle-price');
            if (priceInput && priceInput.value) {
                totalRevenue += parseFloat(priceInput.value);
                totalVehicles++;
            }
        });
        
        // Get route distance from map (or placeholder)
        const distance = 100; // This would be replaced with actual distance from the map API
        
        // Update summary elements
        totalRevenueElement.textContent = `$${totalRevenue.toFixed(2)}`;
        totalVehiclesElement.textContent = totalVehicles;
        totalStopsElement.textContent = orders.length * 2; // Each order has pickup and delivery
        
        // Calculate revenue per mile
        if (distance > 0) {
            const revenuePerMile = totalRevenue / distance;
            revenuePerMileElement.textContent = `$${revenuePerMile.toFixed(2)}`;
            totalDistanceElement.textContent = `${distance} miles`;
        } else {
            revenuePerMileElement.textContent = '$0.00';
            totalDistanceElement.textContent = '0 miles';
        }
        
        // Estimated duration (placeholder)
        totalDurationElement.textContent = '0 min';
    }
    
    /**
     * Update the route timeline
     */
    function updateTimeline() {
        // Clear existing timeline
        while (routeTimeline.querySelector('.timeline-item')) {
            routeTimeline.querySelector('.timeline-item').remove();
        }
        
        const orders = vehicleOrdersContainer.querySelectorAll('.order-card');
        if (orders.length === 0) {
            emptyTimelineMessage.classList.remove('hidden');
            return;
        }
        
        emptyTimelineMessage.classList.add('hidden');
        
        // Create combined array of stops (pickup + delivery)
        let stopIndex = 1;
        orders.forEach(order => {
            const orderNumber = order.querySelector('.order-number').textContent.replace('Order #', '');
            const vehicleModel = order.querySelector('.vehicle-model').value || 'Vehicle';
            
            // Get all pickup locations
            const pickupInputs = order.querySelectorAll('.pickup-location');
            pickupInputs.forEach(input => {
                if (input.value) {
                    addTimelineStop(stopIndex++, 'pickup', input.value, vehicleModel, orderNumber);
                }
            });
            
            // Get all delivery locations
            const deliveryInputs = order.querySelectorAll('.delivery-location');
            deliveryInputs.forEach(input => {
                if (input.value) {
                    addTimelineStop(stopIndex++, 'delivery', input.value, vehicleModel, orderNumber);
                }
            });
        });
    }
    
    /**
     * Add a stop to the timeline
     */
    function addTimelineStop(index, type, address, vehicleModel, orderNumber) {
        const template = document.getElementById('routeStopTemplate');
        const stopNode = document.importNode(template.content, true);
        
        // Set stop data
        const badge = stopNode.querySelector('.stop-badge');
        const addressElement = stopNode.querySelector('.stop-address');
        const detailsElement = stopNode.querySelector('.stop-details');
        const sequenceElement = stopNode.querySelector('.stop-sequence');
        const googleLink = stopNode.querySelector('.google-maps-link');
        const appleLink = stopNode.querySelector('.apple-maps-link');
        
        // Set badge type (pickup/delivery)
        if (type === 'pickup') {
            badge.textContent = 'P';
            badge.classList.add('pickup-badge');
            detailsElement.textContent = `Pickup: ${vehicleModel}`;
        } else {
            badge.textContent = 'D';
            badge.classList.remove('pickup-badge');
            badge.classList.add('delivery-badge');
            detailsElement.textContent = `Delivery: ${vehicleModel}`;
        }
        
        addressElement.textContent = address;
        sequenceElement.textContent = `Stop #${index}`;
        
        // Set map links
        const encodedAddress = encodeURIComponent(address);
        googleLink.href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        appleLink.href = `https://maps.apple.com/?q=${encodedAddress}`;
        
        // Add move up/down functionality
        const moveUpBtn = stopNode.querySelector('.move-up-btn');
        const moveDownBtn = stopNode.querySelector('.move-down-btn');
        
        moveUpBtn.addEventListener('click', function() {
            // Implementation would be added here if needed
            // For now, we'll use drag and drop for reordering
        });
        
        moveDownBtn.addEventListener('click', function() {
            // Implementation would be added here if needed
            // For now, we'll use drag and drop for reordering
        });
        
        // Add to timeline
        routeTimeline.appendChild(stopNode);
    }
    
    /**
     * Update the route on the map
     */
    function updateMapRoute() {
        // Clear existing markers and route
        mapMarkers.forEach(marker => map.removeLayer(marker));
        mapMarkers = [];
        
        if (mapRoute) {
            map.removeLayer(mapRoute);
            mapRoute = null;
        }
        
        // Collect all addresses with coordinates
        const stops = [];
        const orders = vehicleOrdersContainer.querySelectorAll('.order-card');
        
        orders.forEach(order => {
            const vehicleModel = order.querySelector('.vehicle-model').value || 'Vehicle';
            
            // Get all pickup locations
            const pickupInputs = order.querySelectorAll('.pickup-location');
            pickupInputs.forEach(input => {
                if (input.dataset.lat && input.dataset.lng) {
                    stops.push({
                        type: 'pickup',
                        lat: parseFloat(input.dataset.lat),
                        lng: parseFloat(input.dataset.lng),
                        address: input.value,
                        vehicle: vehicleModel
                    });
                }
            });
            
            // Get all delivery locations
            const deliveryInputs = order.querySelectorAll('.delivery-location');
            deliveryInputs.forEach(input => {
                if (input.dataset.lat && input.dataset.lng) {
                    stops.push({
                        type: 'delivery',
                        lat: parseFloat(input.dataset.lat),
                        lng: parseFloat(input.dataset.lng),
                        address: input.value,
                        vehicle: vehicleModel
                    });
                }
            });
        });
        
        if (stops.length < 2) {
            return; // Need at least two stops for a route
        }
        
        // Add markers for each stop
        stops.forEach(stop => {
            const icon = L.divIcon({
                className: 'stop-marker-icon',
                html: `<div class="stop-badge ${stop.type === 'pickup' ? 'pickup-badge' : 'delivery-badge'}">${stop.type === 'pickup' ? 'P' : 'D'}</div>`,
                iconSize: [22, 22]
            });
            
            const marker = L.marker([stop.lat, stop.lng], { icon: icon }).addTo(map);
            marker.bindPopup(`<b>${stop.type === 'pickup' ? 'Pickup' : 'Delivery'}</b><br>${stop.vehicle}<br>${stop.address}`);
            mapMarkers.push(marker);
        });
        
        // Fit map to markers
        if (mapMarkers.length > 0) {
            const group = new L.featureGroup(mapMarkers);
            map.fitBounds(group.getBounds().pad(0.1));
        }
        
        // Create a simple polyline for now
        // In a production app, you would use a routing API
        const points = stops.map(stop => [stop.lat, stop.lng]);
        mapRoute = L.polyline(points, { color: '#2563eb', weight: 4 }).addTo(map);
        
        // Update distance calculation
        // This is a placeholder; in a real app you'd get actual distance from a routing API
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
            const from = L.latLng(points[i-1][0], points[i-1][1]);
            const to = L.latLng(points[i][0], points[i][1]);
            totalDistance += from.distanceTo(to);
        }
        
        // Convert meters to miles
        const distanceMiles = (totalDistance / 1609.34).toFixed(2);
        totalDistanceElement.textContent = `${distanceMiles} miles`;
        
        // Update revenue per mile
        const revenue = parseFloat(totalRevenueElement.textContent.replace('$', ''));
        if (distanceMiles > 0) {
            const revenuePerMile = revenue / distanceMiles;
            revenuePerMileElement.textContent = `$${revenuePerMile.toFixed(2)}`;
        }
        
        // Estimate duration (rough calculation)
        const durationMinutes = Math.round(distanceMiles * 1.5); // Assuming average speed
        totalDurationElement.textContent = `${durationMinutes} min`;
    }
    
    /**
     * Optimize the route order
     */
    function optimizeRoute() {
        const preference = routePreference.value;
        
        // Get all orders
        const orders = Array.from(vehicleOrdersContainer.querySelectorAll('.order-card'));
        
        if (orders.length <= 1) {
            return; // Nothing to optimize
        }
        
        switch (preference) {
            case 'pickupFirst':
                // Reorder to do all pickups first, then deliveries
                // Placeholder implementation
                break;
                
            case 'deliveryFirst':
                // Reorder to do all deliveries first, then pickups
                // Placeholder implementation
                break;
                
            case 'efficient':
                // For now, just simulate optimization with a delay
                // In a real app, you would use a proper algorithm
                optimizeRouteBtn.disabled = true;
                optimizeRouteBtn.innerHTML = '<svg class="animate-spin h-4 w-4 mr-1 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Optimizing...';
                
                setTimeout(() => {
                    // Shuffle the orders for demo purposes
                    for (let i = orders.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        vehicleOrdersContainer.insertBefore(orders[j], orders[i]);
                    }
                    
                    renumberOrders();
                    updateTimeline();
                    updateMapRoute();
                    
                    optimizeRouteBtn.disabled = false;
                    optimizeRouteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> Optimize Route';
                }, 1000);
                break;
                
            case 'custom':
                // Do nothing - let the user arrange manually
                break;
        }
    }
    
    /**
     * Load drivers from the database
     */
    function loadDrivers() {
        // In a real app, you would fetch this from the server
        // For now, we'll add some sample drivers
        const sampleDrivers = [
            { id: 1, name: 'John Smith' },
            { id: 2, name: 'Dave Johnson' },
            { id: 3, name: 'Sarah Williams' }
        ];
        
        // Clear existing options (except the default one)
        while (driverSelect.options.length > 1) {
            driverSelect.remove(1);
        }
        
        // Add drivers to select
        sampleDrivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.id;
            option.textContent = driver.name;
            driverSelect.appendChild(option);
        });
    }
    
    /**
     * Handle form submission
     */
    function handleFormSubmit(event) {
        event.preventDefault();
        
        // Validate form
        const routeName = document.getElementById('routeName').value.trim();
        if (!routeName) {
            alert('Please enter a route name');
            return;
        }
        
        const orders = vehicleOrdersContainer.querySelectorAll('.order-card');
        if (orders.length === 0) {
            alert('Please add at least one vehicle order');
            return;
        }
        
        // In a real app, you would submit this to the server
        // For now, we'll simulate success
        
        // Display results
        showRouteResults();
    }
    
    /**
     * Show route creation results
     */
    function showRouteResults() {
        // Generate a fake share token
        const token = Math.random().toString(36).substring(2, 12);
        const shareUrl = `${window.location.origin}/driver-view.html?token=${token}`;
        
        // Set result values
        shareLink.value = shareUrl;
        
        // Route details
        routeDistance.textContent = totalDistanceElement.textContent;
        routeTime.textContent = totalDurationElement.textContent;
        routeVehicles.textContent = totalVehiclesElement.textContent;
        
        // Calculate expiration (24 hours from now)
        const now = new Date();
        const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        routeExpires.textContent = expires.toLocaleString();
        
        // Financial summary
        summaryRevenue.textContent = totalRevenueElement.textContent;
        summaryRevenuePerMile.textContent = revenuePerMileElement.textContent + '/mile';
        summaryVehicleCount.textContent = totalVehiclesElement.textContent;
        
        // Show results
        routeResults.classList.remove('hidden');
        routeForm.classList.add('hidden');
        
        // Scroll to results
        routeResults.scrollIntoView({ behavior: 'smooth' });
    }
    
    /**
     * Copy share link to clipboard
     */
    function copyShareLink() {
        shareLink.select();
        document.execCommand('copy');
        
        // Show copied notification
        copyLinkBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy Link';
        }, 2000);
    }
});