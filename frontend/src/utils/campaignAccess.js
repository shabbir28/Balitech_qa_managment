export function campaignFamily(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('medicare')) return 'medicare';
  if (n.includes('pharmacy')) return 'pharmacy';
  return '';
}

/** Locked dialer for a QA Agent, or null if they may pick any. */
export function lockedDialerForUser(user) {
  if (user?.role !== 'QA Agent') return null;
  return campaignFamily(user.campaign_name) || null;
}

export function agentCanEvaluateCall(user, call) {
  if (user?.role !== 'QA Agent') return true;
  const family = campaignFamily(user.campaign_name);
  if (!family) return false;
  if (call?.campaign_id && user.campaign_id && Number(call.campaign_id) === Number(user.campaign_id)) {
    return true;
  }
  return campaignFamily(call?.campaign_name) === family;
}
