import type { NextApiRequest, NextApiResponse } from 'next';

// Simple server-side dashboard auth.
// Compares the provided password with process.env.DASHBOARD_PASSWORD (or "change-me" fallback)
// and never exposes the configured password to the client.

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body as { password?: string };

  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  const requiredPassword = process.env.DASHBOARD_PASSWORD || 'change-me';

  if (!requiredPassword) {
    return res.status(500).json({ error: 'Dashboard password is not configured on the server.' });
  }

  if (password === requiredPassword) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Invalid password' });
}
