const { GateRule, GateDecision } = require('../models/GED');

exports.createRule = async (req, res) => {
    const rule = await GateRule.create(req.body);
    res.status(201).json({ success: true, data: rule });
};

exports.evaluateEntry = async (req, res) => {
    const { gate_id, vehicle_type, rider_id } = req.body;

    // 1. Fetch relevant active rules
    const rules = await GateRule.find({
        is_active: true,
        $or: [{ gate_ids: gate_id }, { gate_ids: '*' }]
    }).sort({ priority: -1 });

    // 2. Evaluate
    let finalDecision = 'ALLOW';
    let instructions = 'Proceed to entry';
    let matchedRule = null;

    for (const rule of rules) {
        let match = true;
        if (rule.conditions?.vehicle_types?.length > 0) {
            if (!rule.conditions.vehicle_types.includes(vehicle_type)) match = false;
        }
        if (match) {
            finalDecision = rule.action;
            instructions = rule.instructions || instructions;
            matchedRule = rule;
            break;
        }
    }

    // 3. Log
    const log = await GateDecision.create({
        gate_id,
        vehicle_type,
        rider_id,
        decision: finalDecision,
        matched_rule_id: matchedRule?._id,
        instructions
    });

    res.json({
        success: true,
        data: { decision: finalDecision, instructions, log_id: log._id }
    });
};
