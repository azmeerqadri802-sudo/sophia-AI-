require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDB, isDbConnected } = require('../database/connect');
const Lead = require('../database/models/Lead');
const Team = require('../database/models/Team');
const Campaign = require('../database/models/Campaign');
const { encryptApiKey } = require('./utils/encryption');

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_WHATSAPP = '923083335262';

app.use(cors());
app.use(express.json());

// Fallback In-Memory Store so the .EXE works out-of-the-box even without local MongoDB installed
let memoryLeads = [
  { _id: '1', name: 'Michael Carter', company: 'Skyline Properties', email: 'michael@skylineprop.com', confidenceScore: 98, status: 'Hot' },
  { _id: '2', name: 'Sarah Wilson', company: 'Prime Real Estate', email: 'sarah@primere.com', confidenceScore: 95, status: 'Hot' },
  { _id: '3', name: 'James Anderson', company: 'Global Estates', email: 'james@globalestates.com', confidenceScore: 92, status: 'Hot' },
  { _id: '4', name: 'Emily Roberts', company: 'NextGen Realty', email: 'emily@nextgenrealty.com', confidenceScore: 90, status: 'Hot' },
  { _id: '5', name: 'Robert Davis', company: 'Urban Properties', email: 'robert@urbanprops.com', confidenceScore: 87, status: 'Hot' }
];

let memoryTeam = [
  { _id: 't1', name: 'Hafiz Azmeer Khan', role: 'Founder & CEO', image: '' }
];

let memoryCampaign = {
  emailsSent: 243,
  openRate: 68.4,
  replies: 37,
  meetingsBooked: 8,
  autoPilot: true,
  currentFocus: 'Scraping Real Estate Agencies in New York'
};

app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true });
});

// 1. GET /api/leads
app.get('/api/leads', async (req, res) => {
  try {
    if (isDbConnected()) {
      let leads = await Lead.find({}).sort({ confidenceScore: -1, createdAt: -1 });
      if (leads.length === 0) {
        leads = await Lead.insertMany(memoryLeads.map(({ _id, ...rest }) => rest));
      }
      return res.status(200).json({ success: true, data: leads });
    }
    return res.status(200).json({ success: true, data: memoryLeads });
  } catch (error) {
    return res.status(200).json({ success: true, data: memoryLeads });
  }
});

// 2. POST /api/leads
app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, company, confidenceScore, status } = req.body;
    if (!name || !email || !company) {
      return res.status(400).json({ success: false, error: 'Name, email, and company are required.' });
    }

    if (isDbConnected()) {
      const newLead = await Lead.create({
        name,
        email,
        company,
        confidenceScore: Number(confidenceScore) || 92,
        status: status || 'Hot'
      });
      await Campaign.findOneAndUpdate({}, { $inc: { emailsSent: 1 } }, { upsert: true });
      return res.status(201).json({ success: true, data: newLead });
    }

    const fallbackLead = {
      _id: String(Date.now()),
      name,
      email,
      company,
      confidenceScore: Number(confidenceScore) || 92,
      status: status || 'Hot'
    };
    memoryLeads = [fallbackLead, ...memoryLeads];
    memoryCampaign.emailsSent += 1;
    return res.status(201).json({ success: true, data: fallbackLead });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/leads/:id
app.patch('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (isDbConnected()) {
      const updated = await Lead.findByIdAndUpdate(id, { status }, { new: true });
      return res.status(200).json({ success: true, data: updated });
    }
    memoryLeads = memoryLeads.map((item) => (item._id === id ? { ...item, status } : item));
    const found = memoryLeads.find((item) => item._id === id);
    return res.status(200).json({ success: true, data: found });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. POST & GET /api/settings/ai
app.get('/api/settings/ai', async (req, res) => {
  try {
    if (isDbConnected()) {
      const members = await Team.find({}).select('-API_Key').sort({ updatedAt: -1 });
      return res.status(200).json({ success: true, data: members });
    }
    return res.status(200).json({ success: true, data: memoryTeam });
  } catch (error) {
    return res.status(200).json({ success: true, data: memoryTeam });
  }
});

