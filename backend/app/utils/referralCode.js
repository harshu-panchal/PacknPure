import Customer from "../models/customer.js";

// Excludes visually-confusing characters (0/O, 1/I) so codes are easy to read aloud/type.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `PKP${code}`;
}

/** Generates a unique, non-guessable referral code for a new customer account. */
export async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Customer.exists({ referralCode: candidate });
    if (!exists) return candidate;
  }
  // Astronomically unlikely fallback: widen with a timestamp suffix to guarantee termination.
  return `PKP${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Self-heals a missing referral code for a legacy account, atomically.
 *
 * Two call sites can race to backfill the same account (a customer opening
 * their own Refer & Earn page at the same moment an admin views the "All
 * Users" list, or a React double-effect firing twice) — a plain read →
 * generate → `.save()` lets the second writer silently overwrite the first
 * writer's already-committed code, because each writer only checks the
 * in-memory value it read before either save landed. The `findOneAndUpdate`
 * filter below re-checks "is referralCode still unset" at the DB level at
 * the instant of the write, so only one of the racing writers can ever win.
 *
 * Returns the account's referral code (its own, or the winner's if it lost the race).
 */
export async function ensureReferralCode(customerId, currentCode) {
  if (currentCode) return currentCode;

  const generated = await generateUniqueReferralCode();
  const claimed = await Customer.findOneAndUpdate(
    { _id: customerId, $or: [{ referralCode: null }, { referralCode: { $exists: false } }] },
    { $set: { referralCode: generated } },
    { new: true },
  ).select("referralCode");

  if (claimed) return claimed.referralCode;

  // Lost the race — another writer already set it moments earlier; read the real value.
  const existing = await Customer.findById(customerId).select("referralCode");
  return existing?.referralCode || null;
}
