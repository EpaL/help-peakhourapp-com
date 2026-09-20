---
name: finish-story
description: >-
  Complete a Story from Shortcut on the help site. Use when the user is done
  with a Shortcut story — builds the Astro site, commits and pushes, opens a
  PR, comments on the story, and moves it to Ready for Review.
---

# finish-story

Complete a story from Shortcut for the help.peakhourapp.com Astro site.

1. Build the site with `npm run build`. If the build fails, report the errors and stop.
2. If the story involved UI/content changes, visually verify it — run `npm run dev` and check the affected page(s), or use the `/verify` skill.
3. Stage and commit all changes:
   - Run `git add -A` to stage changes.
   - Run `git diff --cached --stat` to show what will be committed.
   - Compose a descriptive commit message referencing the story and run `git commit`.
4. Push the branch: `git push -u origin HEAD`.
5. Open a pull request against `main` using `gh pr create`, with a title and body referencing the story.
6. Post a brief summary of what was done / what was fixed as a comment on the story using the Shortcut MCP `stories-create-comment` tool. Include the PR link.
7. Fetch the workspace workflows using the Shortcut MCP `workflows-list` or `workflows-get-default` tool to find the ID of the state corresponding to "Ready for Review".
8. Move the Shortcut story to "Ready for Review" using the Shortcut MCP `stories-update` tool with the resolved `workflow_state_id`.
9. Report a summary of what was committed, pushed, the PR link, and the story status.
