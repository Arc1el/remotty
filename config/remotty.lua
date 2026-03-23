-- remotty: tmux-based session sharing for terminal
local M = {}

function M.apply(config)
  config.default_prog = {
    '/bin/sh', '-c',
    'TMUX_BIN=$(command -v tmux); '
    .. 'if $TMUX_BIN has-session -t remotty 2>/dev/null; then '
    .. 'exec $TMUX_BIN new-session -t remotty \\; set destroy-unattached on \\; new-window; '
    .. 'else exec $TMUX_BIN new-session -s remotty \\; set destroy-unattached on; fi'
  }
end

return M
