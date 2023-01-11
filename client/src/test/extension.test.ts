import * as assert from 'assert';
// import * as vscode from 'vscode';

import { deactivate } from '../extension';

suite('Client Extension Test Suite', () => {
    // vscode.window.showInformationMessage('Starting Client Extension Test Suite.');
    test('Deactivate Test', () => {
        const result = deactivate();
        assert.strictEqual(result, undefined);    });
});
