---
name: start-story
description: >-
  Start working on a Story from Shortcut. Use when the user wants to begin a
  Shortcut story — fetches the story, assigns it, moves it to In Development,
  and creates a git branch.
---

# start-story

Start working on a Story from Shortcut.

1. Ask the user for the Shortcut story ID (if not provided).
2. Use the Shortcut MCP `stories-get-by-id` tool to fetch the story details.
3. Display the story title, description, and acceptance criteria to the user.
4. Assign the current user to the story using the Shortcut MCP `stories-assign-current-user` tool (if not already assigned).
5. Fetch the workspace workflows using the Shortcut MCP `workflows-list` or `workflows-get-default` tool to find the ID of the state corresponding to "In Development" or "In Progress".
6. Move the story to "In Development" using the Shortcut MCP `stories-update` tool with the resolved `workflow_state_id`.
7. Create a new git branch from the current branch:
   - Use the Shortcut MCP `stories-get-branch-name` tool to get the suggested branch name.
   - Run `git checkout -b <branch-name>`.
8. Confirm the branch was created and the story is in development.
9. Immediately proceed to plan/implement the story — do not ask the user if they want to start.
