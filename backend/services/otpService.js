const crypto = require('crypto');
const dayjs = require('dayjs');
const Otp = require('../models/Otp');

const EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const RESEND_INTERVAL = Number(process.env.OTP_RESEND_INTERVAL_SECONDS || 45);

const hashOtp = (otp, reference) => crypto.createHash('sha256').update(`${otp}:${reference}`).digest('hex');

const generateOtp = () => crypto.randomInt(1000, 10000).toString();

async function canSend(phone) {
  const last = await Otp.findOne({ phone }).sort({ createdAt: -1 });
  if (!last) return true;
  return dayjs().diff(dayjs(last.createdAt), 'second') >= RESEND_INTERVAL;
}

async function issueOtp(phone) {
  if (!phone) throw new Error('phone is required');
  const allowed = await canSend(phone);
  if (!allowed) {
    throw new Error(`Please wait ${RESEND_INTERVAL} seconds before requesting another OTP`);
  }

  const otp = generateOtp();
  const reference = crypto.randomUUID();
  const expiresAt = dayjs().add(EXPIRY_MINUTES, 'minute').toDate();

  await Otp.create({
    phone,
    reference,
    otp_hash: hashOtp(otp, reference),
    expires_at: expiresAt
  });

  // For now return OTP in payload (since we cannot send SMS inside repo)
  console.log(`[OTP SERVICE FIXED] Generated 4-DIGIT OTP for ${phone}: ${otp}`);
  return { reference, expiresAt, otp };
}

async function verifyOtp(reference, otp) {
  const record = await Otp.findOne({ reference });
  if (!record) throw new Error('Invalid OTP reference');
  if (record.verified) return { valid: true, phone: record.phone };
  if (dayjs().isAfter(dayjs(record.expires_at))) throw new Error('OTP expired');

  record.attempts += 1;

  if (record.otp_hash !== hashOtp(otp, reference)) {
    console.error(`[OTP DEBUG] Verification Failed! Phone: ${record.phone}`);
    console.error(`[OTP DEBUG] Received OTP: ${otp}`);
    console.error(`[OTP DEBUG] Stored Hash: ${record.otp_hash}`);
    console.error(`[OTP DEBUG] Computed Hash: ${hashOtp(otp, reference)}`);
    await record.save();
    throw new Error('Invalid OTP');
  }

  record.verified = true;
  await record.save();
  return { valid: true, phone: record.phone };
}

module.exports = {
  issueOtp,
  verifyOtp
};

