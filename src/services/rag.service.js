const ModerationRule = require("../models/moderationRule.model");


/**
 * Calculate cosine similarity between two vectors.
 */
const cosineSimilarity = (vectorA, vectorB) => {

    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
        return 0;
    }

    if (vectorA.length === 0 || vectorB.length === 0) {
        return 0;
    }

    if (vectorA.length !== vectorB.length) {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {

        dotProduct += vectorA[i] * vectorB[i];

        magnitudeA += vectorA[i] * vectorA[i];

        magnitudeB += vectorB[i] * vectorB[i];
    }

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return (
        dotProduct /
        (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
    );
};


/**
 * Find the most relevant moderation rules.
 */
const searchRelevantRules = async (
    queryEmbedding,
    options = {}
) => {

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
        return [];
    }

    const {
        limit = 5,
        minScore = 0.25
    } = options;

    const rules = await ModerationRule.find({
        embedding: {
            $exists: true,
            $ne: []
        }
    }).lean();

    const scoredRules = rules.map((rule) => {

        const score = cosineSimilarity(
            queryEmbedding,
            rule.embedding
        );

        return {
            ...rule,
            similarityScore: score
        };
    });

    return scoredRules
        .filter((rule) => rule.similarityScore >= minScore)
        .sort(
            (a, b) =>
                b.similarityScore -
                a.similarityScore
        )
        .slice(0, limit);
};


module.exports = {
    cosineSimilarity,
    searchRelevantRules
};