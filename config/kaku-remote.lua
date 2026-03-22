-- kaku-remote: tmux-based session sharing for Kaku terminal
local M = {}

function M.apply(config)
  config.default_prog = {
    '/bin/sh', '-c',
    'if /opt/homebrew/bin/tmux has-session -t main 2>/dev/null; then '
    .. 'exec /opt/homebrew/bin/tmux new-session -t main \\; set destroy-unattached on \\; new-window; '
    .. 'else exec /opt/homebrew/bin/tmux new-session -s main \\; set destroy-unattached on; fi'
  }
end

return M
