const express = require('express');
const router = express.Router();
const { createPost } = require('../controllers/post.controller');
const { protect } = require('../middlewares/auth.middleware');

// Protected routes
router.post('/create-post', protect, createPost);

module.exports = router;
