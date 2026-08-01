import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leopard = readFileSync(new URL('../js/leopard.js', import.meta.url), 'utf8');
const dialogs = readFileSync(new URL('../js/system/dialogs.js', import.meta.url), 'utf8');

const timeMachineStart = leopard.indexOf('function openTimeMachine()');
const timeMachineEnd = leopard.indexOf('function startStarfield', timeMachineStart);
assert.notEqual(timeMachineStart, -1, 'Time Machine implementation is missing');
assert.notEqual(timeMachineEnd, -1, 'Time Machine implementation boundary is missing');
const timeMachine = leopard.slice(timeMachineStart, timeMachineEnd);

// Time Machine is a fixed overlay above ordinary windows, so its dialogs must
// be document-modal sheets parented to that overlay instead of normal windows.
assert.match(timeMachine, /System\.confirmSheet\(\{\s*parent:\s*overlay,/s);
assert.match(timeMachine, /showRestoreFailure[\s\S]*System\.showSheet\(\{\s*parent:\s*overlay,/);
assert.doesNotMatch(timeMachine, /System\.confirmBox\(/);
assert.doesNotMatch(timeMachine, /System\.alertBox\(/);

// Closing the full-screen interface must also unregister the sheet's global
// key handler; showSheet owns that cleanup through its close method.
assert.match(timeMachine, /node\._activeSheet\?\.close\?\.\('parent-close'\)/);
assert.match(dialogs, /parent\.appendChild\(shield\)/);
assert.match(dialogs, /removeEventListener\('keydown', keyHandler, true\)/);

console.log('Time Machine restore modal contract assertions passed');
