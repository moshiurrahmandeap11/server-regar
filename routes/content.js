const express = require('express');
const router = express.Router();
const Faq = require('../models/Faq');
const Content = require('../models/Content');
const Settings = require('../models/Settings');
const Newsletter = require('../models/Newsletter');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/faq', async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ order: 1 });
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/faq', auth, adminOnly, async (req, res) => {
  try {
    const faq = new Faq(req.body);
    await faq.save();
    res.status(201).json(faq);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/faq/:id', auth, adminOnly, async (req, res) => {
  try {
    const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(faq);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/faq/:id', auth, adminOnly, async (req, res) => {
  try {
    await Faq.findByIdAndDelete(req.params.id);
    res.json({ message: 'FAQ deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/content/:key', async (req, res) => {
  try {
    const content = await Content.findOne({ key: req.params.key });
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/content/:key', auth, adminOnly, async (req, res) => {
  try {
    const content = await Content.findOneAndUpdate({ key: req.params.key }, req.body, { new: true, upsert: true });
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/settings', auth, adminOnly, async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    const existing = await Newsletter.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already subscribed' });
    const newsletter = new Newsletter({ email });
    await newsletter.save();
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
