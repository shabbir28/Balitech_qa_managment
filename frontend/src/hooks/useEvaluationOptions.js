import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

/**
 * Fallback lists shown until the server responds (or if it is unreachable),
 * matching what the backend seeds on first run.
 */
export const DEFAULT_EVALUATION_OPTIONS = {
  dids: ['D1', 'D3', 'D4', 'D5', 'D6cpl', 'Hi', 'Hi main'],
  laSideErrorCategory: [
    'Already in a good plan', 'No plan Available', 'Customer become not intrested',
    'call Back arange', 'call ended in no result', 'DNQ Customer', 'DNC Customer',
    'Not billable', 'Decline',
  ],
  errorCategory: [
    'DNQ Customer', 'Under Buffer', 'Fake Sale', 'Skipping Qualifying Questions',
    'Quoting Money', 'Falls Statement', 'Promoising Statement', 'DNC Customer',
  ],
};

function normalise(data) {
  const src = data?.options || {};
  return Object.fromEntries(
    Object.keys(DEFAULT_EVALUATION_OPTIONS).map((field) => [
      field,
      Array.isArray(src[field]) && src[field].length > 0 ? src[field] : DEFAULT_EVALUATION_OPTIONS[field],
    ])
  );
}

/**
 * Shared, server-backed option lists for the evaluation sheet dropdowns.
 * Every evaluator sees the same lists; adding an option persists it for all.
 */
export default function useEvaluationOptions() {
  const [options, setOptions] = useState(DEFAULT_EVALUATION_OPTIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/evaluations/options/dropdowns')
      .then((res) => {
        if (!cancelled && res.data?.success) setOptions(normalise(res.data.data));
      })
      .catch((err) => {
        console.warn('Could not load evaluation dropdown options, using defaults:', err?.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const addOption = useCallback(async (field, value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    const exists = (options[field] || []).some((o) => o.toLowerCase() === trimmed.toLowerCase());
    if (exists) return true;

    // Optimistic so the datalist reflects the value immediately.
    setOptions((prev) => ({ ...prev, [field]: [...(prev[field] || []), trimmed] }));
    try {
      const res = await api.post('/evaluations/options/dropdowns', { field, value: trimmed });
      if (res.data?.success) setOptions(normalise(res.data.data));
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save option.');
      setOptions((prev) => ({ ...prev, [field]: (prev[field] || []).filter((o) => o !== trimmed) }));
      return false;
    }
  }, [options]);

  const removeOption = useCallback(async (field, value) => {
    try {
      const res = await api.delete('/evaluations/options/dropdowns', { data: { field, value } });
      if (res.data?.success) setOptions(normalise(res.data.data));
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove option.');
      return false;
    }
  }, []);

  return { options, loading, addOption, removeOption };
}
