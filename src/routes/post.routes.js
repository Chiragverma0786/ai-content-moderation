const express = require('express');
const router = express.Router();
const {
    createPost,
    getPosts,
    getUserPosts,
    getPostById,
    deletePost
} = require('../controllers/post.controller');
const { protect } = require('../middlewares/auth.middleware');

// Protected user routes
router.get('/my-posts', protect, getUserPosts);
router.get('/user/my-posts', protect, getUserPosts);

// Public routes
router.get('/', getPosts);
router.get('/:id', getPostById);

// Post creation and deletion
router.post('/create-post', protect, createPost);
router.post('/', protect, createPost);
router.delete('/:id', protect, deletePost);

module.exports = router;
