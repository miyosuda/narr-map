require('dotenv').config()

let osxSign = null
let osxNotarize = null

if(process.env['APPLEIDENTITY'] != null) {
  osxSign = {
    "identity": process.env.APPLEIDENTITY,
    "hardened-runtime": true,
    "entitlements": "entitlements.plist",
    "entitlements-inherit": "entitlements.plist",
    "signature-flags": "library"      
  }
  osxNotarize = {
    "appleId": process.env.APPLEID,
    "appleIdPassword": process.env.APPLEIDPASS,
  }
}


const config = {
  "packagerConfig": {
    "icon": "build/icon.icns",
  },
  "makers": [
    {
      "name": "@electron-forge/maker-squirrel",
      "config": {
        "name": "narr_map"
      }
    },
    {
      "name": "@electron-forge/maker-zip",
      "platforms": [
        "darwin"
      ]
    },
    {
      "name": "@electron-forge/maker-deb",
      "config": {}
    },
    {
      "name": "@electron-forge/maker-rpm",
      "config": {}
    }
  ],
  "plugins": [
    [
      "@electron-forge/plugin-webpack",
      {
        "mainConfig": "./webpack.main.config.js",
        "renderer": {
          "config": "./webpack.renderer.config.js",
          "entryPoints": [
            {
              "html": "./src/index.html",
              "js": "./src/renderer.js",
              "name": "main_window",
              "preload": {
                "js": "./src/preload.js"
              }
            }
          ]
        }
      }
    ]
  ]
}

if(osxSign != null) {
  config["packagerConfig"]["osxSign"] = osxSign
}
if(osxNotarize != null) {
  config["packagerConfig"]["osxNotarize"] = osxNotarize
}

module.exports = config
