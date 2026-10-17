import express from 'express';
import { db } from '../services/db.js';
import { authMiddleware, AuthRequest } from '../services/authService.js';
import { SavedCommute } from '../types.js';

const router = express.Router();
router.use(authMiddleware);

// Get user's saved commutes
router.get('/', (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const commutes = db.getSavedCommutes(userId);
  const allStops = db.getStops();
  const allRoutes = db.getRoutes();
  const allBuses = db.getBuses();

  const formatted = commutes.map(c => ({
    ...c,
    route: allRoutes.find(r => r.id === c.routeId) || null,
    bus: c.busId ? allBuses.find(b => b.id === c.busId) : null,
    boardingStop: allStops.find(s => s.id === c.boardingStopId) || null,
    destinationStop: allStops.find(s => s.id === c.destinationStopId) || null
  }));

  res.json({ commutes: formatted });
});

// Save a new daily commute (Section 11)
router.post('/', async (req: AuthRequest, res) => {
  const { name, routeId, busId, boardingStopId, destinationStopId, departureTime, thresholdMinutes, notificationChannel, phone } = req.body;

  if (!routeId || !boardingStopId || !destinationStopId) {
    return res.status(400).json({ error: 'Route, boarding stop, and destination stop are required.' });
  }

  const cleanPhone = (phone || req.user!.mobile).replace(/\D/g, '').slice(-10);

  const newCommute: SavedCommute = {
    id: `commute-${Date.now()}`,
    userId: req.user!.id,
    name: name?.trim() || 'Daily Commute',
    routeId,
    busId: busId || undefined,
    boardingStopId,
    destinationStopId,
    departureTime: departureTime || '08:30',
    thresholdMinutes: Number(thresholdMinutes) || 10,
    notificationChannel: notificationChannel || 'both',
    phone: cleanPhone,
    active: true
  };

  await db.addSavedCommute(newCommute);
  res.status(201).json({ message: 'Daily commute saved with automatic arrival alert monitoring.', commute: newCommute });
});

// Update or toggle commute
router.put('/:id', async (req: AuthRequest, res) => {
  const { active, thresholdMinutes, notificationChannel } = req.body;
  const updated = await db.updateSavedCommute(req.params.id, {
    ...(active !== undefined && { active }),
    ...(thresholdMinutes !== undefined && { thresholdMinutes: Number(thresholdMinutes) }),
    ...(notificationChannel && { notificationChannel })
  });

  if (!updated) return res.status(404).json({ error: 'Commute not found.' });
  res.json({ message: 'Commute settings updated.', commute: updated });
});

// Delete commute
router.delete('/:id', async (req: AuthRequest, res) => {
  await db.deleteSavedCommute(req.params.id);
  res.json({ message: 'Commute deleted.' });
});

export default router;
