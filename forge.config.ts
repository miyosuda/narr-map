import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

import 'dotenv/config';

let osxSign = null
let osxNotarize = null

if(process.env['APPLEIDENTITY'] != null) {
  osxSign = {
    "identity": process.env.APPLEIDENTITY,
    optionsForFile: (filePath : string) => {
        return {
          entitlements: 'entitlements.plist'
        }
      }
  }
  osxNotarize = {
    "appleId": process.env.APPLEID,
    "appleIdPassword": process.env.APPLEIDPASS,
    "teamId": process.env.APPLETEAMID,
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    "icon": "build/icon.icns",
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({})
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/settings.html',
            js: './src/settings.tsx',
            name: 'settings'
          },
        ],
      },
    }),
  ],
};

if(osxSign != null) {
  config["packagerConfig"]["osxSign"] = osxSign
}
if(osxNotarize != null) {
  config["packagerConfig"]["osxNotarize"] = osxNotarize
}

export default config;
