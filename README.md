# Cloudify LSP

Cloudify LSP is an extension for VS Code. It is helpful for validating and providing hints while writing Cloudify blueprints.


## Requirements:

 - VS Code. For more info, see [install VS Code](https://code.visualstudio.com/Download).
 - VS Code should be configured with a default Python interpreter. For more info, see [setting up Python interpreter](https://code.visualstudio.com/docs/python/environments#_working-with-python-interpreters).
 - Install cfy-lint in VS Code's Python environment. For more info, see [install CFY Lint](https://pypi.org/project/cfy-lint/).


### Tips

#### Other Extensions

  - This extension will not function properly without [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml).


#### Word Completion

Word completion is resource intensive and may sometimes take time to refresh the suggested words list. Here are some tips:

 - Ensure that [Auto Save](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save) is enabled in VS Code.
 - Trigger to see all suggestions with `ctrl-space`, for more info, see [here](https://stackoverflow.com/questions/56143239/how-to-trigger-vs-code-intellisense-using-keyboard-on-os-x).
 - Absolutely, make sure that [RedHat's YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) is installed.


#### Dev requirements:

For contributing to Cloudify LSP, you will require the following:

 - NPM in path. For more info, see [install npm](https://code.visualstudio.com/docs/nodejs/nodejs-tutorial) .
 - TypeScript should be installed for VS Code. For more info, see [install Typescript](https://code.visualstudio.com/Docs/languages/typescript).

