import express from 'express';
import { db } from '../services/db.js';
import { processInboundSMS, sendSMS } from '../services/smsService.js';
import { SMSSubscription } from '../types.js';

const router = express.Router();

// 1. Inbound SMS Webhook (Telecom Gateway integration endpoint)
router.post('/webhook', async (req, res) => {
  try {
    // Accommodate multiple provider webhook schemas (Twilio: From/Body, Generic: from/text/message)
    const from = req.body.From || req.body.from || req.body.sender || req.body.mobile;
    const body = req.body.Body || req.body.body || req.body.message || req.body.text;

    if (!from || !body) {
      return res.status(400).json({ error: 'Missing From or Body parameter in webhook payload.' });
    }

    const reply = await processInboundSMS(from, body);

    // If Twilio format, return TwiML or JSON
    if (req.body.AccountSid || req.body.From) {
      res.type('text/xml');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`);
    }

    res.json({ success: true, from, reply });
  } catch (err: any) {
    console.error('Inbound SMS webhook error:', err);
    res.status(500).json({ error: 'Error processing inbound SMS.' });
  }
});

// 2. Interactive Feature Phone / SMS Command Simulator endpoint for examination & demonstration
router.post('/test-command', async (req, res) => {
  try {
    const { mobile, commandText } = req.body;
    if (!commandText || commandText.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter an SMS command (e.g. BUS UP16-1001, STOP KNP01, HELP).' });
    }

    const cleanMobile = (mobile || '9988776655').replace(/\D/g, '').slice(-10);
    const reply = await processInboundSMS(cleanMobile, commandText);

    res.json({
      success: true,
      sender: cleanMobile,
      commandReceived: commandText,
      replyMessage: reply,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process command.' });
  }
});

// 3. Web-based SMS arrival alert subscription (for passengers without smart internet on regular commute)
router.post('/subscribe', async (req, res) => {
  try {
    const { mobile, busId, stopId, thresholdMinutes, language } = req.body;
    if (!mobile || !busId || !stopId) {
      return res.status(400).json({ error: 'Mobile number, bus, and stop are required.' });
    }

    const clean = mobile.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    const sub: SMSSubscription = {
      id: `sub-${Date.now()}`,
      mobile: clean,
      consent: true,
      language: language || 'en',
      busId,
      stopId,
      thresholdMinutes: Number(thresholdMinutes) || 10,
      active: true,
      subscribedAt: new Date().toISOString()
    };

    await db.addSMSSubscription(sub);

    const bus = db.getBusById(busId);
    const stop = db.getStopById(stopId);

    const confirmation = `TransitEase: You are subscribed to SMS alerts for Bus ${bus?.busNumber || ''} at ${stop?.name || ''} (${sub.thresholdMinutes}m before arrival). Reply CANCEL to opt out.`;
    await sendSMS(clean, confirmation, 'outbound_alert');

    res.status(201).json({
      success: true,
      message: 'SMS arrival alert subscribed. Confirmation SMS sent.',
      subscription: sub
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to subscribe to SMS alerts.' });
  }
});

// 4. SMS History
router.get('/history', (req, res) => {
  const mobile = req.query.mobile as string;
  const logs = db.getSMSLogs();
  if (mobile) {
    const clean = mobile.replace(/\D/g, '').slice(-10);
    return res.json({ logs: logs.filter(l => l.mobile === clean) });
  }
  res.json({ logs });
});

export default router;
