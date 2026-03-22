-- kaku-remote: tmux-based session sharing for Kaku terminal
local M = {}

function M.apply(config)
  config.default_prog = { '/opt/homebrew/bin/tmux', 'new-session', '-A', '-s', 'main' }
end

return M
