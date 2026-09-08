const {
    generateEmbedding,
    moderateWithAI
} = require("./ai.service");

const {
    searchRelevantRules
} = require("./rag.service");


const moderateContent = async ({
    title,
    content
}) => {

    if (!title || !content) {
        throw new Error(
            "Title and content are required for moderation"
        );
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle || !cleanContent) {
        throw new Error(
            "Title and content cannot be empty"
        );
    }

    /**
     * Combine title and content because both
     * can contain moderation violations.
     */
    const text = `Title: ${cleanTitle}\n\nContent: ${cleanContent}`;

    /**
     * STEP 1:
     * Generate embedding
     */
    const embedding = await generateEmbedding(text);

    /**
     * STEP 2:
     * Search relevant moderation rules
     */
    const relevantRules = await searchRelevantRules(
        embedding,
        {
            limit: 5,
            minScore: 0.25
        }
    );

    /**
     * STEP 3:
     * Send content + retrieved rules to AI
     */
    const aiResult = await moderateWithAI({
        title: cleanTitle,
        content: cleanContent,
        rules: relevantRules
    });

    /**
     * STEP 4:
     * Normalize AI result
     */
    return {
        ...aiResult,

        retrievedRules: (relevantRules || []).map((rule) => ({
            ruleId: rule.ruleId,
            ruleName: rule.ruleName,
            category: rule.category,
            similarityScore: rule.similarityScore
        })),

        moderatedAt: new Date()
    };
};


module.exports = {
    moderateContent
};