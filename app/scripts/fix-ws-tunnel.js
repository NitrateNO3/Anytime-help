// @expo/ws-tunnel needs ws v8 (it uses `ws.WebSocket`), but npm resolves it to the
// hoisted ws v7 that react-native/metro need, which breaks `expo start --tunnel`
// with "s.WebSocket is not a constructor". Give ws-tunnel its own ws v8 copy.
const fs = require('fs');
const path = require('path');

const nm = path.join(__dirname, '..', 'node_modules');
const tunnelDir = path.join(nm, '@expo', 'ws-tunnel');
const target = path.join(tunnelDir, 'node_modules', 'ws');
const candidates = [path.join(nm, '@expo', 'cli', 'node_modules', 'ws'), path.join(nm, 'ws')];

const major = (dir) => {
  try {
    return parseInt(require(path.join(dir, 'package.json')).version, 10);
  } catch {
    return 0;
  }
};

if (!fs.existsSync(tunnelDir) || major(target) >= 8) process.exit(0);
const source = candidates.find((d) => major(d) >= 8);
if (!source) {
  console.warn('[fix-ws-tunnel] no ws v8 found; tunnel mode may not work');
  process.exit(0);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });
console.log('[fix-ws-tunnel] linked ws v8 into @expo/ws-tunnel');
