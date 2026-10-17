import express from 'express';
import { db } from '../services/db.js';
import { PassengerReport } from '../types.js';

const router = express.Router();

// 1. Submit passenger grievance (Section 19)
router.post('/', async (req, res) => {
  try {
    const { passengerName, passengerMobile, busId, routeId, category, description } = req.body;
    if (!category || !description) {
      return res.status(400).json({ error: 'Issue category and description are required.' });
    }

    const refNum = `REP-TE-${Date.now().toString().slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReport: PassengerReport = {
      id: `rep-${Date.now()}`,
      referenceNumber: refNum,
      passengerName: passengerName?.trim() || 'Anonymous Passenger',
      passengerMobile: passengerMobile ? passengerMobile.replace(/\D/g, '').slice(-10) : undefined,
      busId: busId || undefined,
      routeId: routeId || undefined,
      category,
      description: description.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await db.addPassengerReport(newReport);

    res.status(201).json({
      success: true,
      message: 'Grievance submitted. Transit administrators have been notified.',
      referenceNumber: refNum,
      report: newReport
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

// 2. Track report status by reference number
router.get('/:referenceNumber', (req, res) => {
  const ref = req.params.referenceNumber.trim();
  const report = db.getPassengerReports().find(r => r.referenceNumber.toUpperCase() === ref.toUpperCase());

  if (!report) {
    return res.status(404).json({ error: `No report found with reference number "${ref}".` });
  }

  res.json({
    report: {
      referenceNumber: report.referenceNumber,
      category: report.category,
      status: report.status,
      resolutionNotes: report.resolutionNotes,
      createdAt: report.createdAt
    }
  });
});

export default router;
