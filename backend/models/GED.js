const mongoose = require('mongoose');

const GateRuleSchema = new mongoose.Schema({
    name: String,
    priority: { type: Number, default: 10 },
    gate_ids: [String],
    conditions: {
        vehicle_types: [String],
        start_time: String,
        end_time: String
    },
    action: {
        type: String,
        enum: ['ALLOW', 'DENY', 'WARN'],
        required: true
    },
    instructions: String,
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

const GateDecisionSchema = new mongoose.Schema({
    gate_id: String,
    vehicle_type: String,
    rider_id: String,
    decision: String,
    matched_rule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GateRule' },
    instructions: String,
    timestamp: { type: Date, default: Date.now }
});

module.exports = {
    GateRule: mongoose.models.GateRule || mongoose.model('GateRule', GateRuleSchema),
    GateDecision: mongoose.models.GateDecision || mongoose.model('GateDecision', GateDecisionSchema)
};
