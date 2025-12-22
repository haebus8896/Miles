// Simple in-memory OTP store for demo purposes
// In production, use Redis or a database
const otpStore = new Map();

exports.sendOtp = async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ error: 'Phone number required' });
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Store OTP with expiry (5 minutes)
    otpStore.set(phone, {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000
    });

    console.log(`[MOCK OTP] Sending OTP ${otp} to ${phone}`);

    // In real app, call SMS provider here

    res.json({ success: true, message: 'OTP sent successfully' });
};

exports.verifyOtp = async (req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone and OTP required' });
    }

    const record = otpStore.get(phone);

    if (!record) {
        return res.status(400).json({ error: 'OTP not found or expired' });
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(phone);
        return res.status(400).json({ error: 'OTP expired' });
    }

    if (record.otp !== otp) {
        return res.status(400).json({ error: 'Invalid OTP' });
    }

    // OTP is valid
    otpStore.delete(phone); // Clear used OTP

    res.json({ success: true, message: 'OTP verified successfully' });
};
