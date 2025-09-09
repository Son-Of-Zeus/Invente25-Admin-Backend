// routes/receipt.js
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { createPaymentHeaders } = require('../paymentAuth');
const db = require('../db');
const { uploadReceipt } = require('../utils/s3Uploader');

const router = express.Router();

// Memory storage; we don't persist files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Accept either field name 'image' or 'receipt'
const fileFields = upload.any();

// Track limits
const TRACK_LIMITS = {
  Software: 30,
  Hardware: 20
};

// Pre-compiled regex for payment ID
const PAYMENT_ID_REGEX = /pay_[A-Za-z0-9]{14}/; //maybe change to exactly length 14 later

// Initialize GCV client using local credentials.json if present or env default
let visionClient;
try {
  visionClient = new ImageAnnotatorClient({
    keyFilename: 'credentials.json'
  });
} catch (e) {
  // Fallback to default credentials (GOOGLE_APPLICATION_CREDENTIALS)
  visionClient = new ImageAnnotatorClient();
}

// --- S3 INTEGRATION START ---
/**
 * Helper function to handle the upload and database insertion.
 * This is non-critical; it logs errors but does not fail the request.
 * @param {string} paymentID The extracted payment ID.
 * @param {object} file The file object from multer.
 */
async function handleReceiptUpload(paymentID, file) {
  if (!paymentID || !file) return;

  try {
    const s3Url = await uploadReceipt(file.buffer, paymentID, file.mimetype);
    if (s3Url) {
      // Save the URL to the new database table
      await db.query(
        'INSERT INTO receipt_uploads (payment_id, s3_url) VALUES ($1, $2) ON CONFLICT (payment_id) DO NOTHING',
        [paymentID, s3Url]
      );
    }
  } catch (dbError) {
    console.error(`Failed to save S3 URL to DB for paymentID ${paymentID}:`, dbError);
  }
}
// --- S3 INTEGRATION END ---


// GET endpoint to check hackathon track availability
router.get('/hackathon/availability', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT track, COUNT(*) as count FROM hack_passes GROUP BY track'
    );
    
    const trackCounts = {};
    rows.forEach(row => {
      trackCounts[row.track] = parseInt(row.count);
    });
    
    const response = {};
    Object.keys(TRACK_LIMITS).forEach(track => {
      const count = trackCounts[track] || 0;
      const max = TRACK_LIMITS[track];
      response[track] = {
        available: count < max,
        count: count,
        max: max,
        remaining_count: max - count
      };
    });
    
    res.json(response);
  } catch (err) {
    console.error('GET /hackathon/availability error:', err);
    res.status(500).json({ error: 'server error checking track availability' });
  }
});
router.post('/receipt', fileFields, async (req, res) => {
  try {
    const body = req.body || {};
    const file = (req.files || []).find(f => f.fieldname === 'image' || f.fieldname === 'receipt');

    if (body.paymentID && PAYMENT_ID_REGEX.test(body.paymentID)) {
      await forwardToPaymentService(body);

      if (file) {
        await handleReceiptUpload(body.paymentID, file)
      }
      return res.json({ success: true, paymentID: body.paymentID, forwarded: true });
    }

    if (!file) {
      return res.status(400).json({ error: 'image file is required (field: image or receipt)' });
    }

    const mime = (file.mimetype || '').toLowerCase();
    if (!(mime === 'image/jpeg' || mime === 'image/png' || mime === 'application/pdf')) {
      return res.status(400).json({ error: 'unsupported file type, only jpg, png and pdf are allowed' });
    }
    
    // --- START: CORRECTED OCR LOGIC ---
    let fullText = '';
    
    if (mime === 'application/pdf') {
      console.log('Processing PDF with batchAnnotateFiles...');
      const request = {
        requests: [{
          inputConfig: { content: file.buffer, mimeType: 'application/pdf' },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        }],
      };
      const [result] = await visionClient.batchAnnotateFiles(request);
      const annotation = result.responses[0].responses[0].fullTextAnnotation;
      fullText = annotation ? annotation.text : '';
    } else {
      console.log('Processing Image with textDetection...');
      const [result] = await visionClient.textDetection({ image: { content: file.buffer } });
      const annotation = result.fullTextAnnotation;
      fullText = annotation ? annotation.text : '';
    }
    // --- END: CORRECTED OCR LOGIC ---
    
    if (!fullText) {
      return res.status(400).json({ error: 'no text detected in file' });
    }

    const match = fullText.match(PAYMENT_ID_REGEX);
    if (!match) {
      return res.status(400).json({ error: 'payment_id not found in file' });
    }
    const paymentID = match[0];
    const payload = { ...body, paymentID };

    await handleReceiptUpload(paymentID, file)

    await forwardToPaymentService(payload);

    return res.json({ success: true, paymentID, forwarded: true });
  } catch (err) {
    console.error('POST /receipt error:', err);
    return res.status(500).json({ error: 'server error during receipt processing' });
  }
});

