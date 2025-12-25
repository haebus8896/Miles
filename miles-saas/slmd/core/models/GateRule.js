const mongoose = require('mongoose');

const gateRuleSchema = new mongoose.Schema({
    tenant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    name: String,
    priority: { type: Number, default: 10 }, // Higher overrides lower

    // Scope
    gate_ids: [String], // ["GATE-1", "*"]

    // Conditions
    conditions: {
        vehicle_types: [String], // ["bike", "van"]
        start_time: String, // "08:00"
        end_time: String,   // "22:00"
        days_of_week: [Number] // [0-6]
    },

    // Outcome
    action: {
        type: String,
        enum: ['ALLOW', 'DENY', 'WARN', 'REQUIRE_APPROVAL'],
        required: true
    },

    instructions: String, // "Park in B2 visitors"

    is_active: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('GateRule', gateRuleSchema);
