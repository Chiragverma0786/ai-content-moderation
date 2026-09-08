const postModel = require("../models/posts.model");
const mongoose = require("mongoose");
const {
    moderateContent
} = require("../services/moderation.service");


/**
 * @desc    Create a new post with real-time AI moderation
 * @route   POST /api/posts/create-post or POST /api/posts
 * @access  Private
 */
const createPost = async (req, res) => {
    try {
        const { title, content } = req.body;

        /**
         * Validate input
         */
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: "Please provide both title and content for the post"
            });
        }

        const cleanTitle = String(title).trim();
        const cleanContent = String(content).trim();

        if (!cleanTitle || !cleanContent) {
            return res.status(400).json({
                success: false,
                message: "Title and content cannot be empty"
            });
        }

        const user_id = req.user._id || req.user.id;

        /**
         * Run AI moderation pipeline
         */
        const moderation = await moderateContent({
            title: cleanTitle,
            content: cleanContent
        });

        /**
         * Determine moderation status
         */
        const status = moderation.decision || "REVIEW";

        /**
         * BLOCKED content should not be published.
         */
        if (status === "BLOCKED") {
            return res.status(403).json({
                success: false,
                message: "Your post was blocked by the content moderation system.",
                moderation: {
                    status: "BLOCKED",
                    category: moderation.category || null,
                    severity: moderation.severity || null,
                    ruleId: moderation.ruleId || null,
                    confidence: moderation.confidence || null,
                    reason: moderation.reason || null,
                    matchedIndicators: moderation.matchedIndicators || [],
                    retrievedRules: moderation.retrievedRules || [],
                    moderatedAt: moderation.moderatedAt || new Date()
                }
            });
        }

        /**
         * Create post in database
         */
        const newPost = new postModel({
            title: cleanTitle,
            content: cleanContent,
            user_id,
            moderation: {
                status,
                category: moderation.category || null,
                severity: moderation.severity || null,
                ruleId: moderation.ruleId || null,
                confidence: moderation.confidence || null,
                reason: moderation.reason || null,
                matchedIndicators: moderation.matchedIndicators || [],
                retrievedRules: moderation.retrievedRules || [],
                moderatedAt: moderation.moderatedAt || new Date()
            }
        });

        await newPost.save();

        // Populate user details for response
        await newPost.populate("user_id", "name email role");

        return res.status(201).json({
            success: true,
            message:
                status === "SAFE"
                    ? "Post created successfully"
                    : "Post created and flagged for moderation review",
            post: newPost
        });

    } catch (error) {
        console.error("Error creating post:", error);

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((val) => val.message);
            return res.status(400).json({
                success: false,
                message: messages.join(", ")
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error creating post",
            error: error.message
        });
    }
};


/**
 * @desc    Get all posts (with optional status & search filter and pagination)
 * @route   GET /api/posts
 * @access  Public
 */
const getPosts = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;

        const query = {};

        // Filter by moderation status if provided
        if (status && status !== "ALL") {
            query["moderation.status"] = status.toUpperCase();
        }

        // Search in title or content
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const total = await postModel.countDocuments(query);
        const posts = await postModel
            .find(query)
            .populate("user_id", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        return res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            posts
        });

    } catch (error) {
        console.error("Error fetching posts:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching posts",
            error: error.message
        });
    }
};


/**
 * @desc    Get posts created by current user
 * @route   GET /api/posts/my-posts
 * @access  Private
 */
const getUserPosts = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;

        const posts = await postModel
            .find({ user_id: userId })
            .populate("user_id", "name email role")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count: posts.length,
            posts
        });

    } catch (error) {
        console.error("Error fetching user posts:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching user posts",
            error: error.message
        });
    }
};


/**
 * @desc    Get a single post by ID
 * @route   GET /api/posts/:id
 * @access  Public
 */
const getPostById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID format"
            });
        }

        const post = await postModel
            .findById(id)
            .populate("user_id", "name email role")
            .lean();

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        return res.status(200).json({
            success: true,
            post
        });

    } catch (error) {
        console.error("Error fetching post by ID:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching post",
            error: error.message
        });
    }
};


/**
 * @desc    Delete a post (Author, Moderator, or Admin)
 * @route   DELETE /api/posts/:id
 * @access  Private
 */
const deletePost = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID format"
            });
        }

        const post = await postModel.findById(id);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        const userId = (req.user._id || req.user.id).toString();
        const postAuthorId = post.user_id.toString();
        const userRole = req.user.role;

        // Check if authorized to delete
        if (userId !== postAuthorId && userRole !== "admin" && userRole !== "moderator") {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this post"
            });
        }

        await postModel.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Post deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting post:", error);
        return res.status(500).json({
            success: false,
            message: "Server error deleting post",
            error: error.message
        });
    }
};


module.exports = {
    createPost,
    getPosts,
    getUserPosts,
    getPostById,
    deletePost
};  