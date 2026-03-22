-- kaku-remote: tmux-first for Kaku terminal
local M = {}

function M.apply(config)
  -- tmux-first: each Kaku tab = new tmux window (auto-starts server too)
  config.default_prog = { '/bin/bash', '/Users/jayden/Documents/kaku-remote/scripts/kaku-tmux.sh' }
end

return M
