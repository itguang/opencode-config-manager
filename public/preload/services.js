const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const childProcess = require('node:child_process')

function getDefaultOpencodeConfigPath () {
  return path.join(os.homedir(), '.config', 'opencode', 'opencode.json')
}

function ensureParentDir (filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function resolveHomePath (targetPath) {
  if (!targetPath) return targetPath
  if (targetPath.startsWith('~/')) {
    return path.join(os.homedir(), targetPath.slice(2))
  }
  return targetPath
}

function createBackupPath (filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${filePath}.${stamp}.bak`
}

async function checkHttpEndpoint (url, options = {}) {
  if (!url) {
    return { ok: false, status: 0, message: 'Missing URL.' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 5000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: options.headers || {},
      signal: controller.signal,
    })

    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? 'Reachable.' : `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error.message,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

window.services = {
  getDefaultOpencodeConfigPath () {
    return getDefaultOpencodeConfigPath()
  },

  readOpencodeConfig ({ path: filePath } = {}) {
    const resolvedPath = resolveHomePath(filePath || getDefaultOpencodeConfigPath())
    if (!fs.existsSync(resolvedPath)) {
      return {
        exists: false,
        path: resolvedPath,
        text: '',
      }
    }

    return {
      exists: true,
      path: resolvedPath,
      text: fs.readFileSync(resolvedPath, { encoding: 'utf-8' }),
    }
  },

  writeOpencodeConfig ({ path: filePath, content, backup = true } = {}) {
    const resolvedPath = resolveHomePath(filePath || getDefaultOpencodeConfigPath())
    ensureParentDir(resolvedPath)

    let backupPath = ''
    if (backup && fs.existsSync(resolvedPath)) {
      backupPath = createBackupPath(resolvedPath)
      fs.copyFileSync(resolvedPath, backupPath)
    }

    fs.writeFileSync(resolvedPath, content, { encoding: 'utf-8' })

    return {
      path: resolvedPath,
      backupPath,
    }
  },

  checkPathExists ({ path: targetPath } = {}) {
    const resolvedPath = resolveHomePath(targetPath)
    return {
      exists: Boolean(resolvedPath) && fs.existsSync(resolvedPath),
      path: resolvedPath,
    }
  },

  checkEnvironmentVariable ({ name } = {}) {
    return {
      exists: Boolean(name) && typeof process.env[name] === 'string' && process.env[name].length > 0,
      name,
    }
  },

  async checkProviderEndpoint ({ baseURL, timeout } = {}) {
    return checkHttpEndpoint(baseURL, { timeout })
  },

  async checkRemoteMcp ({ url, headers, timeout } = {}) {
    return checkHttpEndpoint(url, { headers, timeout })
  },

  checkLocalCommandAvailable ({ command } = {}) {
    const firstToken = Array.isArray(command)
      ? command[0]
      : typeof command === 'string'
        ? command.trim().split(/\s+/)[0]
        : ''

    if (!firstToken) {
      return {
        available: false,
        message: 'Missing command.',
      }
    }

    const locator = process.platform === 'win32' ? 'where' : 'which'
    const result = childProcess.spawnSync(locator, [firstToken], {
      encoding: 'utf-8',
      windowsHide: true,
    })

    return {
      available: result.status === 0,
      message: result.status === 0 ? 'Command found.' : (result.stderr || result.stdout || 'Command not found.').trim(),
    }
  },
}
