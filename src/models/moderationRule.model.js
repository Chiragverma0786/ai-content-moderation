const mongoose = require("mongoose");

const moderationRuleSchema = new mongoose.Schema(
    {
        ruleId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        category: {
            type: String,
            required: true
        },

        categoryName: {
            type: String
        },

        version: {
            type: String
        },

        ruleName: {
            type: String,
            required: true
        },

        description: {
            type: String,
            required: true
        },

        severity: {
            type: String,
            required: true
        },

        action: {
            type: String,
            required: true
        },

        indicators: {
            type: [String],
            default: []
        },

        examples: {
            violating: {
                type: [String],
                default: []
            },

            nonViolating: {
                type: [String],
                default: []
            }
        },

        contextNotes: {
            type: String,
            default: ""
        },

        embedding: {
            type: [Number],
            default: []
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.ModerationRule ||
    mongoose.model("ModerationRule", moderationRuleSchema);