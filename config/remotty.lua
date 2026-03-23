-- remotty: tmux-based session sharing for terminal
local M = {}

function M.apply(config)
  config.default_prog = {
    '/bin/sh', '-c',
    'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; '
    .. 'if tmux has-session -t remotty 2>/dev/null; then '
    .. 'exec tmux new-session -t remotty \\; set destroy-unattached on \\; new-window; '
    .. 'else exec tmux new-session -s remotty \\; set destroy-unattached on; fi'
  }
end

return M
