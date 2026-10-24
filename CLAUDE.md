# Git Safety Policy — Mandatory

This project uses LOCAL DEVELOPMENT ONLY by default.

- Never execute `git push`, `git push origin`, or any command that uploads local commits to a remote repository unless I explicitly authorize that specific push.
- Never automatically commit, publish, deploy, or synchronize code to a remote repository.
- Never assume permission to push is included in a request to implement, fix, refactor, test, or complete a task.
- You may edit files, run tests, inspect Git status, and prepare local changes.
- Before a commit or push, wait for my explicit authorization.
- Never modify Git hooks, Git configuration, CI/CD workflows, or deployment automation to enable automatic publishing without my permission.
- If an existing automation pushes code automatically, identify its source and explain how to disable it.
- After completing a task, report the changed files and test results without pushing anything.

Default rule: NO AUTOMATIC GIT PUSH.