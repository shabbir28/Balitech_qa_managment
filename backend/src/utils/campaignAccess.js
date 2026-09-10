/**
 * QA Agents are assigned one campaign (users.campaign_id) and may only
 * evaluate / open the matching dialer. "Medicare" and "Medicare Dialer"
 * are treated as the same family so a name mismatch does not leak access.
 */

function campaignFamily(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('medicare')) return 'medicare';
  if (n.includes('pharmacy')) return 'pharmacy';
  return n.replace(/\s+dialer\s*$/i, '').trim() || '';
}

function agentCanAccessCampaign(user, { campaign_id, campaign_name, dialer } = {}) {
  if (!user || user.role !== 'QA Agent') return { ok: true };

  if (!user.campaign_id && !user.campaign_name) {
    return {
      ok: false,
      message: 'Access denied. You have no campaign assigned. Contact your administrator.',
    };
  }

  const userFamily = campaignFamily(user.campaign_name);

  if (dialer) {
    const d = String(dialer).toLowerCase();
    if (userFamily && d === userFamily) return { ok: true };
    return {
      ok: false,
      message: `Access denied. You are assigned to the "${user.campaign_name}" campaign and cannot access the "${d}" dialer.`,
    };
  }

  if (campaign_id && user.campaign_id && Number(campaign_id) === Number(user.campaign_id)) {
    return { ok: true };
  }

  const callFamily = campaignFamily(campaign_name);
  if (userFamily && callFamily && userFamily === callFamily) return { ok: true };

  return {
    ok: false,
    message: `Access denied. You are assigned to the "${user.campaign_name}" campaign and can only evaluate that campaign.`,
  };
}

/** SQL fragment + params so a QA Agent only sees their campaign family. */
function agentCampaignSql(user, alias, startIndex) {
  const family = campaignFamily(user.campaign_name);
  const params = [];
  let i = startIndex;

  if (user.campaign_id) {
    params.push(user.campaign_id);
  }
  if (family) {
    params.push(`%${family}%`);
  }

  if (user.campaign_id && family) {
    return {
      sql: `(${alias}.campaign_id = $${i} OR LOWER(COALESCE(${alias}.campaign_name, '')) LIKE $${i + 1})`,
      params,
      next: i + 2,
    };
  }
  if (user.campaign_id) {
    return { sql: `${alias}.campaign_id = $${i}`, params, next: i + 1 };
  }
  if (family) {
    return {
      sql: `LOWER(COALESCE(${alias}.campaign_name, '')) LIKE $${i}`,
      params,
      next: i + 1,
    };
  }
  return { sql: 'FALSE', params: [], next: startIndex };
}

module.exports = { campaignFamily, agentCanAccessCampaign, agentCampaignSql };
