const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password']
    },
    roles: {
        type: [String], // e.g., 'admin', 'ops', 'rider'
        default: ['user']
    },
    permissions: {
        type: [String], // Explicit override: 'resource:action'
        default: []
    }
}, {
    timestamps: true
});

// Compound index to ensure email is unique PER TENANT if desired, 
// but usually email is unique globally in a SaaS unless completely isolated.
// For now, let's keep email unique globally for simplicity.

module.exports = mongoose.model('User', userSchema);
