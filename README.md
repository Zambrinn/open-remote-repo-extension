# Open GitHub Remote

Open the GitHub `origin` remote for the current repository in your browser, with an optional base path between owner and repo for enterprise setups.

## Features

- Open the `origin` remote in your default browser.
- Status bar buttons for quick access.
- Optional base path between owner and repo (example: `owner/basePath/repo`).

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

## Base Path

Some environments need an extra path segment between `owner` and `repo`.
Example base path: `copilot-corp`

### Result Example

- Default: `https://github.com/owner/repo`
- With base path: `https://github.com/owner/copilot-corp/repo`

## Settings

- `openGithubRemote.basePath` (string, default: empty)

## Build

- `npm run compile`
- `npm run watch`