router.post('/hackathon-receipt', fileFields, async (req, res) => {
  try {
    // --- START: MODIFIED INPUT HANDLING ---
    if (!req.body.jsonData) {
      return res.status(400).json({ error: 'jsonData field is required' });
    }

    let body;
    try {
      // Parse the JSON string from the jsonData field
      body = JSON.parse(req.body.jsonData);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON in jsonData field' });
    }
    // --- END: MODIFIED INPUT HANDLING ---

    // Extract file buffer (This part is unchanged)
    const file = (req.files || []).find(f => f.fieldname === 'image' || f.fieldname === 'receipt');

    // If paymentID provided and valid, skip OCR
    // This logic now correctly uses the parsed 'body' object
    if (body.paymentID && PAYMENT_ID_REGEX.test(body.paymentID)) {
      // Check track availability before forwarding to payment service
      if (body.track) {
        const track = body.track.split('$')[0].toLowerCase();
        if (track === 'software' || track === 'hardware') {
          const { rows } = await db.query(
            'SELECT COUNT(*) as count FROM hack_passes WHERE track = $1',
            [track]
          );
          const count = parseInt(rows[0].count, 10);
          const max = TRACK_LIMITS[track];
          
          if (count >= max) {
            return res.status(400).json({ 
              error: `${track.charAt(0).toUpperCase() + track.slice(1)} track is full` 
            });
          }
        }
      }
      if (file) {
        await handleReceiptUpload(body.paymentID, file)
      }
      // The 'body' object contains only the parsed JSON, so the file is not forwarded.
      await forwardToHackathonPaymentService(body);
      return res.json({ success: true, paymentID: body.paymentID, forwarded: true });
    }

    if (!file) {
      return res.status(400).json({ error: 'image file is required (field: image or receipt)' });
    }

    // Allow jpg/png/pdf
    const mime = (file.mimetype || '').toLowerCase();
    if (!(mime === 'image/jpeg' || mime === 'image/png' || mime === 'application/pdf')) {
      return res.status(400).json({ error: 'unsupported file type, only jpg, png and pdf are allowed' });
    }

    // --- OCR LOGIC (Unchanged) ---
    let fullText = '';
    
    if (mime === 'application/pdf') {
      const request = {
        requests: [{
          inputConfig: { content: file.buffer, mimeType: 'application/pdf' },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        }],
      };
      const [result] = await visionClient.batchAnnotateFiles(request);
      const annotation = result.responses[0].responses[0].fullTextAnnotation;
      fullText = annotation ? annotation.text : '';
    } else {
      const [result] = await visionClient.textDetection({ image: { content: file.buffer } });
      const annotation = result.fullTextAnnotation;
      fullText = annotation ? annotation.text : '';
    }
    
    if (!fullText) {
      return res.status(400).json({ error: 'no text detected in file' });
    }

    const match = fullText.match(PAYMENT_ID_REGEX);
    if (!match) {
      return res.status(400).json({ error: 'payment_id not found in image' });
    }
    const paymentID = match[0];

    // The payload is built from the parsed 'body' and the OCR'd paymentID
    const payload = { ...body, paymentID };

    await handleReceiptUpload(paymentID, file)

    // Check track availability before forwarding to payment service
    if (payload.track) {
      const track = payload.track.split('$')[0].toLowerCase();
      if (track === 'software' || track === 'hardware') {
        const { rows } = await db.query(
          'SELECT COUNT(*) as count FROM hack_passes WHERE track = $1',
          [track]
        );
        const count = parseInt(rows[0].count, 10);
        const max = TRACK_LIMITS[track];
        
        if (count >= max) {
          return res.status(400).json({ 
            error: `${track.charAt(0).toUpperCase() + track.slice(1)} track is full` 
          });
        }
      }
    }

    // The final 'payload' only contains JSON data and is forwarded correctly.
    await forwardToHackathonPaymentService(payload);

    return res.json({ success: true, paymentID, forwarded: true });
  } catch (err) {
    console.error('POST /hackathon-receipt error:', err);
    return res.status(500).json({ error: 'server error during hackathon receipt processing' });
  }
});

