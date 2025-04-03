// js/api-service.js
// Lightweight service to handle API communications

const ApiService = {
    // Make a GET request
    async get(endpoint, params = {}) {
        const url = new URL(`./php/${endpoint}`, window.location.origin);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            alert(error.message || 'Network error. Please try again.');
            throw error;
        }
    },

    // Make a POST request
    async post(endpoint, data = {}, params = {}) {
        const url = new URL(`./php/${endpoint}`, window.location.origin);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            alert(error.message || 'Network error. Please try again.');
            throw error;
        }
    },

    // Route endpoints
    Routes: {
        // Create a new route
        create(routeData) {
            return ApiService.post('routes.php', routeData, { action: 'create' });
        },

        // Get a route by ID
        getById(id) {
            return ApiService.get('routes.php', { action: 'get', id });
        },

        // Get a route by share token
        getByToken(token) {
            return ApiService.get('share.php', { action: 'getByToken', token });
        },

        // List all routes with optional filtering
        list(status = 'all', search = '') {
            return ApiService.get('routes.php', { action: 'list', status, search });
        },

        // Update an existing route
        update(routeData) {
            return ApiService.post('routes.php', routeData, { action: 'update' });
        },

        // Delete a route
        delete(id) {
            return ApiService.get('routes.php', { action: 'delete', id });
        },

        // Resend a route share link
        resendLink(id) {
            return ApiService.post('share.php', {}, { action: 'resend', id });
        }
    },

    // Driver endpoints
    Drivers: {
        // Create a new driver
        create(driverData) {
            return ApiService.post('drivers.php', driverData, { action: 'create' });
        },

        // Get a driver by ID
        getById(id) {
            return ApiService.get('drivers.php', { action: 'get', id });
        },

        // List all drivers with optional search
        list(search = '') {
            return ApiService.get('drivers.php', { action: 'list', search });
        },

        // Update an existing driver
        update(driverData) {
            return ApiService.post('drivers.php', driverData, { action: 'update' });
        },

        // Delete a driver
        delete(id) {
            return ApiService.get('drivers.php', { action: 'delete', id });
        }
    }
};

// Export for use in other scripts
window.ApiService = ApiService;