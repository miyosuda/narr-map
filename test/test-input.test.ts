import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { TextInput } from '../src/text-input';
import { Config } from '../src/config';
import { MapManager } from '../src/map-manager';
import { Node } from '../src/node';


describe('TextInput', () => {
  it('can show and hide', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');
    document.body.innerHTML = html;
    
    const mapManager = new MapManager();
    
    const g = document.getElementById('overlay');
    const config = new Config();
    config.darkMode = false;
    
    const rightRootNode = new Node(null, g, config);
    rightRootNode.setText('root');
    
    const textInput = new TextInput(mapManager);
    textInput.applyConfig(config);
    
    textInput.show(rightRootNode);
    
    expect(textInput.isShown).toBe(true);
    
    textInput.onTextChange();
    
    expect(textInput.isShown).toBe(false);
  });
});
