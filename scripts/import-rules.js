require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const ModerationRule = require("../src/models/moderationRule.model");

const {
    generateEmbedding
} = require("../src/services/ai.service");


const KNOWLEDGE_BASE = path.join(
    __dirname,
    "../knowledge-base"
);


const connectDB = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");
};


const importRules = async () => {

    await connectDB();

    const files = fs.readdirSync(KNOWLEDGE_BASE);

    for (const file of files) {

        if (!file.endsWith(".json")) {
            continue;
        }

        console.log(`Processing ${file}...`);

        const filePath = path.join(
            KNOWLEDGE_BASE,
            file
        );

        const data = JSON.parse(
            fs.readFileSync(
                filePath,
                "utf8"
            )
        );

        for (const rule of data.rules) {

            console.log(
                `Generating embedding for ${rule.id}`
            );

            const embeddingText = `
Category:
${data.category}

Category Name:
${data.name}

Rule:
${rule.name}

Description:
${rule.description}

Severity:
${rule.severity}

Action:
${rule.action}

Indicators:
${(rule.indicators || []).join(", ")}

Violating Examples:
${(rule.examples?.violating || []).join("\n")}

Non-Violating Examples:
${(rule.examples?.non_violating || []).join("\n")}

Context:
${rule.context_notes || ""}
`;

            const embedding =
                await generateEmbedding(
                    embeddingText
                );

            await ModerationRule.findOneAndUpdate(
                {
                    ruleId: rule.id
                },
                {
                    ruleId: rule.id,

                    category:
                        data.category,

                    categoryName:
                        data.name,

                    version:
                        data.version,

                    ruleName:
                        rule.name,

                    description:
                        rule.description,

                    severity:
                        rule.severity,

                    action:
                        rule.action,

                    indicators:
                        rule.indicators || [],

                    examples: {
                        violating:
                            rule.examples?.violating || [],

                        nonViolating:
                            rule.examples?.non_violating || []
                    },

                    contextNotes:
                        rule.context_notes || "",

                    embedding
                },
                {
                    upsert: true,
                    new: true
                }
            );

            console.log(
                `${rule.id} imported`
            );
        }
    }

    console.log(
        "All moderation rules imported successfully."
    );

    await mongoose.disconnect();
};


importRules()
    .catch(async (error) => {

        console.error(
            "Import failed:",
            error
        );

        await mongoose.disconnect();

        process.exit(1);
    });