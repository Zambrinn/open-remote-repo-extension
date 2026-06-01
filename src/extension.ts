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

  const openBranchCommand = vscode.commands.registerCommand('openGithubRemote.openBranch', async () => {
    const repoUrl = await getGithubRepoUrl();
    if (!repoUrl) {
      return;
    }

    const branch = await getCurrentBranch();
    if (!branch) {
      return;
    }

    const branchUrl = `${repoUrl}/tree/${encodeURIComponent(branch)}`;
    await vscode.env.openExternal(vscode.Uri.parse(branchUrl));
  });

  const compareBranchesCommand = vscode.commands.registerCommand('openGithubRemote.compareBranches', async () => {
    const repoUrl = await getGithubRepoUrl();
    if (!repoUrl) {
      return;
    }

    const defaultBranch = await getDefaultRemoteBranch();
    const currentBranch = await getCurrentBranch();

    const branches = await getLocalBranches();
    if (!branches.length) {
      vscode.window.showErrorMessage('Compare Branches: no local branches found.');
      return;
    }

    const baseItems = buildBranchItems(branches, defaultBranch, 'Default branch');
    const basePick = await vscode.window.showQuickPick(baseItems, {
      placeHolder: 'Select the base branch'
    });
    if (!basePick) {
      return;
    }

    const compareItems = buildBranchItems(branches, currentBranch, 'Current branch');
    const comparePick = await vscode.window.showQuickPick(compareItems, {
      placeHolder: 'Select the compare branch'
    });
    if (!comparePick) {
      return;
    }

    const compareUrl = `${repoUrl}/compare/${encodeURIComponent(basePick.label)}...${encodeURIComponent(comparePick.label)}`;
    await vscode.env.openExternal(vscode.Uri.parse(compareUrl));
  });

  const openStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  openStatusBarItem.text = '$(repo) Open Remote';
  openStatusBarItem.command = 'openGithubRemote.open';
  openStatusBarItem.tooltip = 'Open GitHub origin remote in your browser';
  openStatusBarItem.show();

  const branchStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  branchStatusBarItem.text = '$(git-branch) Open Branch';
  branchStatusBarItem.command = 'openGithubRemote.openBranch';
  branchStatusBarItem.tooltip = 'Open the current branch on GitHub';
  branchStatusBarItem.show();

  const compareStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
  compareStatusBarItem.text = '$(git-compare) Compare Branches';
  compareStatusBarItem.command = 'openGithubRemote.compareBranches';
  compareStatusBarItem.tooltip = 'Compare branches on GitHub';
  compareStatusBarItem.show();

  context.subscriptions.push(
    openCommand,
    openBranchCommand,
    compareBranchesCommand,
    setBasePathCommand,
    openStatusBarItem,
    branchStatusBarItem,
    compareStatusBarItem
  );
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

async function getCurrentBranch(): Promise<string | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Open GitHub Current Branch: open a workspace folder first.');
    return null;
  }

  try {
    const result = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workspaceFolder.uri.fsPath
    });
    const branch = result.stdout.trim();
    if (!branch || branch === 'HEAD') {
      vscode.window.showErrorMessage('Open GitHub Current Branch: detached HEAD state.');
      return null;
    }

    return branch;
  } catch {
    vscode.window.showErrorMessage('Open GitHub Current Branch: unable to read current branch.');
    return null;
  }
}

async function getDefaultRemoteBranch(): Promise<string | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return null;
  }

  try {
    const result = await execFileAsync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
      cwd: workspaceFolder.uri.fsPath
    });
    const ref = result.stdout.trim();
    const match = /refs\/remotes\/origin\/(.+)$/.exec(ref);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function getLocalBranches(): Promise<string[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return [];
  }

  try {
    const result = await execFileAsync('git', ['branch', '--format=%(refname:short)'], {
      cwd: workspaceFolder.uri.fsPath
    });
    return result.stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildBranchItems(
  branches: string[],
  preferred: string | null,
  preferredLabel: string
): vscode.QuickPickItem[] {
  const items = branches.map((branch) => ({ label: branch }));
  if (!preferred) {
    return items;
  }

  return items.map((item) =>
    item.label === preferred
      ? { ...item, description: preferredLabel }
      : item
  );
}

function normalizeBasePath(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}
