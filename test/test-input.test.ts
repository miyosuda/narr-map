import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { TextInput } from '../src/text-input';
import { Config } from '../src/config';
import { Node } from '../src/node';


describe('TextInput', () => {
  it('can show, and can hide', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');
    document.body.innerHTML = html;
    
    const g = document.getElementById('overlay');
    const config = new Config();
    config.darkMode = false;
    
    const rightRootNode = new Node(null, g, config);
    rightRootNode.setText('root');
    
    const onTextDecidedCallback = (node : Node, changed : boolean) => {
      expect(node.text).toBe('test_text');
      expect(changed).toBe(true);
    };
    
    const textInput = new TextInput(onTextDecidedCallback);
    textInput.applyConfig(config);
    
    textInput.show(rightRootNode);
    
    expect(textInput.isShown).toBe(true);
    
    textInput.input.value = 'test_text'
    
    textInput.onTextChange();
    
    expect(textInput.isShown).toBe(false);
  });
});
