import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire, Module} from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const cache = new Map();
function loadComponent(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions:{
    module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true,
  }}).outputText;
  const compiledModule = new Module(filename);
  cache.set(filename, compiledModule);
  const localRequire = createRequire(filename);
  compiledModule.require = (name) => {
    if (name === 'next/image') return {__esModule:true, default:(props) => {const imageProps = {...props}; for (const key of ['fill','unoptimized','sizes']) delete imageProps[key]; return React.createElement('img', imageProps);}};
    if (name === './turini-motion') return loadComponent(fileURLToPath(new URL('../app/turini-motion.tsx', import.meta.url)));
    if (name === './avatar-items') return loadComponent(fileURLToPath(new URL('../app/avatar-items.ts', import.meta.url)));
    return localRequire(name);
  };
  compiledModule._compile(compiled, filename);
  return compiledModule.exports;
}
const {CustomizedTuriniAvatar, TuriniAvatarProvider, TuriniDressUp} = loadComponent(fileURLToPath(new URL('../app/turini-avatar.tsx', import.meta.url)));
const equipped = {hat:'hat:chef_hat',glasses:'glasses:black_square',neck:'neck:blue_scarf',bag:'bag:green_original',background:'background:forest_class'};
const renderProfile = customization => renderToStaticMarkup(React.createElement(TuriniAvatarProvider,{customization},React.createElement(CustomizedTuriniAvatar)));

test('profile renders all five saved customization slots and uses the original chef hat', () => {
  const html = renderProfile(equipped);
  for (const file of ['chef_hat-original-overlay.png','black_square.png','blue_scarf.png','green_original-worn-front.png','forest_class.png','turini-base-front.png']) assert.ok(html.includes(file), file);
  assert.ok(html.includes('data-view="front"'));
  assert.ok(html.includes('turini-dress__hat-canvas--chef'));
});

test('changing or clearing saved customization replaces all profile layers without leftover items', () => {
  const changed = renderProfile({...equipped,hat:'hat:red_beanie',background:'background:study_room_day'});
  assert.ok(changed.includes('red_beanie-overlay.webp'));
  assert.ok(changed.includes('study_room_day.png'));
  assert.ok(!changed.includes('chef_hat-original-overlay.png'));
  assert.ok(!changed.includes('forest_class.png'));
  const cleared = renderProfile({hat:null,glasses:null,neck:null,bag:null,background:null});
  for (const file of ['chef_hat-original-overlay.png','black_square.png','blue_scarf.png','green_original-worn-front.png','forest_class.png']) assert.ok(!cleared.includes(file),file);
  assert.ok(cleared.includes('turini-base-front.png'));
});

test('profile and dress-up render identical foreground character layers for the same saved items', () => {
  const profile = renderProfile(equipped);
  const editor = renderToStaticMarkup(React.createElement(TuriniDressUp,{customization:equipped,stats:{xp:99999,level:99,streak:999,solved:9999,categoryLessons:{}},saving:false,onChange:()=>{}}));
  const character = html => html.match(/<span class="turini-dress__turn"[\s\S]*?<\/span><\/span>/)?.[0];
  assert.ok(character(profile));
  assert.equal(character(editor),character(profile));
});
