/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as fs from 'fs';
import * as path from 'path';
import {
	keywords as dslVersionAsString,
} from './toscaDefinitionsVersion';

export const name:string = 'imports';
export const keywords = [
	'cloudify/types/types.yaml',
	'https://cloudify.co/spec/cloudify/6.3.0/types.yaml',
	'https://cloudify.co/spec/cloudify/6.4.0/types.yaml',
	'plugin:'
]

// TODO: Add find yaml files in subfolders and add them to import options.
// TODO: Add version constraints prediction.

class itemValidator {
	importItem:any;
	isString:boolean;
	constructor (dslVersion:string, importItem:any) {
		if (dslVersionAsString.includes(dslVersion)) {
			this.isString = true;
			this.importItem = importItem as string;
		} else if (typeof importItem === 'string') {
			this.isString = true;
			this.importItem = importItem as string;
		} else {
			this.isString = false;
			this.importItem = importItem as Object;
		}
	}
	toString() {
		if (this.isString) {
			return this.importItem;
		} else {
			console.error('Unable to return item as string.');
			return ''
		}
	}
}

export class validator {
    dslVersion:string;
	rawImports:[];
	imports;
	plugins:string[];

	constructor(dslVersion:string, rawImports:[]) {
		this.dslVersion = dslVersion;
		this.rawImports = rawImports;
		this.imports = new Array();
		this.plugins = new Array();
		this.assignPlugins();
	}

	assignPlugins() {
		try {
			for (let rawImported of this.rawImports) {
				let imported = new itemValidator(this.dslVersion, rawImported);
				this.imports.push(imported);
				let stringImport = imported.toString();
				if (stringImport.startsWith('plugin:')) {
					this.plugins.push(stringImport.replace('plugin:', ''));
				}
				console.log('plugins ' + this.plugins);
			}
		} catch (e) {
			// Worse things could happen.
			console.log(e);
		}
	}
}

function getImportsDir(referencePath:string): string {
	if (referencePath.startsWith('file:/')) {
		referencePath = referencePath.replace('file:/', '');
	}
	const importsDir:string = path.join(path.dirname(referencePath), 'imports');
	if (fs.existsSync(importsDir)) {
		return importsDir;
	} else {
		return '';
	}
}

export function getImportableYamls(referencePath:string): string[] {
	const importableYamls = new Array;
	const importsDir:string = getImportsDir(referencePath);
	if (importsDir.length > 0 ) {
        for (let fileName of fs.readdirSync(importsDir)) {
			if (fileName.endsWith('.yaml')) {
				importableYamls.push(path.join('imports', fileName));
			} else if (fileName.endsWith('.yml')) {
				throw new Error('Invalid relative import filename: ' + fileName + 'must end with ".yaml".');
			}
		}
	}
	return importableYamls;
}

