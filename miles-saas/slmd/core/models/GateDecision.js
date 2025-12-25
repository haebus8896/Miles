const mongoose = require('mongoose');

const gateDecisionSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Input
    gate_id: String,
    vehicle_type: String,
    rider_id: String,

    // Output
    decision: String, // ALLOW, DENY
    matched_rule_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GateRule'
    },
    instructions: String,
    confidence: Number,

    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    expires: '90d' // Auto-delete logs after 90 days
});

module.exports = mongoose.model('GateDecision', gateDecisionSchema);
