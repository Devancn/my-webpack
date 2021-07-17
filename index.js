const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');
const babel = require('@babel/core');
const resolve = require('resolve').sync;

let ID = 0;

function createModuleInfo(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ast = parser.parse(content, {
    sourceType: 'module'
  })
  const deps = [];
  traverse(ast, {
    ImportDeclaration: ({node}) => {
      deps.push(node.source.value)
    }
  })
  const id = ID++;
  const {code} = babel.transformFromAstSync(ast,null, {
    presets: ["@babel/preset-env"]
  })
  return {
    id,
    filePath,
    deps,
    code
  }
}

function createDependencyGraph(entry) {
  // 获取模块信息
  const entryInfo = createModuleInfo(entry);
  // 以该模块为入口构建模块依赖树
  const graphArr = [];
  graphArr.push(entryInfo);
  for(const module of graphArr){
    module.map = {};
    module.deps.forEach(depPath => {
      const baseDir = path.dirname(module.filePath);
      const moduleDepPath = resolve(depPath, {baseDir})
      const moduleInfo = createModuleInfo(moduleDepPath);
      graphArr.push(moduleInfo);
      module.map[depPath] = moduleInfo.id;
    })
  }
  return graphArr;
}

function pack(graph) {
  const moduleArgArr = graph.map(module => {
    return `${module.id}: {
      factory: (exports, require) => {
        ${module.code}
      },
      map: ${JSON.stringify(module.map)}
    }`
  })
  const iifeBundler = `(function(modules){
    const require = id => {
      const {factory, map} = modules[id];
      const localRequire = requireDeclarationName => require(map[requireDeclarationName]);
      const module = {exports: {}};
      factory(module.exports, localRequire)
      return module.export
    }
    require(0)
  })({${moduleArgArr.join()}})`
}