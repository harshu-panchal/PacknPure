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
