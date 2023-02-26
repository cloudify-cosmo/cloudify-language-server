import * as assert from 'assert';
import {
    lineIsLint,
    insertMessages,
    cfyLintMessage,
    assignSeverity
} from '../../cloudify/cfy-lint';

const validCfyLintItem = '{"level": "foo", "line": 0, "rule": "bar", "message": "foo"}';

function testLineIsLint() {
    assert.strictEqual(lineIsLint(validCfyLintItem), true);
    assert.strictEqual(lineIsLint('Bar'), false);
}

function testInsertMessages() {
    const validCfyLintItems:string = '\n' + validCfyLintItem + '\n';
    assert.strictEqual(insertMessages(validCfyLintItems).length, 1);
    assert.strictEqual(insertMessages('foo').length, 0);
}

function testAssignSeverity() {
    const validMessage:cfyLintMessage = JSON.parse(validCfyLintItem);
    assert.strictEqual(assignSeverity(validMessage), 1);
}

export function testLinting() {
    testLineIsLint();
    testInsertMessages();
    testAssignSeverity();
}
