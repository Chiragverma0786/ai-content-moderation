const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        content: {
            type: String,
            required: true,
            trim: true
        },

        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        moderation: {
            status: {
                type: String,
                enum: [
                    "PENDING",
                    "SAFE",
                    "FLAGGED",
                    "REVIEW",
                    "BLOCKED"
                ],
                default: "PENDING"
            },

            category: {
                type: String,
                default: null
            },

            severity: {
                type: String,
                default: null
            },

            ruleId: {
                type: String,
                default: null
            },

            confidence: {
                type: Number,
                default: null
            },

            reason: {
                type: String,
                default: null
            },

            matchedIndicators: {
                type: [String],
                default: []
            },

            retrievedRules: {
                type: [
                    {
                        ruleId: String,
                        ruleName: String,
                        category: String,
                        similarityScore: Number
                    }
                ],
                default: []
            },

            moderatedAt: {
                type: Date,
                default: null
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.Posts ||
    mongoose.model("Posts", PostSchema);