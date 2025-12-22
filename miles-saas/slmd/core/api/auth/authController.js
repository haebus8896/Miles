const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    const { name, email, password, tenant_slug } = req.body;

    // 1. Find Tenant (or create if "super admin" flow - ignoring for now)
    // For now, we assume tenant exists or we auto-create for demo
    let tenant = await Tenant.findOne({ slug: tenant_slug });

    if (!tenant) {
        // Demo: Auto-create tenant
        tenant = await Tenant.create({
            name: tenant_slug,
            slug: tenant_slug
        });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create User
    const user = await User.create({
        tenant_id: tenant._id,
        name,
        email,
        password: hashedPassword,
        roles: ['admin'] // Default to admin for first user
    });

    res.status(201).json({ success: true, user: { id: user._id, email: user.email, tenant: tenant.slug, tenant_id: tenant._id } });
};

exports.login = async (req, res) => {
    const { email, password, tenant_slug } = req.body;

    // 1. Resolve Tenant
    // Login usually happens on a specific subdomain, so tenant is known.
    // Or user provides it.
    if (!tenant_slug) return res.status(400).json({ error: 'Tenant slug required' });

    const tenant = await Tenant.findOne({ slug: tenant_slug });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // 2. Find User in that Tenant
    // (Assuming email is unique globally, we check email first then verify tenant logic)
    // But strict multi-tenancy means we search via tenant_id
    const user = await User.findOne({ email }); // We made email unique globally

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Verify user belongs to this tenant?
    if (user.tenant_id.toString() !== tenant._id.toString()) {
        return res.status(401).json({ error: 'User does not belong to this tenant' });
    }

    // 3. Verify Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // 4. Issue Token
    const token = jwt.sign(
        { id: user._id, tenant_id: tenant._id, roles: user.roles },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '30d' }
    );

    res.json({ success: true, token, tenant_id: tenant._id, user: { id: user._id, name: user.name, roles: user.roles } });
};
