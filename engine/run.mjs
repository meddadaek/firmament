// Starts the Python engine with the project's virtualenv on any OS: `npm run engine`.
// `npm run test:engine` runs the pytest suite instead.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const venvPython = process.platform === 'win32' ? join(here, '.venv', 'Scripts', 'python.exe') : join(here, '.venv', 'bin', 'python')
const python = existsSync(venvPython) ? venvPython : 'python'
if (python === 'python') console.warn('engine/.venv not found; using system python. See README for setup.')

const args = process.argv.includes('--test') ? ['-m', 'pytest', '-q'] : ['-m', 'firmament.server']
const child = spawn(python, args, { cwd: here, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
