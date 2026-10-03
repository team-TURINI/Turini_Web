import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire, Module} from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const cache = new Map();
let editorHooks = null;
function loadComponent(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions:{
    module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true,
  }}).outputText;
  const compiledModule = new Module(filename);
  cache.set(filename, compiledModule);
  const localRequire = createRequire(filename);
  compiledModule.require = (name) => {
    // The test harness runs only the editor directly; nested SSR components use React's real hooks.
    /* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps */
    if (name === 'react') return {...React,
      useState: initial => {
        if (!editorHooks) return React.useState(initial);
        const hooks = editorHooks;
        const index = hooks.index++;
        if (!(index in hooks.state)) hooks.state[index] = initial;
        return [hooks.state[index], value => {hooks.state[index] = typeof value === 'function' ? value(hooks.state[index]) : value;}];
      },
      useMemo: (compute, dependencies) => editorHooks ? compute() : React.useMemo(compute, dependencies),
    };
    /* eslint-enable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps */
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
  for (const file of ['chef_hat-original-overlay.png','black_square-overlay.webp','blue_scarf-overlay.webp','green_original-overlay.webp','forest_class.png','turini-base-front.png']) assert.ok(html.includes(file), file);
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
  for (const file of ['chef_hat-original-overlay.png','black_square-overlay.webp','blue_scarf-overlay.webp','green_original-overlay.webp','forest_class.png']) assert.ok(!cleared.includes(file),file);
  assert.ok(cleared.includes('turini-base-front.png'));
});

test('profile and dress-up render identical foreground character layers for the same saved items', () => {
  const profile = renderProfile(equipped);
  const editor = renderToStaticMarkup(React.createElement(TuriniDressUp,{customization:equipped,stats:{xp:99999,level:99,streak:999,solved:9999,categoryLessons:{}},saving:false,onChange:()=>{}}));
  const character = html => html.match(/<span class="turini-dress__turn"[\s\S]*?<\/span><\/span>/)?.[0];
  assert.ok(character(profile));
  assert.equal(character(editor),character(profile));
});

function editorHarness(customization = equipped, stats = {xp:99999,level:99,streak:999,solved:9999,categoryLessons:{}}) {
  const hooks = {state:[],index:0};
  const editor = {
    customization,
    render() {
      hooks.index = 0;
      editorHooks = hooks;
      try {
        return TuriniDressUp({customization:editor.customization,
          stats,
          saving:false,onChange:next => {editor.customization = next;}});
      } finally {editorHooks = null;}
    },
  };
  return editor;
}
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [node,...elements(node.props.children)];
}
function pressTab(editor, name) {
  const button = elements(editor.render()).find(node => node.props.role === 'tab' && node.props.children === name);
  assert.ok(button, name);
  button.props.onClick();
}
function pressDirection(editor, name) {
  const button = elements(editor.render()).find(node => node.props.className === 'turini-dress__view' && node.props.children === name);
  assert.ok(button, name);
  button.props.onClick();
}

test('back controls exist only on the bag tab and leaving it returns to the front without changing saved items', () => {
  const editor = editorHarness();
  for (const name of ['모자','안경','목 액세서리','배경']) {
    pressTab(editor,name);
    const html = renderToStaticMarkup(editor.render());
    assert.ok(!html.includes('aria-label="보는 방향"'),name);
    assert.ok(html.includes('data-view="front"'),name);
  }
  pressTab(editor,'가방');
  pressDirection(editor,'뒷면');
  assert.ok(renderToStaticMarkup(editor.render()).includes('data-view="back"'));
  pressTab(editor,'모자');
  assert.ok(renderToStaticMarkup(editor.render()).includes('data-view="front"'));
  pressTab(editor,'가방');
  assert.ok(renderToStaticMarkup(editor.render()).includes('data-view="front"'));
  assert.deepEqual(editor.customization,equipped);
});

test('all nine bags use their approved complete back image and clearing the bag shows the bare back', () => {
  const editor = editorHarness();
  pressTab(editor,'가방');
  pressDirection(editor,'뒷면');
  const bags = ['black_business','mint_bubble','navy_school','green_original','purple_star','red_hiking','tan_explorer','yellow_giraffe','pink_heart'];
  for (const bag of bags) {
    editor.customization = {...equipped,bag:`bag:${bag}`};
    const html = renderToStaticMarkup(editor.render());
    const back = html.match(/<span class="turini-dress__turn" data-view="back"[\s\S]*?<\/span>/)?.[0];
    assert.ok(back,bag);
    assert.ok(back.includes(`/assets/worn-back/bags/${bag}-worn-back.png`),bag);
    assert.equal((back.match(/<img /g)||[]).length,1,bag);
    for (const other of ['turini-base-back.png','chef_hat','blue_scarf','black_square']) assert.ok(!back.includes(other),`${bag}: ${other}`);
    assert.ok(html.includes('forest_class.png'));
    assert.ok(!html.includes('뒷면은 아직 업데이트되지 않았어요'));
  }
  const clear = elements(editor.render()).find(node => node.props.className === 'turini-dress__item turini-dress__item--none');
  clear.props.onClick();
  const cleared = renderToStaticMarkup(editor.render());
  assert.ok(cleared.includes('/assets/worn-back/turini-base-back.png'));
  assert.ok(!cleared.includes('/assets/worn-back/bags/'));
  assert.equal(editor.customization.hat,equipped.hat);
});

test('bag selection cards follow front/back direction, including locked bags, without changing equipped items', () => {
  const bags = ['black_business','mint_bubble','navy_school','green_original','purple_star','red_hiking','tan_explorer','yellow_giraffe','pink_heart'];
  for (const stats of [undefined,{xp:0,level:1,streak:0,solved:0,categoryLessons:{}}]) {
    const editor = editorHarness(equipped,stats);
    pressTab(editor,'가방');
    pressDirection(editor,'뒷면');
    const back = renderToStaticMarkup(editor.render());
    for (const bag of bags) {
      const src = `/assets/worn-back-thumb/bags/${bag}-worn-back.webp`;
      assert.ok(back.includes(src),bag);
      assert.ok(existsSync(fileURLToPath(new URL(`../public${src}`,import.meta.url))),bag);
    }
    assert.ok(!back.includes('/assets/worn-front-thumb/bags/'));
    if (stats) assert.ok(back.includes('data-state="locked"'));
    pressDirection(editor,'정면');
    const front = renderToStaticMarkup(editor.render());
    for (const bag of bags) assert.ok(front.includes(`/assets/worn-front-thumb/bags/${bag}-worn-front.webp`),bag);
    assert.ok(!front.includes('/assets/worn-back-thumb/bags/'));
    assert.deepEqual(editor.customization,equipped);
  }
});
