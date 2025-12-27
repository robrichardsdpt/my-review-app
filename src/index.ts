import { Probot } from "probot";
import { OpenAI } from "openai";

// Initialize the GitHub Models client
const aiClient = new OpenAI({
  baseURL: "https://models.github.ai/inference",
  apiKey: process.env.GITHUB_MODELS_TOKEN,
});

export default (app: Probot) => {
  app.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async (context) => {
      const { owner, repo, pull_number } = context.pullRequest();
      const head_sha = context.payload.pull_request.head.sha;

      // 1. Get the list of files changed
      const { data: files } = await context.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number,
      });

      for (const file of files) {
        // Skip deleted files, binaries, or giant files
        if (file.status === "removed" || !file.patch || file.changes > 500)
          continue;

        // Filter for specific extensions
        const supportedExtensions = [".ts", ".js", ".py", ".go", ".java"];
        if (!supportedExtensions.some((ext) => file.filename.endsWith(ext)))
          continue;

        try {
          // 2. Request Review from GitHub Models
          const response = await aiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a Senior Staff Engineer. Your goal is to provide high-impact code reviews. 
              - Ignore style/formatting (assume a linter handles it).
              - Focus on logic errors, security vulnerabilities, and performance bottlenecks.
              - Be concise and professional. 
              - If the code is good, do not comment.`,
              },
              {
                role: "user",
                content: `Review this diff for ${file.filename}:\n\n${file.patch}`,
              },
            ],
          });

          const feedback = response.choices[0].message.content;

          // 3. Post as a Review Comment (Inline)
          if (feedback && feedback.length > 10) {
            await context.octokit.pulls.createReviewComment({
              owner,
              repo,
              pull_number,
              body: `**Senior AI Review:**\n\n${feedback}`,
              commit_id: head_sha,
              path: file.filename,
              subject_type: "file",
            });
          }
        } catch (error) {
          app.log.error(`Failed to review ${file.filename}: ${error}`);
        }
      }
    }
  );
};
