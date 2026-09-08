require("dotenv").config();
const OpenAI = require("openai");

// ============================================================
// GEMINI CONFIGURATION & CLIENT
// ============================================================

let gemini = null;

const getGeminiClient = () => {
    if (!gemini) {
        const apiKey = process.env.GEMINI_API_KEY;
        const baseURL =
            process.env.GEMINI_BASE_URL ||
            "https://generativelanguage.googleapis.com/v1beta/openai";

        if (!apiKey) {
            throw new Error(
                "Gemini API key not configured. Set GEMINI_API_KEY in your .env file."
            );
        }

        gemini = new OpenAI({
            apiKey,
            baseURL
        });
    }
    return gemini;
};

const getEmbeddingModel = () =>
    process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";

const getModerationModel = () =>
    process.env.GEMINI_MODERATION_MODEL || "gemini-3.6-flash";


// ============================================================
// GENERATE EMBEDDING
// ============================================================

const generateEmbedding = async (text) => {

    const client = getGeminiClient();

    if (!text || typeof text !== "string") {
        throw new Error(
            "Text is required to generate embedding."
        );
    }

    const cleanText = text.trim();

    if (!cleanText) {
        throw new Error(
            "Text cannot be empty."
        );
    }

    try {

        console.log(
            "Generating Gemini embedding..."
        );

        const response =
            await client.embeddings.create({
                model: getEmbeddingModel(),
                input: cleanText
            });

        if (
            !response ||
            !response.data ||
            !response.data.length ||
            !response.data[0].embedding
        ) {
            throw new Error(
                "Gemini returned an invalid embedding response."
            );
        }

        const embedding =
            response.data[0].embedding;

        console.log(
            `Embedding generated successfully. Dimensions: ${embedding.length}`
        );

        return embedding;

    } catch (error) {

        console.error(
            "Gemini embedding error:",
            error.message
        );

        throw error;
    }
};


// ============================================================
// MODERATE CONTENT WITH GEMINI
// ============================================================