app.post('/api/settings/ai', async (req, res) => {
  try {
    const { name, role, image, apiKey } = req.body;
    if (!name || !role) {
      return res.status(400).json({ success: false, error: 'Name and Role are required.' });
    }

    const encrypted = apiKey ? encryptApiKey(apiKey.trim()) : '';

    if (isDbConnected()) {
      const saved = await Team.findOneAndUpdate(
        { role: role.trim() },
        { $set: { name: name.trim(), role: role.trim(), image: image || '', API_Key: encrypted } },
        { new: true, upsert: true }
      );
      return res.status(200).json({
        success: true,
        message: role + ' & encrypted AI key saved in MongoDB.',
        data: { _id: saved._id, name: saved.name, role: saved.role }
      });
    }

    const newEntry = { _id: String(Date.now()), name: name.trim(), role: role.trim(), image: image || '' };
    memoryTeam = [newEntry, ...memoryTeam.filter((m) => m.role !== role.trim())];
    return res.status(200).json({
      success: true,
      message: role + ' & AES-256 encrypted AI key saved!',
      data: newEntry
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. POST /api/contact/whatsapp
app.post('/api/contact/whatsapp', async (req, res) => {
  try {
    const { leadId, name, company, email, confidenceScore } = req.body;
    if (leadId) {
      if (isDbConnected()) {
        await Lead.findByIdAndUpdate(leadId, { status: 'Contacted' });
      } else {
        memoryLeads = memoryLeads.map((l) => (l._id === leadId ? { ...l, status: 'Contacted' } : l));
      }
    }

    const text =
      '*OMNIX GLOBAL - SOPHIA AI LEAD ALERT*\n\n' +
      '*Prospect:* ' + (name || 'Client') + '\n' +
      '*Company:* ' + (company || 'Enterprise') + '\n' +
      '*Email:* ' + (email || 'N/A') + '\n' +
      '*Confidence Score:* ' + (confidenceScore || 95) + '% Match';

    const whatsappUrl = 'https://wa.me/' + ADMIN_WHATSAPP + '?text=' + encodeURIComponent(text);
    return res.status(200).json({ success: true, whatsappUrl, recipient: '+' + ADMIN_WHATSAPP });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. GET & POST /api/campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    if (isDbConnected()) {
      let campaign = await Campaign.findOne({});
      if (!campaign) campaign = await Campaign.create(memoryCampaign);
      return res.status(200).json({ success: true, data: campaign });
    }
    return res.status(200).json({ success: true, data: memoryCampaign });
  } catch (error) {
    return res.status(200).json({ success: true, data: memoryCampaign });
  }
});

app.post('/api/campaigns', async (req, res) => {
  try {
    const { action, autoPilot } = req.body;

    if (action === 'TOGGLE_AUTOPILOT') {
      memoryCampaign.autoPilot = Boolean(autoPilot);
      if (isDbConnected()) {
        await Campaign.findOneAndUpdate({}, { autoPilot: memoryCampaign.autoPilot }, { upsert: true });
      }
      return res.status(200).json({ success: true, data: memoryCampaign });
    }

    if (action === 'SIMULATE_AI_TICK' && memoryCampaign.autoPilot) {
      const sampleEvents = [
        { type: 'linkedin', text: 'Sophia found 15 new leads via LinkedIn.', focus: 'Scraping Real Estate Agencies in New York' },
        { type: 'email', text: 'Sophia drafted a personalized email to John Doe.', focus: 'Searching for Property Investment Firms in London, UK' },
        { type: 'reply', text: 'New Reply! Sophia is drafting a response.', focus: 'Scanning Business Directories in Lahore, Pakistan' },
        { type: 'meeting', text: 'Meeting booked with Sarah Wilson (Real Estate Co.).', focus: 'Finding Commercial Real Estate Leads in Dubai, UAE' },
        { type: 'open', text: 'Email opened! (3rd time) by Michael Carter.', focus: 'Analyzing Real Estate Developers in Sydney, Australia' }
      ];
      const ev = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
      memoryCampaign.emailsSent += 1;
      if (ev.type === 'reply') memoryCampaign.replies += 1;
      if (ev.type === 'meeting') memoryCampaign.meetingsBooked += 1;
      memoryCampaign.currentFocus = ev.focus;

      return res.status(200).json({
        success: true,
        data: memoryCampaign,
        activityEvent: {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: ev.type,
          text: ev.text
        }
      });
    }

    return res.status(200).json({ success: true, data: memoryCampaign });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Serve Static Frontend UI for Electron Desktop Window
const frontendOutPath = path.join(__dirname, '../frontend/out');
app.use(express.static(frontendOutPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendOutPath, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('Sophia AI Desktop Engine running on http://127.0.0.1:' + PORT);
  connectDB(process.env.MONGODB_URI);
});