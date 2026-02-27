/**
 * Referral system configuration
 */
export const REFERRAL_CONFIG = {
  // Credits awarded to the referrer when someone signs up with their code
  REFERRER_REWARD: 30,

  // Credits awarded to the new user who uses a referral code
  REFERRED_REWARD: 30,

  // Maximum referral credits a user can earn per month
  MONTHLY_LIMIT: 300,

  // Maximum referrals from a single IP per day (anti-fraud)
  MAX_REFERRALS_PER_IP_PER_DAY: 5,
} as const;