const moderateWithAI = async ({
    title,
    content,
    rules = []
}) => {

    const client = getGeminiClient();

    if (!title || !content) {
        throw new Error(
            "Title and content are required for moderation."
        );
    }


    // --------------------------------------------------------
    // Prepare rules
    // --------------------------------------------------------

    const rulesForAI = rules.map((rule) => ({

        ruleId:
            rule.ruleId || null,

        category:
            rule.category || null,

        categoryName:
            rule.categoryName || null,

        ruleName:
            rule.ruleName || null,

        description:
            rule.description || null,

        severity:
            rule.severity || null,

        action:
            rule.action || null,

        indicators:
            rule.indicators || [],

        examples:
            rule.examples || {
                violating: [],
                nonViolating: []
            },

        contextNotes:
            rule.contextNotes || null
    }));


    // --------------------------------------------------------
    // Prompt
    // --------------------------------------------------------

    const prompt = `
You are an AI content moderation system.

Your job is to analyze the user's post against the
moderation rules provided below.

You MUST return exactly ONE JSON object.

Do NOT return markdown.
Do NOT return explanations outside the JSON.
Do NOT wrap the JSON in triple backticks.

The response MUST follow this exact structure:

{
    "decision": "SAFE",
    "category": null,
    "severity": null,
    "ruleId": null,
    "confidence": 0.0,
    "reason": "",
    "matchedIndicators": []
}

Allowed decision values:

SAFE
FLAGGED
REVIEW
BLOCKED

Meaning:

SAFE:
The content does not violate any provided moderation rule.

FLAGGED:
The content likely violates a rule but does not require immediate blocking.

REVIEW:
The content is ambiguous and should be reviewed by a human moderator.

BLOCKED:
The content clearly violates a moderation rule whose action requires blocking.

IMPORTANT RULES:

1. Do not invent moderation rules.

2. Do not invent rule IDs.

3. If a violation exists, use a ruleId from the provided rules.

4. Consider the complete meaning and context of the content.

5. Do not classify content as harmful simply because it contains a
   keyword that appears in an indicator.

6. Educational, journalistic, fictional, reporting and discussion
   contexts may be allowed depending on the rule.

7. confidence must be a number between 0 and 1.

8. matchedIndicators must be an array of strings.

9. If there is no matching rule, use:
   decision = SAFE
   category = null
   severity = null
   ruleId = null

10. If you are uncertain whether the content violates a rule,
    use REVIEW.

------------------------------------------------------------
POST
------------------------------------------------------------

TITLE:
${title}

CONTENT:
${content}

------------------------------------------------------------
MODERATION RULES
------------------------------------------------------------

${JSON.stringify(
        rulesForAI,
        null,
        2
    )}

------------------------------------------------------------

Return ONLY valid JSON.
`;


    try {

        console.log(
            "Sending content to Gemini moderation..."
        );


        // ----------------------------------------------------
        // Gemini request
        // ----------------------------------------------------

        const response =
            await client.chat.completions.create({

                model: getModerationModel(),

                response_format: {
                    type: "json_object"
                },

                messages: [

                    {
                        role: "system",

                        content:
                            "You are a strict JSON-only content moderation system."
                    },

                    {
                        role: "user",

                        content: prompt
                    }

                ],

                temperature: 0
            });


        // ----------------------------------------------------
        // Get response text
        // ----------------------------------------------------

        let output =
            response
                ?.choices?.[0]
                ?.message
                ?.content;


        if (!output) {

            throw new Error(
                "Gemini returned an empty moderation response."
            );
        }


        // ----------------------------------------------------
        // Clean and parse JSON
        // ----------------------------------------------------

        let cleaned = output.trim();

        if (cleaned.includes("```")) {
            cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1").trim();
        }

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }

        let result;

        try {

            result = JSON.parse(cleaned);

        } catch (parseError) {

            console.error(
                "Gemini returned invalid JSON:"
            );

            console.error(output);

            throw new Error(
                "Gemini returned invalid JSON."
            );
        }


        // ----------------------------------------------------
        // Validate decision
        // ----------------------------------------------------

        const allowedDecisions = [
            "SAFE",
            "FLAGGED",
            "REVIEW",
            "BLOCKED"
        ];


        if (
            !allowedDecisions.includes(
                result.decision
            )
        ) {

            console.warn(
                "Invalid Gemini decision:",
                result.decision
            );

            result.decision = "REVIEW";
        }


        // ----------------------------------------------------
        // Validate confidence
        // ----------------------------------------------------

        let confidence =
            Number(result.confidence);


        if (
            Number.isNaN(confidence)
        ) {

            confidence = 0;
        }


        confidence =
            Math.max(
                0,
                Math.min(
                    1,
                    confidence
                )
            );


        result.confidence =
            confidence;


        // ----------------------------------------------------
        // Validate matched indicators
        // ----------------------------------------------------

        if (
            !Array.isArray(
                result.matchedIndicators
            )
        ) {

            result.matchedIndicators = [];
        }


        // ----------------------------------------------------
        // Validate string fields
        // ----------------------------------------------------

        result.category =
            typeof result.category === "string" ? result.category : null;

        result.severity =
            typeof result.severity === "string" ? result.severity : null;

        result.ruleId =
            typeof result.ruleId === "string" ? result.ruleId : null;

        result.reason =
            typeof result.reason === "string" ? result.reason : "";


        // ----------------------------------------------------
        // SAFE result normalization
        // ----------------------------------------------------

        if (
            result.decision === "SAFE"
        ) {

            result.category =
                null;

            result.severity =
                null;

            result.ruleId =
                null;

            result.matchedIndicators =
                [];
        }


        console.log(
            "Gemini moderation result:",
            result.decision
        );


        return result;

    } catch (error) {

        console.error(
            "Gemini moderation error:",
            error.message
        );

        throw error;
    }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    generateEmbedding,
    moderateWithAI
};
