import mongoose from "mongoose";

/**
 * Integration suites in this project talk to a real MongoDB. When one is not running
 * (a plain `npm test` on a dev machine), mongoose retries until jest's hook timeout,
 * so the suite burned ~100s and reported red for a reason that has nothing to do with
 * the code under test.
 *
 * Connect with a short server-selection window instead and report back, so those
 * suites can skip cleanly and still run for real in CI where a database exists.
 *
 * @param {string} uri
 * @returns {Promise<boolean>} true when connected
 */
export async function connectIfMongoAvailable(uri) {
  if (mongoose.connection.readyState === 1) return true;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 1500,
      connectTimeoutMS: 1500,
    });
    return true;
  } catch {
    try {
      await mongoose.disconnect();
    } catch {
      /* nothing to tear down */
    }
    return false;
  }
}

/**
 * `describe` that turns into `describe.skip` when no MongoDB is reachable.
 * Resolve availability in a top-level await before calling this.
 */
export const describeIfMongo = (available) =>
  available ? describe : describe.skip;
