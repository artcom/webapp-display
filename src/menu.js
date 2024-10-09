const { app, Menu } = require("electron")

module.exports = function createMenu() {
  const template = [
    {
      label: app.getName(),
      submenu: [
        {
          role: "about",
        },
        {
          type: "separator",
        },
        {
          role: "services",
          submenu: [],
        },
        {
          type: "separator",
        },
        {
          role: "hide",
        },
        {
          role: "hideothers",
        },
        {
          role: "unhide",
        },
        {
          type: "separator",
        },
        {
          label: "Copy",
          accelerator: process.platform === "darwin" ? "Cmd+C" : "Ctrl+C",
          selector: "copy:",
        },
        {
          label: "Paste",
          accelerator: process.platform === "darwin" ? "Cmd+V" : "Ctrl+V",
          selector: "paste:",
        },
        {
          type: "separator",
        },
        {
          role: "quit",
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Show GPU Flags",
          accelerator: "CommandOrControl+G",
          click(item, window) {
            window.loadURL("chrome://gpu")
          },
        },
        {
          type: "separator",
        },
        {
          label: "Reload",
          accelerator: "CommandOrControl+R",
          click(item, window) {
            if (window) {
              window.reload()
            }
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator: process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
          click(item, window) {
            if (window) {
              window.webContents.toggleDevTools()
            }
          },
        },
        {
          label: "Toggle Window Always on Top",
          accelerator: "CommandOrControl+T",
          click(item, window) {
            if (window) {
              window.setAlwaysOnTop(!window.isAlwaysOnTop(), "pop-up-menu")
            }
          },
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
