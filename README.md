Retrace

Local-First Context & Workflow Intelligence for VS Code

Retrace automatically captures how you work inside VS Code and turns your coding activity into a visual, searchable history of your development workflow.

Instead of trying to remember “What was I doing here?”, Retrace lets you retrace the path you actually took — across files, branches, repositories, sessions, and code changes.

Your workflow stays local-first, with activity stored on your machine rather than requiring a cloud dashboard or external productivity service.

✦ Why Retrace?

Modern development rarely happens in a straight line.

You open a component → jump into an API → inspect a database file → switch branches → return to the original component → experiment somewhere else → come back hours later.

A few days later, you know the code works — but you don't necessarily remember how you got there.

Retrace turns that fragmented journey into something you can explore.

Don't just track what you coded. Retrace how you got there.

✦ What Retrace Does
🧭 Visual Workflow Timeline

Retrace builds an interactive timeline of your development activity, connecting the files and contexts you moved through during your sessions.

Instead of a list of timestamps, you get a visual representation of your workflow.

⏱️ Active Time Tracking

Retrace tracks meaningful activity on a per-file basis, helping distinguish actual work from time when VS Code was simply left open.

🌿 Git & Branch Context

Your workflow is associated with the repository and Git branch you were working in, making it easier to understand how different development threads evolved.

✏️ Code Change Intelligence

Track line additions and deletions associated with your workflow, giving historical context to the work you performed.

🎯 Cursor & Range Bookmarks

Retrace remembers important cursor positions and code ranges so you can jump back into the exact area that mattered.

⚡ Smart Idle Detection

Retrace automatically detects periods of inactivity instead of blindly counting every minute that VS Code remains open.

🔎 Searchable History

Find previous activity across your local development history instead of manually digging through files and remembering where you worked.

🔐 Local-First by Design

Your workflow history is designed to remain on your machine.

Retrace uses local storage and does not require a cloud account simply to understand your own development history.

📤 Workflow Sharing

Turn a development journey into a shareable representation for retrospectives, debugging, collaboration, or documenting how a feature was built.

✦ The Retrace Experience
Open Component
      │
      ▼
   API Route
      │
      ▼
 Database Schema
      │
      ▼
 Git Branch
      │
      ▼
   Bug Fix
      │
      ▼
 Back to Component

Retrace transforms this invisible sequence into an interactive workflow you can navigate, inspect, and revisit.

✦ Built for Developers

Retrace is designed to stay out of your way.

There is no daily timesheet to maintain.

No manual “start tracking” button.

No requirement to constantly categorize your work.

No need to reconstruct your day from memory.

You simply code.

Retrace builds the context in the background.

✦ Privacy First

Developer activity can contain extremely sensitive information.

Retrace therefore follows a local-first architecture:

🖥️ Activity history stored locally
🔒 No cloud account required for core functionality
🗃️ Local SQLite-based storage
🚫 No productivity telemetry dashboard required
🧩 Designed to work without sending your workflow history to a remote service
📤 Sharing is explicit rather than automatic

Your development history should belong to you.

✦ Architecture

Retrace is built around a lightweight local pipeline:

VS Code Editor Events
        │
        ▼
Workspace Listener
        │
        ▼
Noise Filtering
        │
        ▼
Session Aggregator
        │
        ▼
Smart Idle Detection
        │
        ▼
Local SQLite Database
        │
        ▼
Workflow Graph Engine
        │
        ▼
Interactive React Flow Timeline
        │
        ▼
Export / Sharing
Core technologies
TypeScript
VS Code Extension API
React
React Flow
SQLite via sql.js / WASM
Vite
esbuild
Tailwind CSS
Dagre
Vitest
✦ Designed Around Your Workflow

Retrace isn't intended to replace Git.

Git tells you:

What changed?

Retrace adds another dimension:

What was I doing?

Together, they provide a richer picture of development history.

✦ Use Cases
🐛 Debugging

Forgot which files you touched while investigating a bug?

Retrace the workflow.

🔄 Returning to an Old Feature

Coming back to a project after several days?

See where you left off.

🧠 Context Recovery

Lost your mental context after switching tasks?

Follow your previous development path.

📋 Retrospectives

Understand how a feature or bug-fix actually unfolded.

🤝 Workflow Sharing

Share the development journey behind a feature without manually documenting every step.

🕐 Personal Development History

Build a private, searchable history of your coding sessions.

✦ Philosophy

Retrace is built around a simple idea:

Your development history is more than your Git commits.

The files you opened.

The branches you switched between.

The places you investigated.

The changes you made.

The paths you abandoned.

The paths you returned to.

All of that forms context.

Retrace makes that context visible.

✦ Project Status

🚧 Early Development / Public Preview

Retrace is actively being developed.

The current version focuses on the foundation:

Workflow tracking
Active-time measurement
Smart idle detection
File and branch context
Workflow visualization
Local persistence
Search and navigation
Cursor/range history
Workflow export and sharing

More advanced workflow intelligence is planned as the project evolves.

✦ Roadmap
 Local activity tracking
 Active time per file
 Smart idle detection
 Line change tracking
 Cursor/range bookmarks
 Git repository & branch context
 Interactive workflow visualization
 Local SQLite persistence
 Workflow export
 Workflow sharing
 Automated tests
 Advanced workflow clustering
 Deeper project-level insights
 More powerful historical search
 Advanced analytics
 Additional workflow intelligence
✦ Philosophy

Local by default.
Automatic by design.
Context over metrics.

Retrace isn't here to tell developers to work harder.

It's here to help them remember what they already did.
