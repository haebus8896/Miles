const Tenant = require('../models/Tenant');

const tenantMiddleware = async (req, res, next) => {
    // 1. Try to get tenant from Header
    let tenantId = req.headers['x-tenant-id'];

    // 2. Ideally also infer from subdomain, but for API it's usually header or token

    if (!tenantId) {
        // If authenticated, the user token will have tenant_id
        if (req.user && req.user.tenant_id) {
            tenantId = req.user.tenant_id;
        }
    }

    if (!tenantId) {
        // For public endpoints or login, we might skip this validation 
        // or return 400 if it's a tenant-specific route.
        // For now, if we cannot determine tenant, we continue but req.tenant is null.
        // Specific routes must enforce req.tenant existence.
        return next();
    }

    try {
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        if (tenant.status !== 'active') {
            return res.status(403).json({ error: 'Tenant is not active' });
        }

        req.tenant = tenant;
        next();
    } catch (error) {
        console.error('Tenant Middleware Error:', error);
        res.status(500).json({ error: 'Server Error verifying tenant' });
    }
};

module.exports = tenantMiddleware;
