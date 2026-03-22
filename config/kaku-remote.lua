-- kaku-remote: tmux-first for Kaku terminal
local M = {}

function M.apply(config)
  -- tmux-first: launch tmux directly (no external script)
  config.default_prog = { '/opt/homebrew/bin/tmux', 'new-session', '-A', '-s', 'main' }
end

return M
