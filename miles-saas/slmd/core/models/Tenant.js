const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a tenant name'],
        unique: true
    },
    slug: {
        type: String,
        required: [true, 'Please add a tenant slug (subdomain)'],
        unique: true,
        lowercase: true
    },
    config: {
        theme: String,
        allowedOrigins: [String]
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Tenant', tenantSchema);
