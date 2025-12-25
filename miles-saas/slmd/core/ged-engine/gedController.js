const GateRule = require('../models/GateRule');
const GateDecision = require('../models/GateDecision');

exports.createRule = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const rule = await GateRule.create({
        tenant_id: req.tenant._id,
        ...req.body
    });

    res.status(201).json({ success: true, data: rule });
};

exports.evaluateEntry = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const { gate_id, vehicle_type, rider_id } = req.body;

    // 1. Fetch relevant active rules
    const rules = await GateRule.find({
        tenant_id: req.tenant._id,
        is_active: true,
        // Typically matches gate_id or Wildcard
        $or: [{ gate_ids: gate_id }, { gate_ids: '*' }]
    }).sort({ priority: -1 }); // High priority first

    // 2. Evaluate
    let finalDecision = 'ALLOW'; // Default safe fallback or DENY depending on strictness
    let instructions = 'Proceed to entry';
    let matchedRule = null;

    const now = new Date();
    const currentHour = now.getHours() + ':' + now.getMinutes(); // Simplistic
    // A real time comp would be more robust using a library

    for (const rule of rules) {
        let match = true;

        // Check Vehicle
        if (rule.conditions?.vehicle_types?.length > 0) {
            if (!rule.conditions.vehicle_types.includes(vehicle_type)) {
                match = false;
            }
        }

        // Check Time (Todo: robust parsing)

        if (match) {
            finalDecision = rule.action;
            instructions = rule.instructions || instructions;
            matchedRule = rule;
            break; // Priority wins
        }
    }

    // 3. Log Decision
    const log = await GateDecision.create({
        tenant_id: req.tenant._id,
        gate_id,
        vehicle_type,
        rider_id,
        decision: finalDecision,
        matched_rule_id: matchedRule ? matchedRule._id : null,
        instructions
    });

    res.json({
        success: true,
        data: {
            decision: finalDecision,
            instructions,
            log_id: log._id
        }
    });
};

exports.getDecisions = async (req, res) => {
    if (!req.tenant) return res.status(403).json({ error: 'Tenant context missing' });

    const logs = await GateDecision.find({ tenant_id: req.tenant._id }).limit(50).sort('-timestamp');
    res.json({ success: true, count: logs.length, data: logs });
};