async function forwardToPaymentService(payload) {
  // Ensure we do not forward file buffers; only JSON fields
  const paymentHeaders = createPaymentHeaders(process.env.PAYMENT_SERVICE_SECRET);

  // Remove any file-related fields and ensure only JSON-serializable data
  const forwardBody = { ...payload };
  delete forwardBody.image;
  delete forwardBody.receipt;
  
  // If eventBookingDetails is a string (from multipart), try to parse JSON
  if (typeof forwardBody.eventBookingDetails === 'string') {
    try {
      forwardBody.eventBookingDetails = JSON.parse(forwardBody.eventBookingDetails);
    } catch (_) {
      // leave as-is; payment service may reject if malformed
    }
  }

  // createdAt: if provided as string, keep; if missing, set now
  if (!forwardBody.createdAt) {
    forwardBody.createdAt = new Date().toISOString();
  }

  await axios.post(process.env.PAYMENT_SERVICE_URL, forwardBody, { headers: paymentHeaders });
  await forwardToReceiptService(forwardBody);
}

async function forwardToHackathonPaymentService(payload) {
  // Ensure we do not forward file buffers; only JSON fields
  const paymentHeaders = createPaymentHeaders(process.env.PAYMENT_SERVICE_SECRET);

  // Remove any file-related fields and ensure only JSON-serializable data
  const forwardBody = { ...payload };
  delete forwardBody.image;
  delete forwardBody.receipt;

  await axios.post(process.env.HACKATHON_PAYMENT_SERVICE_URL, forwardBody, { headers: paymentHeaders });
  await forwardToReceiptServiceForHackathon(forwardBody);
}

module.exports = router;




async function forwardToReceiptService(payload) {
  if (!process.env.RECEIPT_SERVICE_URL) {
    console.warn('RECEIPT_SERVICE_URL not set; skipping forwarding to receipt service.');
    return;
  }

  // normalize names and ensure paid timestamp exists
  const ts = new Date().toISOString();
  const p = { ...payload };

  const email = p.email || p.emailID || p.emailId || p.uploaderEmail || null;
  const phone = p.phone || p.phoneNumber || p.phoneNumber || null;
  const method = p.method || p.paymentMethod || 'online';
  const amount = p.amount !== undefined ? Number(p.amount) : (p.total ? Number(p.total) : null);

  // Accept either camelCase or snake_case and provide both to be safe
  const paidOnVal = p.paidOn || p.paid_on || p.paid_on_ts || p.paidOnTimestamp || ts;

  // Normalize eventBookingDetails if it's a string
  let eventBookingDetails = p.eventBookingDetails;
  if (typeof eventBookingDetails === 'string') {
    try { eventBookingDetails = JSON.parse(eventBookingDetails); } catch (_) { /* leave as-is */ }
  }

  const forwardBody = {
    // common variants
    paymentID: p.paymentID || p.paymentId || p.payment_id,
    payment_id: p.paymentID || p.paymentId || p.payment_id,
    // contact
    emailID: email,
    phoneNumber: phone,

    // amounts / method / booking
    method: 'online',
    amount,
    eventBookingDetails,

    // timestamps — provide both keys so receivers map correctly
    paidOn: paidOnVal,
    paid_on: paidOnVal,
    createdAt: p.createdAt || p.created_at || ts,
  };

  try {
    await axios.post(process.env.RECEIPT_SERVICE_URL, forwardBody);
  } catch (err) {
    // Log but do not throw. Receipt service should not break the caller.
    console.error('forwardToReceiptService failed:', err?.message || err);
  }
}


// helper: send the exact fields the receipt service expects for hackathon requests
async function forwardToReceiptServiceForHackathon(forwardBody) {
  if (!process.env.RECEIPT_SERVICE_URL) {
    console.warn('RECEIPT_SERVICE_URL not set; skipping forwarding to receipt service.');
    return;
  }

  const ts = new Date().toISOString();

  const emailID =
    forwardBody.leader_email ||
    forwardBody.leaderEmail ||
    forwardBody.leader ||
    forwardBody.emailID ||
    forwardBody.email ||
    null;

  const paymentID = forwardBody.paymentID || forwardBody.paymentId || forwardBody.payment_id || null;

  // amount is expected to be present in the body (user said they'd include it)
  const amount = forwardBody.amount !== undefined ? forwardBody.amount : null;

  // phoneNumber: take the first value from member_phones if present, otherwise use provided phoneNumber/phone
  let phoneNumber = null;
  if (forwardBody.member_phones && typeof forwardBody.member_phones === 'object') {
    const vals = Object.values(forwardBody.member_phones);
    if (vals.length) phoneNumber = vals[0];
  }
  phoneNumber = phoneNumber || forwardBody.phoneNumber || forwardBody.phone || null;

  const payload = {
    emailID,
    paymentID,
    paidOn: ts,
    method: 'online',
    amount,
    phoneNumber
  };

  try {
    await axios.post(process.env.RECEIPT_SERVICE_URL, payload);
  } catch (err) {
    console.error('forwardToReceiptServiceForHackathon failed:', err?.message || err);
    // non-fatal: do not throw, keep main flow resilient
  }
}
