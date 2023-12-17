import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { TextComponent,
         TEXT_COMPONENT_STYLE_NONE,
         TEXT_COMPONENT_STYLE_HOVER_TOP,
         TEXT_COMPONENT_STYLE_HOVER_RIGHT,
         TEXT_COMPONENT_STYLE_HOVER_LEFT,
         TEXT_COMPONENT_STYLE_SELECTED
       } from '../src/components';
import { Config } from '../src/config';


describe('TextComponent', () => {
  it('can change styles properly (non root)', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');
    document.body.innerHTML = html;
    
    const g = document.getElementById('overlay');
    const config = new Config();
    // lightモード
    config.darkMode = false;
    // 非root
    const isRoot = false;
    
    const textComponent = new TextComponent(g, isRoot, config);
    
    textComponent.setText('test');
    textComponent.setPos(0, 0);
    
    expect(textComponent.isVisible).toBe(true);
    
    // classは'node'のみ
    expect(textComponent.foreignObject.classList.length).toBe(1);

    // none
    textComponent.setStyle(TEXT_COMPONENT_STYLE_NONE);
    expect(textComponent.foreignObject.classList.length).toBe(1);
    expect(textComponent.foreignObject.classList.contains('node')).toBe(true);

    // selected
    textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);
    expect(textComponent.foreignObject.classList.length).toBe(2);
    expect(textComponent.foreignObject.classList.contains('node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-selected-light')).toBe(true);

    // top
    textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_TOP);
    expect(textComponent.foreignObject.classList.length).toBe(2);
    expect(textComponent.foreignObject.classList.contains('node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-top-overlapped-light')).toBe(true);

    // right
    textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_RIGHT);
    expect(textComponent.foreignObject.classList.length).toBe(2);
    expect(textComponent.foreignObject.classList.contains('node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-right-overlapped-light')).toBe(true);

    // left
    textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_LEFT);
    expect(textComponent.foreignObject.classList.length).toBe(2);
    expect(textComponent.foreignObject.classList.contains('node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-left-overlapped-light')).toBe(true);

    textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);
    
    config.darkMode = true;
    textComponent.applyConfig(config);
    textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);

    // dark, selected
    expect(textComponent.foreignObject.classList.length).toBe(2);
    expect(textComponent.foreignObject.classList.contains('node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-selected-dark')).toBe(true);
  });
});


describe('TextComponent', () => {
  it('can change styles properly (root)', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');
    document.body.innerHTML = html;
    
    const g = document.getElementById('overlay');
    const config = new Config();
    // lightモード
    config.darkMode = false;
    // root
    const isRoot = true;
    
    const textComponent = new TextComponent(g, isRoot, config);
    
    textComponent.setText('test');
    textComponent.setPos(0, 0);
    
    expect(textComponent.isVisible).toBe(true);
    
    // classは'root-node'と'with-back-light'のみ
    expect(textComponent.foreignObject.classList.length).toBe(2);
    expect(textComponent.foreignObject.classList.contains('root-node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('with-back-light')).toBe(true);
    
    // none
    textComponent.setStyle(TEXT_COMPONENT_STYLE_NONE);
    expect(textComponent.foreignObject.classList.length).toBe(2);
    expect(textComponent.foreignObject.classList.contains('root-node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('with-back-light')).toBe(true);
    
    // selected
    textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);
    expect(textComponent.foreignObject.classList.length).toBe(3);
    expect(textComponent.foreignObject.classList.contains('root-node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('with-back-light')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-selected-light')).toBe(true);

    // top
    textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_TOP);
    expect(textComponent.foreignObject.classList.length).toBe(3);
    expect(textComponent.foreignObject.classList.contains('root-node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('with-back-light')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-top-overlapped-light')).toBe(true);

    // right
    textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_RIGHT);
    expect(textComponent.foreignObject.classList.length).toBe(3);
    expect(textComponent.foreignObject.classList.contains('root-node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('with-back-light')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-right-overlapped-light')).toBe(true);

    // left
    textComponent.setStyle(TEXT_COMPONENT_STYLE_HOVER_LEFT);
    expect(textComponent.foreignObject.classList.length).toBe(3);
    expect(textComponent.foreignObject.classList.contains('root-node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('with-back-light')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-left-overlapped-light')).toBe(true);

    textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);
    
    config.darkMode = true;
    textComponent.applyConfig(config);
    textComponent.setStyle(TEXT_COMPONENT_STYLE_SELECTED);

    // dark, selected
    expect(textComponent.foreignObject.classList.length).toBe(3);
    expect(textComponent.foreignObject.classList.contains('root-node')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('with-back-dark')).toBe(true);
    expect(textComponent.foreignObject.classList.contains('node-selected-dark')).toBe(true);
  });
});
