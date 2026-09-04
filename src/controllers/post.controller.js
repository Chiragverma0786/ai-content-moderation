const postModel = require('../models/posts.model');

exports.createPost = async (req, res) => {
  try {
    const { title, content } = req.body;

    // Validate inputs
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both title and content for the post',
      });
    }

    const user_id = req.user._id || req.user.id;

    // Create a new post
    const newPost = new postModel({
      title: title.trim(),
      content: content.trim(),
      user_id,
    });

    // Save the post to the database
    await newPost.save();

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: newPost,
    });
  } catch (error) {
    console.error('Error creating post:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Server error creating post',
      error: error.message,
    });
  }
};
