import express from 'express';
import { db } from '../services/db.js';

const router = express.Router();

// Get active service disruptions and delays
router.get('/', (req, res) => {
  const activeAnnouncements = db.getAnnouncements(true);
  res.json({ announcements: activeAnnouncements });
});

export default router;
