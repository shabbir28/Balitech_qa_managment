// Mirrors the backend rule: at least 8 characters, one letter and one number.
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'letter', label: 'Contains a letter', test: (v) => /[a-zA-Z]/.test(v) },
  { key: 'number', label: 'Contains a number', test: (v) => /[0-9]/.test(v) },
];

export function isPasswordValid(value) {
  return PASSWORD_RULES.every((r) => r.test(value || ''));
}

export function passwordStrength(value) {
  const v = value || '';
  let score = PASSWORD_RULES.filter((r) => r.test(v)).length;
  if (v.length >= 12) score += 1;
  if (/[^a-zA-Z0-9]/.test(v)) score += 1;
  return Math.min(score, 5);
}
