# Open GitHub Remote

Open the GitHub `origin` remote for the current repository in your browser. Optionally insert a base path between owner and repo for enterprise-style URLs.

## Features

- One-click open of the `origin` GitHub remote.
- Status bar buttons for quick access.
- Optional base path between owner and repo (example: `owner/basePath/repo`).

## Requirements

- The workspace folder must be a Git repository.
- The repository must have a configured `origin` remote.
- The `origin` remote must point to GitHub.

## Usage

1) Install dependencies: `npm install`
2) Press `F5` to launch the Extension Development Host.
3) Use one of the options below.

### Commands

- `Open GitHub Origin Remote`
- `Set GitHub Base Path`

### Status Bar

- `$(repo) Open Remote`
- `$(settings-gear) Set Base Path`

## Settings

- `openGithubRemote.basePath` (string, default: empty)

## Base Path Example

- Default: `https://github.com/owner/repo`
- With base path: `https://github.com/owner/copilot-corp/repo`

## Troubleshooting

### Unable to read origin remote

- Run `git remote -v` to confirm `origin` exists.
- If missing, set it with:
	`git remote add origin https://github.com/OWNER/REPO.git`

### Origin is not a GitHub URL

- Ensure `origin` is a GitHub URL (SSH or HTTPS).

## Development

- Build: `npm run compile`
- Watch: `npm run watch`
