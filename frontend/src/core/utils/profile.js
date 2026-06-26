/**
 * Checks if a customer's profile is complete.
 * All fields are mandatory to fill.
 *
 * @param {object} user - The customer user object
 * @returns {boolean} - True if profile is complete, false otherwise
 */
export const isCustomerProfileComplete = (user) => {
  if (!user) return true; // Treat as complete if guest to avoid login flashes

  const hasPersonal =
    user.name?.trim() &&
    user.email?.trim() &&
    Array.isArray(user.addresses) &&
    user.addresses.length > 0 &&
    user.addresses[0]?.fullAddress?.trim() &&
    user.addresses[0]?.landmark?.trim();

  const hasBusiness =
    user.businessName?.trim() &&
    user.businessAddress?.trim() &&
    user.businessType?.trim() &&
    user.panNo?.trim();

  return Boolean(hasPersonal && hasBusiness);
};
