import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext) {
  const openCommand = vscode.commands.registerCommand('openGithubRemote.open', async () => {
    const repoUrl = await getGithubRepoUrl();
    if (!repoUrl) {
      return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(repoUrl));
  });

  const setBasePathCommand = vscode.commands.registerCommand('openGithubRemote.setBasePath', async () => {
    const config = vscode.workspace.getConfiguration('openGithubRemote');
    const current = config.get<string>('basePath') ?? '';
    const input = await vscode.window.showInputBox({
      title: 'Set GitHub Base Path',
      prompt: 'Optional path between github.com and owner/repo, e.g. copilot-corp',
      value: current,
      placeHolder: 'Leave empty for the default github.com/owner/repo'
    });

    if (input === undefined) {
      return;
    }

    const cleaned = normalizeBasePath(input);
    await config.update('basePath', cleaned, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('Open GitHub Origin Remote: base path saved.');
  });

  const openStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  openStatusBarItem.text = '$(repo) Open Remote';
  openStatusBarItem.command = 'openGithubRemote.open';
  openStatusBarItem.tooltip = 'Open GitHub origin remote in your browser';
  openStatusBarItem.show();

  const setPathStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  setPathStatusBarItem.text = '$(settings-gear) Set Base Path';
  setPathStatusBarItem.command = 'openGithubRemote.setBasePath';
  setPathStatusBarItem.tooltip = 'Configure base path between owner and repo';
  setPathStatusBarItem.show();

  context.subscriptions.push(openCommand, setBasePathCommand, openStatusBarItem, setPathStatusBarItem);
}

export function deactivate() {
  // No-op
}

function toGithubHttpsUrl(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) {
    return null;
  }

  const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = sshMatch[2];
    return `https://github.com/${owner}/${repo}`;
  }

  const sshUrlMatch = /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed);
  if (sshUrlMatch) {
    const owner = sshUrlMatch[1];
    const repo = sshUrlMatch[2];
    return `https://github.com/${owner}/${repo}`;
  }

  const httpsMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed);
  if (httpsMatch) {
    const owner = httpsMatch[1];
    const repo = httpsMatch[2];
    return `https://github.com/${owner}/${repo}`;
  }

  return null;
}

async function getGithubRepoUrl(): Promise<string | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Open GitHub Origin Remote: open a workspace folder first.');
    return null;
  }

  let originUrl = '';
  try {
    const result = await execFileAsync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: workspaceFolder.uri.fsPath
    });
    originUrl = result.stdout.trim();
  } catch {
    vscode.window.showErrorMessage('Open GitHub Origin Remote: unable to read origin remote.');
    return null;
  }

  const repoUrl = toGithubHttpsUrl(originUrl);
  if (!repoUrl) {
    vscode.window.showErrorMessage('Open GitHub Origin Remote: origin is not a GitHub URL.');
    return null;
  }

  const config = vscode.workspace.getConfiguration('openGithubRemote');
  const basePath = normalizeBasePath(config.get<string>('basePath') ?? '');
  if (!basePath) {
    return repoUrl;
  }

  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(repoUrl);
  if (!match) {
    return repoUrl;
  }

  const owner = match[1];
  const repo = match[2];
  return `https://github.com/${owner}/${basePath}/${repo}`;
}

function normalizeBasePath(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}
