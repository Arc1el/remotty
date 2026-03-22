-- kaku-remote: tmux-first + Tailscale status for Kaku terminal
-- Load via: local ok, remote = pcall(dofile, '.../kaku-remote.lua')
--           if ok and remote and remote.apply then remote.apply(config) end

local wezterm = require 'wezterm'
local M = {}

local STATUS_SCRIPT = '/Users/jayden/Documents/kaku-remote/scripts/status.sh'

function M.apply(config)
  -- tmux-first: each Kaku tab = new tmux window (auto-starts server too)
  config.default_prog = { '/bin/bash', '/Users/jayden/Documents/kaku-remote/scripts/kaku-tmux.sh' }

  -- Status bar: show Tailscale connection state
  local last_check = 0
  local cached_status = ''

  wezterm.on('update-status', function(window, pane)
    local now = os.time()
    if now - last_check < 3 then
      window:set_right_status(cached_status)
      return
    end
    last_check = now

    local success, stdout = wezterm.run_child_process({ '/bin/bash', STATUS_SCRIPT })
    local status_text = ''

    if success and stdout then
      local ts = stdout:match('tailscale=(%w+)')
      local ssh = stdout:match('ssh=(%w+)')
      local tmux_sess = stdout:match('tmux=(%S*)')

      if ts == 'true' and ssh == 'true' then
        status_text = wezterm.format {
          { Foreground = { Color = '#a6e3a1' } },
          { Text = ' Remote Ready ' },
        }
      elseif ts == 'true' then
        status_text = wezterm.format {
          { Foreground = { Color = '#f9e2af' } },
          { Text = ' SSH Off ' },
        }
      else
        status_text = ''
      end
    end

    cached_status = status_text
    window:set_right_status(status_text)
  end)
end

return M
